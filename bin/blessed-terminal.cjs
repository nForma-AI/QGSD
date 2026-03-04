'use strict';
/**
 * blessed-terminal.cjs
 *
 * Drop-in replacement for blessed-xterm's XTerm widget.
 * Uses @xterm/headless (pure JS, no native addons) + child_process.spawn
 * instead of node-pty (native C++ addon).
 *
 * API surface used by nforma.cjs:
 *   new BlessedTerminal({ shell, args, cwd, cursorType, scrollback,
 *                         ignoreKeys, top, left, right, bottom,
 *                         border, style, label, tags })
 *   term.show() / term.hide() / term.focus()   — inherited from blessed.Box
 *   term.terminate()                            — kill child process
 *   term.on('exit', (code, signal) => ...)      — child process exited
 */

const blessed      = require('blessed');
const { spawn }    = require('child_process');
const { Terminal } = require('@xterm/headless');

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Convert an xterm.js CellData into a blessed sattr integer.
 * blessed sattr format: (flags << 18) | (fg << 9) | bg
 *   flags bits: 0=bold, 1=underline, 2=blink, 3=inverse
 *   fg/bg:  0-255 palette, 256=default bg, 257=default fg
 */
function cellToSattr(cell) {
  // Flags
  let flags = 0;
  if (cell.isBold())      flags |= 1;
  if (cell.isUnderline()) flags |= 2;
  if (cell.isBlink())     flags |= 4;
  if (cell.isInverse())   flags |= 8;

  // Foreground color
  let fg;
  if (cell.isFgDefault()) {
    fg = 257; // blessed default fg sentinel
  } else if (cell.isFgPalette()) {
    fg = cell.getFgColor() & 0xff;
  } else if (cell.isFgRGB()) {
    // RGB — map to nearest 256-color index
    const raw = cell.getFgColor(); // 0xRRGGBB packed as int
    fg = rgbToAnsi256((raw >> 16) & 0xff, (raw >> 8) & 0xff, raw & 0xff);
  } else {
    fg = 257;
  }

  // Background color
  let bg;
  if (cell.isBgDefault()) {
    bg = 256; // blessed default bg sentinel
  } else if (cell.isBgPalette()) {
    bg = cell.getBgColor() & 0xff;
  } else if (cell.isBgRGB()) {
    const raw = cell.getBgColor();
    bg = rgbToAnsi256((raw >> 16) & 0xff, (raw >> 8) & 0xff, raw & 0xff);
  } else {
    bg = 256;
  }

  return (flags << 18) | (fg << 9) | bg;
}

/**
 * Map RGB values to nearest xterm-256 palette index.
 * Uses the standard 6x6x6 cube (indices 16-231) and grayscale ramp (232-255).
 */
function rgbToAnsi256(r, g, b) {
  // Check grayscale ramp first (232-255): 24 steps from rgb(8,8,8) to rgb(238,238,238)
  if (r === g && g === b) {
    if (r < 8)   return 16;  // black
    if (r > 248) return 231; // white
    return Math.round((r - 8) / 247 * 24) + 232;
  }
  // 6x6x6 cube (indices 16-231)
  const ri = Math.round(r / 255 * 5);
  const gi = Math.round(g / 255 * 5);
  const bi = Math.round(b / 255 * 5);
  return 16 + (36 * ri) + (6 * gi) + bi;
}

// ─── BlessedTerminal ─────────────────────────────────────────────────────────

class BlessedTerminal extends blessed.Box {
  constructor(options) {
    // Separate terminal-specific options from blessed Box options
    const {
      shell       = process.env.SHELL || '/bin/sh',
      args        = [],
      cwd         = process.cwd(),
      cursorType,          // ignored — blessed has no cursor API
      scrollback  = 1000,
      ignoreKeys  = [],
      ...boxOptions
    } = options || {};

    // Defaults for blessed Box
    boxOptions.scrollable = false;
    super(boxOptions);

    this._shellCmd  = shell;
    this._shellArgs = args;
    this._shellCwd  = cwd;
    this._scrollback = scrollback;
    this._ignoreKeys = ignoreKeys;

    // Deferred: we initialize _term and _child lazily on first render or
    // when the widget is attached to a screen (whichever comes first).
    this._term   = null;
    this._child  = null;
    this._ready  = false;
    this._destroyed = false;

    // Input routing state (mirrors blessed-xterm skipInputDataOnce pattern)
    this._skipInputDataOnce   = false;
    this._skipInputDataAlways = false;

    // Listeners we need to remove on destroy
    this._inputDataListener  = null;
    this._keypressListener   = null;
    this._resizeListener     = null;

    // Start as soon as we're attached to a screen
    this.on('attach', () => this._init());
    this.on('destroy', () => this._cleanup());
  }

  // ─── Initialise xterm + child process ───────────────────────────────────

  _init() {
    if (this._ready || this._destroyed) return;
    this._ready = true;

    const cols = Math.max(this.width  - (this.ileft + this.iright),  1);
    const rows = Math.max(this.height - (this.itop  + this.ibottom), 1);

    // @xterm/headless terminal — parses VT100/ANSI and maintains buffer
    this._term = new Terminal({
      cols,
      rows,
      scrollback: this._scrollback,
      allowProposedApi: true,
    });

    // child_process.spawn — pure JS, no native addons
    const env = Object.assign({}, process.env, {
      TERM:         'xterm-256color',
      COLORTERM:    'truecolor',
      FORCE_COLOR:  '3',
      COLUMNS:      String(cols),
      LINES:        String(rows),
    });

    this._child = spawn(this._shellCmd, this._shellArgs, {
      cwd:   this._shellCwd,
      env,
      stdio: 'pipe',
    });

    // Pipe child stdout/stderr → xterm parser
    this._child.stdout.on('data', (data) => {
      if (!this._destroyed) this._term.write(data.toString());
      if (this.screen) this.screen.render();
    });
    this._child.stderr.on('data', (data) => {
      if (!this._destroyed) this._term.write(data.toString());
      if (this.screen) this.screen.render();
    });

    // Child exit → emit 'exit' on widget
    this._child.on('exit', (code, signal) => {
      if (!this._destroyed) this.emit('exit', code, signal);
    });

    // Handle spawn errors gracefully
    this._child.on('error', (err) => {
      if (!this._destroyed) {
        this._term.write(`\r\nFailed to start: ${err.message}\r\n`);
        if (this.screen) this.screen.render();
      }
    });

    // Wire up keyboard input routing
    this._wireInput();

    // Resize handler
    this._resizeListener = () => this._handleResize();
    this.screen.on('resize', this._resizeListener);
  }

