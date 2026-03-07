'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { ansiToSvg, stripAnsi, parseAnsiSpans, ANSI_FG_MAP } = require('./generate-tui-assets.cjs');

describe('generate-tui-assets', () => {
  describe('stripAnsi', () => {
    it('removes standard ANSI escape codes', () => {
      const input = '\x1b[36mhello\x1b[0m world';
      assert.equal(stripAnsi(input), 'hello world');
    });

    it('removes 24-bit color codes', () => {
      const input = '\x1b[38;2;224;120;80mtext\x1b[0m';
      assert.equal(stripAnsi(input), 'text');
    });

    it('returns plain text unchanged', () => {
      assert.equal(stripAnsi('plain text'), 'plain text');
    });

    it('handles empty string', () => {
      assert.equal(stripAnsi(''), '');
    });
  });

  describe('parseAnsiSpans', () => {
    it('parses standard foreground colors', () => {
      const input = '\x1b[36mcyan\x1b[0m';
      const result = parseAnsiSpans(input);
      assert.equal(result.length, 1);
      assert.equal(result[0][0].text, 'cyan');
      assert.equal(result[0][0].color, ANSI_FG_MAP['36']);
    });

    it('parses 24-bit RGB colors', () => {
      const input = '\x1b[38;2;255;0;128mrgb\x1b[0m';
      const result = parseAnsiSpans(input);
      assert.equal(result[0][0].color, '#ff0080');
    });

    it('handles multiple lines', () => {
      const input = 'line1\nline2';
      const result = parseAnsiSpans(input);
      assert.equal(result.length, 2);
    });

    it('handles empty input', () => {
      const result = parseAnsiSpans('');
      assert.equal(result.length, 1);
    });
  });

  describe('ANSI_FG_MAP', () => {
    it('maps ANSI 36 to cyan hex', () => {
      assert.equal(ANSI_FG_MAP['36'], '#7dcfff');
    });

    it('maps ANSI 90 to dim hex', () => {
      assert.equal(ANSI_FG_MAP['90'], '#565f89');
    });

    it('maps ANSI 37 to white hex', () => {
      assert.equal(ANSI_FG_MAP['37'], '#c0caf5');
    });
  });

  describe('ansiToSvg', () => {
    it('produces valid SVG structure', () => {
      const svg = ansiToSvg('hello world', 'Test');
      assert.ok(svg.startsWith('<svg'));
      assert.ok(svg.includes('</svg>'));
    });

    it('includes terminal window chrome', () => {
      const svg = ansiToSvg('content', 'My Title');
      assert.ok(svg.includes('Traffic lights'));
      assert.ok(svg.includes('circle'));
      assert.ok(svg.includes('My Title'));
    });

    it('includes content text', () => {
      const svg = ansiToSvg('hello world', 'Test');
      assert.ok(svg.includes('hello world'));
    });

    it('handles ANSI colored input', () => {
      const svg = ansiToSvg('\x1b[36mcyan text\x1b[0m', 'Test');
      assert.ok(svg.includes('#7dcfff'));
      assert.ok(svg.includes('cyan text'));
    });

    it('handles empty input gracefully (fail-open)', () => {
      const svg = ansiToSvg('', 'Empty');
      assert.ok(svg.startsWith('<svg'));
      assert.ok(svg.includes('</svg>'));
      assert.ok(svg.includes('No content'));
    });

    it('handles null input gracefully', () => {
      const svg = ansiToSvg(null, 'Null');
      assert.ok(svg.startsWith('<svg'));
      assert.ok(svg.includes('</svg>'));
    });

    it('escapes XML special characters', () => {
      const svg = ansiToSvg('<script>alert("xss")</script>', 'Test');
      assert.ok(!svg.includes('<script>'));
      assert.ok(svg.includes('&lt;script&gt;'));
    });

    it('uses Tokyo Night font family', () => {
      const svg = ansiToSvg('test', 'Test');
      assert.ok(svg.includes('SF Mono'));
      assert.ok(svg.includes('Fira Code'));
    });

    it('uses dark background color', () => {
      const svg = ansiToSvg('test', 'Test');
      assert.ok(svg.includes('#1a1b26'));
    });
  });
});
