#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

// ─── Module names matching nForma.cjs SCREENSHOT_MODULES ─────────────────────
const MODULE_NAMES = ['agents', 'reqs', 'config', 'sessions'];

// ─── Tokyo Night palette (matches generate-terminal-svg.js) ──────────────────
const COLORS = {
  bg:       '#1a1b26',
  border:   '#24283b',
  titlebar: '#1f2335',
  btnRed:   '#f7768e',
  btnYellow:'#e0af68',
  btnGreen: '#9ece6a',
  white:    '#c0caf5',
  dim:      '#565f89',
  cyan:     '#7dcfff',
  green:    '#9ece6a',
  salmon:   '#f4956a',
  teal:     '#73daca',
  blue:     '#7aa2f7',
  magenta:  '#bb9af7',
  red:      '#f7768e',
  yellow:   '#e0af68',
};

const FONT = "'SF Mono', 'Fira Code', 'JetBrains Mono', Consolas, monospace";
const FONT_SIZE = 14;
const CHAR_W = 8.4;
const LINE_H = 22;
const PADDING_X = 16;
const PADDING_Y = 56;
const TITLE_H = 36;
const MIN_WIDTH = 960;

// ─── ANSI color code to hex mapping ──────────────────────────────────────────
const ANSI_FG_MAP = {
  '30': '#414868', '31': COLORS.red,    '32': COLORS.green,  '33': COLORS.yellow,
  '34': COLORS.blue, '35': COLORS.magenta, '36': COLORS.cyan, '37': COLORS.white,
  '90': COLORS.dim,  '91': COLORS.red,  '92': COLORS.green,  '93': COLORS.yellow,
  '94': COLORS.blue, '95': COLORS.magenta, '96': COLORS.cyan, '97': '#c0caf5',
};

/**
 * Parse ANSI text into an array of { text, color } spans per line.
 * @param {string} ansiText - raw ANSI text with escape codes
 * @returns {Array<Array<{text: string, color: string}>>} lines of spans
 */
function parseAnsiSpans(ansiText) {
  const lines = ansiText.split('\n');
  const result = [];

  for (const line of lines) {
    const spans = [];
    let currentColor = COLORS.white;
    let currentBg = null;
    let buf = '';
    let i = 0;

    while (i < line.length) {
      if (line[i] === '\x1b' && line[i + 1] === '[') {
        // Flush buffer
        if (buf) {
          spans.push({ text: buf, color: currentColor, bg: currentBg });
          buf = '';
        }
        // Parse escape sequence
        let j = i + 2;
        while (j < line.length && !((line.charCodeAt(j) >= 65 && line.charCodeAt(j) <= 90) ||
               (line.charCodeAt(j) >= 97 && line.charCodeAt(j) <= 122))) {
          j++;
        }
        const params = line.slice(i + 2, j);
        const cmd = line[j] || 'm';
        i = j + 1;

        if (cmd === 'm') {
          const codes = params.split(';');
          let ci = 0;
          while (ci < codes.length) {
            const code = codes[ci];
            if (code === '0' || code === '') {
              currentColor = COLORS.white;
              currentBg = null;
            } else if (code === '1') {
              // bold — keep current color
            } else if (code === '38' && codes[ci + 1] === '2') {
              // 24-bit foreground: 38;2;R;G;B
              const r = parseInt(codes[ci + 2] || '0', 10);
              const g = parseInt(codes[ci + 3] || '0', 10);
              const b = parseInt(codes[ci + 4] || '0', 10);
              currentColor = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
              ci += 4;
            } else if (code === '48' && codes[ci + 1] === '2') {
              // 24-bit background: 48;2;R;G;B
              const r = parseInt(codes[ci + 2] || '0', 10);
              const g = parseInt(codes[ci + 3] || '0', 10);
              const b = parseInt(codes[ci + 4] || '0', 10);
              currentBg = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
              ci += 4;
            } else if (code === '38' && codes[ci + 1] === '5') {
              // 256-color foreground — map common values
              ci += 2;
            } else if (ANSI_FG_MAP[code]) {
              currentColor = ANSI_FG_MAP[code];
            }
            ci++;
          }
        }
      } else {
        buf += line[i];
        i++;
      }
    }
    if (buf) {
      spans.push({ text: buf, color: currentColor, bg: currentBg });
    }
    result.push(spans);
  }

  return result;
}

/**
 * Strip ANSI escape codes from text.
 * @param {string} text - ANSI text
 * @returns {string} plain text
 */
