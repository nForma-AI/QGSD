#!/usr/bin/env node
'use strict';
// bin/coderlm-adapter.test.cjs
// Unit tests for coderlm HTTP adapter

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { createAdapter, healthCheck } = require('./coderlm-adapter.cjs');

describe('coderlm-adapter module', () => {
  describe('Module exports', () => {
    it('exports createAdapter as a function', () => {
      assert.equal(typeof createAdapter, 'function');
    });

    it('exports healthCheck as a function', () => {
      assert.equal(typeof healthCheck, 'function');
    });
  });

  describe('createAdapter', () => {
    it('returns object with expected methods', () => {
      const adapter = createAdapter({ enabled: true });
      assert.equal(typeof adapter.health, 'function');
      assert.equal(typeof adapter.healthSync, 'function');
      assert.equal(typeof adapter.getCallers, 'function');
      assert.equal(typeof adapter.getImplementation, 'function');
      assert.equal(typeof adapter.findTests, 'function');
      assert.equal(typeof adapter.peek, 'function');
    });

    it('respects enabled flag — returns disabled error when false', async () => {
      const adapter = createAdapter({ enabled: false });
      const result = await adapter.health();
      assert.equal(result.error, 'disabled');
      assert.equal(result.healthy, false);
    });

    it('respects NF_CODERLM_ENABLED env var when no opts.enabled provided', async () => {
      const oldEnv = process.env.NF_CODERLM_ENABLED;
      process.env.NF_CODERLM_ENABLED = 'false';
      const adapter = createAdapter();
      const result = await adapter.health();
      assert.equal(result.error, 'disabled');
      process.env.NF_CODERLM_ENABLED = oldEnv;
    });
  });

  describe('healthCheck — standalone function', () => {
    let server;
    let port;

    before(async () => {
      // Start a mock HTTP server for successful health checks
      return new Promise((resolve) => {
        server = http.createServer((req, res) => {
          if (req.url === '/health') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'ok' }));
          } else {
            res.writeHead(404);
            res.end();
          }
        });
        server.listen(0, () => {
          port = server.address().port;
          resolve();
        });
      });
    });

    after(async () => {
      if (server) {
        return new Promise((resolve) => {
          server.close(resolve);
        });
      }
    });

    it('returns healthy:true for successful 200 response', async () => {
      const result = await healthCheck(`http://localhost:${port}`, 2000);
      assert.equal(result.healthy, true);
      assert.equal(typeof result.latencyMs, 'number');
      assert.ok(result.latencyMs >= 0);
    });

    it('returns healthy:false on connection refused', async () => {
      // Port 1 is unlikely to have a service listening
      const result = await healthCheck('http://localhost:1', 100);
      assert.equal(result.healthy, false);
      assert.ok(result.error);
    });

    it('returns healthy:false on timeout', async () => {
      // Start a server that never responds
      return new Promise((resolve) => {
        const slowServer = http.createServer(() => {
          // Don't send any response — will timeout
        });
        slowServer.listen(0, async () => {
          const slowPort = slowServer.address().port;
          const result = await healthCheck(`http://localhost:${slowPort}`, 100);
          assert.equal(result.healthy, false);
          assert.equal(result.error, 'timeout');
          slowServer.close(resolve);
        });
      });
    });
  });

  describe('adapter.health() — async', () => {
    let server;
    let port;

    before(async () => {
      return new Promise((resolve) => {
        server = http.createServer((req, res) => {
          if (req.url === '/health') {
            res.writeHead(200);
            res.end();
          } else {
            res.writeHead(404);
            res.end();
          }
        });
        server.listen(0, () => {
          port = server.address().port;
          resolve();
        });
      });
    });

    after(async () => {
      if (server) {
        return new Promise((resolve) => {
          server.close(resolve);
        });
      }
    });

    it('returns healthy:true on successful health endpoint', async () => {
      const adapter = createAdapter({ host: `http://localhost:${port}`, enabled: true });
      const result = await adapter.health();
      assert.equal(result.healthy, true);
      assert.ok(result.latencyMs >= 0);
    });

    it('returns error on HTTP 5xx', async () => {
      return new Promise((resolve) => {
        const errorServer = http.createServer((req, res) => {
          res.writeHead(500);
          res.end();
        });
        errorServer.listen(0, async () => {
          const errorPort = errorServer.address().port;
          const adapter = createAdapter({ host: `http://localhost:${errorPort}`, enabled: true });
          const result = await adapter.health();
          assert.equal(result.healthy, false);
          assert.ok(result.error.includes('500'));
          errorServer.close(resolve);
        });
      });
    });

    it('returns error on HTTP 4xx', async () => {
      return new Promise((resolve) => {
        const errorServer = http.createServer((req, res) => {
          res.writeHead(404);
          res.end();
        });
        errorServer.listen(0, async () => {
          const errorPort = errorServer.address().port;
          const adapter = createAdapter({ host: `http://localhost:${errorPort}`, enabled: true });
          const result = await adapter.health();
          assert.equal(result.healthy, false);
          assert.ok(result.error.includes('404'));
          errorServer.close(resolve);
        });
      });
    });
  });

  describe('adapter.healthSync()', () => {
    it('returns object synchronously (not a promise) when disabled', () => {
      const adapter = createAdapter({ enabled: false });
      const result = adapter.healthSync();
      assert.equal(typeof result.then, 'undefined');
      assert.equal(result.error, 'disabled');
    });

    it('returns synchronously (not a promise) even when attempting to connect', () => {
      // Use invalid port that will fail immediately
      const adapter = createAdapter({ host: 'http://localhost:1', enabled: true, healthTimeout: 100 });
      const result = adapter.healthSync();
      assert.equal(typeof result.then, 'undefined', 'result must not be a Promise');
      assert.equal(result.healthy, false);
      assert.ok(result.error);
    });

    it('spawnSync script returns valid JSON on error', () => {
      const adapter = createAdapter({ host: 'http://invalid-host-xyz.test:9999', enabled: true, healthTimeout: 100 });
      const result = adapter.healthSync();
      assert.equal(typeof result.then, 'undefined');
      assert.equal(typeof result.healthy, 'boolean');
      assert.ok(result.latencyMs !== undefined);
    });
  });

  describe('adapter.getCallers()', () => {
    let server;
    let port;

    before(async () => {
      return new Promise((resolve) => {
        server = http.createServer((req, res) => {
          if (req.url.startsWith('/callers')) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ callers: ['caller1', 'caller2'] }));
          } else {
            res.writeHead(404);
            res.end();
          }
        });
        server.listen(0, () => {
          port = server.address().port;
          resolve();
        });
      });
    });

    after(async () => {
      if (server) {
        return new Promise((resolve) => {
          server.close(resolve);
        });
      }
    });

    it('returns callers array on success', async () => {
      const adapter = createAdapter({ host: `http://localhost:${port}`, enabled: true });
      const result = await adapter.getCallers('someSymbol', 'file.js');
      assert.deepStrictEqual(result.callers, ['caller1', 'caller2']);
    });

    it('returns error on 4xx/5xx', async () => {
      return new Promise((resolve) => {
        const errorServer = http.createServer((req, res) => {
          res.writeHead(502);
          res.end();
        });
        errorServer.listen(0, async () => {
          const errorPort = errorServer.address().port;
          const adapter = createAdapter({ host: `http://localhost:${errorPort}`, enabled: true });
          const result = await adapter.getCallers('symbol', 'file.js');
          assert.ok(result.error);
          assert.ok(result.error.includes('502'));
          errorServer.close(resolve);
        });
      });
    });

    it('returns disabled error when disabled', async () => {
      const adapter = createAdapter({ enabled: false });
      const result = await adapter.getCallers('symbol', 'file.js');
      assert.equal(result.error, 'disabled');
    });
  });

  describe('adapter.getImplementation()', () => {
    let server;
    let port;

    before(async () => {
      return new Promise((resolve) => {
        server = http.createServer((req, res) => {
          if (req.url.startsWith('/implementation')) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ file: 'impl.js', line: 42 }));
          } else {
            res.writeHead(404);
            res.end();
          }
        });
        server.listen(0, () => {
          port = server.address().port;
          resolve();
        });
      });
    });

    after(async () => {
      if (server) {
        return new Promise((resolve) => {
          server.close(resolve);
        });
      }
    });

    it('returns implementation details on success', async () => {
      const adapter = createAdapter({ host: `http://localhost:${port}`, enabled: true });
      const result = await adapter.getImplementation('someSymbol');
      assert.equal(result.file, 'impl.js');
      assert.equal(result.line, 42);
    });
  });

  describe('adapter.findTests()', () => {
    let server;
    let port;

    before(async () => {
      return new Promise((resolve) => {
        server = http.createServer((req, res) => {
          if (req.url.startsWith('/tests')) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ tests: ['test1.js', 'test2.js'] }));
          } else {
            res.writeHead(404);
            res.end();
          }
        });
        server.listen(0, () => {
          port = server.address().port;
          resolve();
        });
      });
    });

    after(async () => {
      if (server) {
        return new Promise((resolve) => {
          server.close(resolve);
        });
      }
    });

    it('returns test list on success', async () => {
      const adapter = createAdapter({ host: `http://localhost:${port}`, enabled: true });
      const result = await adapter.findTests('file.js');
      assert.deepStrictEqual(result.tests, ['test1.js', 'test2.js']);
    });
  });

  describe('adapter.peek()', () => {
    let server;
    let port;

    before(async () => {
      return new Promise((resolve) => {
        server = http.createServer((req, res) => {
          if (req.url.startsWith('/peek')) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ lines: ['line 1', 'line 2', 'line 3'] }));
          } else {
            res.writeHead(404);
            res.end();
          }
        });
        server.listen(0, () => {
          port = server.address().port;
          resolve();
        });
      });
    });

    after(async () => {
      if (server) {
        return new Promise((resolve) => {
          server.close(resolve);
        });
      }
    });

    it('returns file lines on success', async () => {
      const adapter = createAdapter({ host: `http://localhost:${port}`, enabled: true });
      const result = await adapter.peek('file.js', 1, 3);
      assert.deepStrictEqual(result.lines, ['line 1', 'line 2', 'line 3']);
    });
  });

  describe('Timeout behavior', () => {
    it('getCallers respects timeout', async () => {
      return new Promise((resolve) => {
        const slowServer = http.createServer(() => {
          // Never respond — will timeout
        });
        slowServer.listen(0, async () => {
          const slowPort = slowServer.address().port;
          const adapter = createAdapter({
            host: `http://localhost:${slowPort}`,
            enabled: true,
            timeout: 50
          });
          const result = await adapter.getCallers('symbol', 'file.js');
          assert.equal(result.error, 'timeout');
          slowServer.close(resolve);
        });
      });
    });
  });
});