  // ─── Input routing ──────────────────────────────────────────────────────

  _wireInput() {
    if (!this.screen) return;

    // Raw input data → child stdin (when this widget is focused)
    this._inputDataListener = (data) => {
      if (this.screen.focused !== this) return;
      if (this._skipInputDataAlways)    return;
      if (this._skipInputDataOnce)      { this._skipInputDataOnce = false; return; }
      if (this._child && this._child.stdin && !this._child.stdin.destroyed) {
        try { this._child.stdin.write(data); } catch (_) {}
      }
    };
    this.screen.program.input.on('data', this._inputDataListener);

    // Keypress → implement ignoreKeys (skip next raw data event for ignored keys)
    this._keypressListener = (ch, key) => {
      if (this.screen.focused !== this) return;
      if (!key) return;
      if (this._ignoreKeys.indexOf(key.full) >= 0) {
        this._skipInputDataOnce = true;
      }
    };
    this.screen.on('keypress', this._keypressListener);
  }

  // ─── Resize handler ─────────────────────────────────────────────────────

  _handleResize() {
    if (!this._term || this._destroyed) return;
    const cols = Math.max(this.width  - (this.ileft + this.iright),  1);
    const rows = Math.max(this.height - (this.itop  + this.ibottom), 1);
    try { this._term.resize(cols, rows); } catch (_) {}
    // Note: with piped stdio there's no SIGWINCH to send, so the child
    // process may not reflow. This is acceptable for Claude CLI output.
  }

  // ─── Render override — bridge xterm buffer → blessed screen lines ────────

  render() {
    const ret = this._render();
    if (!ret) return;

    if (!this._term || this._destroyed) return ret;

    const xi = ret.xi + this.ileft;
    const xl = ret.xl - this.iright;
    const yi = ret.yi + this.itop;
    const yl = ret.yl - this.ibottom;

    const buf  = this._term.buffer.active;
    const cols = this._term.cols;
    const rows = this._term.rows;

    for (let y = Math.max(yi, 0); y < yl; y++) {
      const screenY = y;
      const termY   = buf.viewportY + (y - yi);

      if (termY < 0 || termY >= rows + buf.viewportY) continue;

      const sline = this.screen.lines[screenY];
      if (!sline) continue;

      const tline = buf.getLine(termY);
      if (!tline) {
        // Blank this screen line
        for (let x = Math.max(xi, 0); x < xl; x++) {
          if (!sline[x]) continue;
          sline[x][0] = 0x20200; // default attrs (fg=257, bg=256 in blessed)
          sline[x][1] = ' ';
        }
        sline.dirty = true;
        continue;
      }

      let dirty = false;
      for (let x = Math.max(xi, 0); x < xl; x++) {
        const screenX = x;
        const termX   = x - xi;

        if (termX >= cols) {
          if (sline[screenX]) { sline[screenX][0] = 0x20200; sline[screenX][1] = ' '; dirty = true; }
          continue;
        }

        if (!sline[screenX]) continue;

        const cell  = tline.getCell(termX);
        if (!cell) {
          sline[screenX][0] = 0x20200;
          sline[screenX][1] = ' ';
          dirty = true;
          continue;
        }

        const ch    = cell.getChars() || ' ';
        const sattr = cellToSattr(cell);

        if (sline[screenX][0] !== sattr || sline[screenX][1] !== ch) {
          sline[screenX][0] = sattr;
          sline[screenX][1] = ch;
          dirty = true;
        }
      }
      if (dirty) sline.dirty = true;
    }

    return ret;
  }

  // ─── Public API ─────────────────────────────────────────────────────────

  /**
   * terminate() — kill child process gracefully, then force-kill after 2s.
   */
  terminate() {
    if (!this._child) return;
    const child = this._child;
    try { child.kill('SIGTERM'); } catch (_) {}
    const timer = setTimeout(() => {
      try { child.kill('SIGKILL'); } catch (_) {}
    }, 2000);
    if (timer.unref) timer.unref(); // don't keep process alive
  }

  // ─── Cleanup ────────────────────────────────────────────────────────────

  _cleanup() {
    if (this._destroyed) return;
    this._destroyed = true;

    // Remove listeners
    if (this._inputDataListener && this.screen && this.screen.program && this.screen.program.input) {
      try { this.screen.program.input.removeListener('data', this._inputDataListener); } catch (_) {}
    }
    if (this._keypressListener && this.screen) {
      try { this.screen.removeListener('keypress', this._keypressListener); } catch (_) {}
    }
    if (this._resizeListener && this.screen) {
      try { this.screen.removeListener('resize', this._resizeListener); } catch (_) {}
    }

    // Kill child process
    try { this.terminate(); } catch (_) {}
    this._child = null;

    // Dispose xterm terminal
    if (this._term) {
      try { this._term.dispose(); } catch (_) {}
      this._term = null;
    }
  }
}

module.exports = BlessedTerminal;