function stripAnsi(text) {
  return text.replace(/\x1b\[[0-9;]*[A-Za-z]/g, '');
}

/**
 * Convert ANSI text to SVG with terminal window chrome.
 * @param {string} ansiText - raw ANSI text with escape codes
 * @param {string} title - window title
 * @returns {string} SVG markup
 */
function ansiToSvg(ansiText, title) {
  if (!ansiText || !ansiText.trim()) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${MIN_WIDTH} 100">
  <rect fill="${COLORS.bg}" width="${MIN_WIDTH}" height="100" rx="12"/>
  <text x="50" y="60" font-family="${FONT}" font-size="${FONT_SIZE}" fill="${COLORS.dim}">No content</text>
</svg>`;
  }

  const parsedLines = parseAnsiSpans(ansiText);
  const plainLines = stripAnsi(ansiText).split('\n');
  const maxCols = Math.max(...plainLines.map(l => l.length), 80);
  const width = Math.max(MIN_WIDTH, Math.ceil(maxCols * CHAR_W + PADDING_X * 2 + 20));
  const contentHeight = parsedLines.length * LINE_H + 20;
  const height = TITLE_H + PADDING_Y - TITLE_H + contentHeight + 20;

  const svgParts = [];

  // Window frame
  svgParts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">`);
  svgParts.push(`  <!-- Window frame -->`);
  svgParts.push(`  <rect fill="${COLORS.border}" width="${width}" height="${height}" rx="12"/>`);
  svgParts.push(`  <rect fill="${COLORS.bg}" x="1" y="1" width="${width - 2}" height="${height - 2}" rx="11"/>`);

  // Title bar
  svgParts.push(`  <!-- Title bar -->`);
  svgParts.push(`  <rect fill="${COLORS.titlebar}" x="1" y="1" width="${width - 2}" height="${TITLE_H}" rx="11"/>`);
  svgParts.push(`  <rect fill="${COLORS.bg}" x="1" y="26" width="${width - 2}" height="12"/>`);

  // Traffic lights
  svgParts.push(`  <!-- Traffic lights -->`);
  svgParts.push(`  <circle fill="${COLORS.btnRed}" cx="24" cy="19" r="7"/>`);
  svgParts.push(`  <circle fill="${COLORS.btnYellow}" cx="48" cy="19" r="7"/>`);
  svgParts.push(`  <circle fill="${COLORS.btnGreen}" cx="72" cy="19" r="7"/>`);

  // Window title
  svgParts.push(`  <!-- Window title -->`);
  svgParts.push(`  <text x="${Math.floor(width / 2)}" y="24" text-anchor="middle"`);
  svgParts.push(`        font-family="${FONT}" font-size="13" fill="${COLORS.dim}">${escapeXml(title)}</text>`);

  // Content
  svgParts.push(`  <!-- Content -->`);
  svgParts.push(`  <g transform="translate(${PADDING_X}, ${PADDING_Y})">`);

  for (let lineIdx = 0; lineIdx < parsedLines.length; lineIdx++) {
    const spans = parsedLines[lineIdx];
    if (spans.length === 0) continue;

    const y = lineIdx * LINE_H + FONT_SIZE;

    // Render background rects first
    let bgX = 0;
    for (const span of spans) {
      if (span.bg) {
        const spanWidth = span.text.length * CHAR_W;
        svgParts.push(`    <rect x="${bgX}" y="${lineIdx * LINE_H}" width="${spanWidth}" height="${LINE_H}" fill="${span.bg}"/>`);
      }
      bgX += span.text.length * CHAR_W;
    }

    // Render text spans
    const tspans = spans.map(s =>
      `<tspan fill="${s.color}">${escapeXml(s.text)}</tspan>`
    ).join('');

    svgParts.push(`    <text font-family="${FONT}" font-size="${FONT_SIZE}" y="${y}" xml:space="preserve">${tspans}</text>`);
  }

  svgParts.push(`  </g>`);
  svgParts.push(`</svg>`);

  return svgParts.join('\n');
}

/**
 * Escape XML special characters.
 */
function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ─── Main ────────────────────────────────────────────────────────────────────
function main() {
  const outDir = path.join(__dirname, '..', 'docs', 'assets');
  fs.mkdirSync(outDir, { recursive: true });

  let generated = 0;

  for (const name of MODULE_NAMES) {
    const result = spawnSync('node', [path.join(__dirname, 'nForma.cjs'), '--screenshot', name], {
      encoding: 'utf8',
      timeout: 10000,
      env: { ...process.env, TERM: 'xterm-256color' },
    });

    if (result.error || result.status !== 0) {
      process.stderr.write(`Warning: failed to capture ${name}: ${result.error || result.stderr || 'exit ' + result.status}\n`);
      continue;
    }

    const ansi = result.stdout;
    if (!ansi || !ansi.trim()) {
      process.stderr.write(`Warning: empty output for ${name}, skipping\n`);
      continue;
    }

    const titleName = name.charAt(0).toUpperCase() + name.slice(1);
    const svg = ansiToSvg(ansi, `nForma - ${titleName}`);
    const outPath = path.join(outDir, `tui-${name}.svg`);
    fs.writeFileSync(outPath, svg, 'utf8');
    generated++;
  }

  console.log(`Generated ${generated} TUI assets in docs/assets/`);
  if (generated < MODULE_NAMES.length) {
    process.stderr.write(`Warning: only ${generated}/${MODULE_NAMES.length} modules succeeded\n`);
  }
}

// Export for testing
module.exports = { ansiToSvg, stripAnsi, parseAnsiSpans, ANSI_FG_MAP };

// Run if invoked directly
if (require.main === module) {
  main();
}
