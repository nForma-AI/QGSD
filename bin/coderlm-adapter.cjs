'use strict';

/**
 * coderlm-adapter.cjs — HTTP adapter for coderlm symbol/call graph server
 *
 * Provides health checks and symbol query methods with timeout and error handling.
 * All methods return result objects (never throw) following fail-open pattern.
 */

const http = require('http');
const https = require('https');
const { spawnSync } = require('child_process');

const DEFAULT_HOST = 'http://localhost:8787';
const DEFAULT_TIMEOUT_QUERY = 5000;
const DEFAULT_TIMEOUT_HEALTH = 2000;

/**
 * Parse a URL string into components.
 * @param {string} url
 * @returns {{protocol: string, hostname: string, port: number|null, path: string}}
 */
function parseUrl(urlString) {
  try {
    const parsed = new URL(urlString);
    return {
      protocol: parsed.protocol,
      hostname: parsed.hostname,
      port: parsed.port ? parseInt(parsed.port, 10) : null,
      path: parsed.pathname + (parsed.search || ''),
    };
  } catch (e) {
    return {
      protocol: 'http:',
      hostname: 'localhost',
      port: 8787,
      path: '/',
    };
  }
}

/**
 * Make an HTTP GET request and return result.
 * @param {string} url - Full URL to fetch
 * @param {number} timeout - Request timeout in ms
 * @returns {Promise<{status: number, body: string, error?: string}>}
 */
function httpGet(url, timeout) {
  return new Promise((resolve) => {
    const parsed = parseUrl(url);
    const client = parsed.protocol === 'https:' ? https : http;
    const options = {
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.path,
      method: 'GET',
      timeout: timeout,
    };

    let timedOut = false;
    const req = client.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        if (!timedOut) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('timeout', () => {
      timedOut = true;
      req.destroy();
      resolve({ error: 'timeout' });
    });

    req.on('error', (e) => {
      if (!timedOut) {
        const code = e.code || e.message;
        resolve({ error: code });
      }
    });

    req.end();
  });
}

/**
 * Create an adapter instance with configurable options.
 * @param {Object} opts - Configuration options
 * @param {string} opts.host - Server URL (default: NF_CODERLM_HOST or http://localhost:8787)
 * @param {number} opts.timeout - Query timeout in ms (default: 5000)
 * @param {number} opts.healthTimeout - Health check timeout in ms (default: 2000)
 * @param {boolean} opts.enabled - Whether adapter is enabled (default: NF_CODERLM_ENABLED === 'true')
 * @returns {Object} Adapter object with health() and query methods
 */
function createAdapter(opts = {}) {
  const enabled = opts.enabled !== undefined ? opts.enabled : (process.env.NF_CODERLM_ENABLED === 'true');
  const host = opts.host || process.env.NF_CODERLM_HOST || DEFAULT_HOST;
  const timeout = opts.timeout !== undefined ? opts.timeout : DEFAULT_TIMEOUT_QUERY;
  const healthTimeout = opts.healthTimeout !== undefined ? opts.healthTimeout : DEFAULT_TIMEOUT_HEALTH;

  const adapter = {
    /**
     * Async health check — checks if coderlm server is responding.
     * @returns {Promise<{healthy: boolean, latencyMs: number, error?: string}>}
     */
    async health() {
      if (!enabled) {
        return { healthy: false, latencyMs: 0, error: 'disabled' };
      }
      const start = Date.now();
      const result = await httpGet(host + '/health', healthTimeout);
      const latencyMs = Date.now() - start;
      if (result.error) {
        return { healthy: false, latencyMs, error: result.error };
      }
      if (result.status === 200) {
        return { healthy: true, latencyMs };
      }
      return { healthy: false, latencyMs, error: 'HTTP ' + result.status };
    },

    /**
     * Synchronous health check using spawnSync pattern.
     * Spawns a node process to perform async HTTP check and parse result from stdout.
     * @returns {{healthy: boolean, latencyMs: number, error?: string}}
     */
    healthSync() {
      if (!enabled) {
        return { healthy: false, latencyMs: 0, error: 'disabled' };
      }
      const parsed = parseUrl(host);
      const port = parsed.port || (parsed.protocol === 'https:' ? 443 : 80);
      const script = `
const http = require('http');
const https = require('https');
const protocol = ${JSON.stringify(parsed.protocol)};
const hostname = ${JSON.stringify(parsed.hostname)};
const port = ${port};
const timeout = ${healthTimeout};
const client = protocol === 'https:' ? https : http;
async function check() {
  return new Promise(resolve => {
    const start = Date.now();
    let timedOut = false;
    const options = {
      hostname: hostname,
      port: port,
      path: '/health',
      method: 'GET',
      timeout: timeout
    };
    const req = client.request(options, res => {
      if (!timedOut && res.statusCode === 200) {
        resolve({ healthy: true, latencyMs: Date.now() - start });
      } else {
        resolve({ healthy: false, latencyMs: Date.now() - start, error: 'HTTP ' + (res.statusCode || 0) });
      }
    });
    req.on('timeout', () => {
      timedOut = true;
      req.destroy();
      resolve({ healthy: false, latencyMs: Date.now() - start, error: 'timeout' });
    });
    req.on('error', e => {
      if (!timedOut) {
        resolve({ healthy: false, latencyMs: Date.now() - start, error: e.code || 'error' });
      }
    });
    req.end();
  });
}
check().then(r => console.log(JSON.stringify(r)));
`;
      try {
        const result = spawnSync('node', ['-e', script], {
          timeout: healthTimeout + 1000,
          encoding: 'utf8',
        });
        if (result.status === 0 && result.stdout) {
          const parsed = JSON.parse(result.stdout.trim());
          return parsed;
        }
        return { healthy: false, latencyMs: 0, error: 'sync-spawn-failed' };
      } catch (e) {
        return { healthy: false, latencyMs: 0, error: 'sync-spawn-failed' };
      }
    },

    /**
     * Get callers of a symbol.
     * @param {string} symbol - Symbol name
     * @param {string} file - File path
     * @returns {Promise<{callers?: string[], error?: string}>}
     */
    async getCallers(symbol, file) {
      if (!enabled) {
        return { error: 'disabled' };
      }
      const url = host + '/callers?symbol=' + encodeURIComponent(symbol) + '&file=' + encodeURIComponent(file);
      const result = await httpGet(url, timeout);
      if (result.error) {
        return { error: result.error };
      }
      if (result.status === 200) {
        try {
          const parsed = JSON.parse(result.body);
          return { callers: parsed.callers || [] };
        } catch {
          return { error: 'parse' };
        }
      }
      return { error: 'HTTP ' + result.status };
    },

    /**
     * Synchronous wrapper for getCallers using spawnSync pattern.
     * Spawns a node process to perform async HTTP GET to /callers endpoint.
     * @param {string} symbol - Symbol name
     * @param {string} file - File path
     * @returns {{callers?: string[], error?: string}}
     */
    getCallersSync(symbol, file) {
      if (!enabled) {
        return { error: 'disabled' };
      }
      const parsed = parseUrl(host);
      const port = parsed.port || (parsed.protocol === 'https:' ? 443 : 80);
      const script = `
const http = require('http');
const https = require('https');
const protocol = ${JSON.stringify(parsed.protocol)};
const hostname = ${JSON.stringify(parsed.hostname)};
const port = ${port};
const symbol = ${JSON.stringify(symbol)};
const file = ${JSON.stringify(file)};
const timeout = ${timeout};
const client = protocol === 'https:' ? https : http;
async function getCallers() {
  return new Promise(resolve => {
    let timedOut = false;
    const path = '/callers?symbol=' + encodeURIComponent(symbol) + '&file=' + encodeURIComponent(file);
    const options = {
      hostname: hostname,
      port: port,
      path: path,
      method: 'GET',
      timeout: timeout
    };
    const req = client.request(options, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        if (!timedOut) {
          if (res.statusCode === 200) {
            try {
              const parsed = JSON.parse(data);
              resolve({ callers: parsed.callers || [] });
            } catch (e) {
              resolve({ error: 'parse' });
            }
          } else {
            resolve({ error: 'HTTP ' + res.statusCode });
          }
        }
      });
    });
    req.on('timeout', () => {
      timedOut = true;
      req.destroy();
      resolve({ error: 'timeout' });
    });
    req.on('error', e => {
      if (!timedOut) {
        resolve({ error: e.code || 'error' });
      }
    });
    req.end();
  });
}
getCallers().then(r => console.log(JSON.stringify(r)));
`;
      try {
        const result = spawnSync('node', ['-e', script], {
          timeout: timeout + 1000,
          encoding: 'utf8',
        });
        if (result.status === 0 && result.stdout) {
          const parsed = JSON.parse(result.stdout.trim());
          return parsed;
        }
        return { error: 'sync-spawn-failed' };
      } catch (e) {
        return { error: 'sync-spawn-failed' };
      }
    },

    /**
     * Get implementation location of a symbol.
     * @param {string} symbol - Symbol name
     * @returns {Promise<{file?: string, line?: number, error?: string}>}
     */
    async getImplementation(symbol) {
      if (!enabled) {
        return { error: 'disabled' };
      }
      const url = host + '/implementation?symbol=' + encodeURIComponent(symbol);
      const result = await httpGet(url, timeout);
      if (result.error) {
        return { error: result.error };
      }
      if (result.status === 200) {
        try {
          const parsed = JSON.parse(result.body);
          return { file: parsed.file, line: parsed.line };
        } catch {
          return { error: 'parse' };
        }
      }
      return { error: 'HTTP ' + result.status };
    },

    /**
     * Find tests for a file.
     * @param {string} file - File path
     * @returns {Promise<{tests?: string[], error?: string}>}
     */
    async findTests(file) {
      if (!enabled) {
        return { error: 'disabled' };
      }
      const url = host + '/tests?file=' + encodeURIComponent(file);
      const result = await httpGet(url, timeout);
      if (result.error) {
        return { error: result.error };
      }
      if (result.status === 200) {
        try {
          const parsed = JSON.parse(result.body);
          return { tests: parsed.tests || [] };
        } catch {
          return { error: 'parse' };
        }
      }
      return { error: 'HTTP ' + result.status };
    },

    /**
     * Peek at file content between line numbers.
     * @param {string} file - File path
     * @param {number} startLine - Start line (inclusive)
     * @param {number} endLine - End line (inclusive)
     * @returns {Promise<{lines?: string[], error?: string}>}
     */
    async peek(file, startLine, endLine) {
      if (!enabled) {
        return { error: 'disabled' };
      }
      const url = host + '/peek?file=' + encodeURIComponent(file) +
                  '&start=' + encodeURIComponent(startLine) +
                  '&end=' + encodeURIComponent(endLine);
      const result = await httpGet(url, timeout);
      if (result.error) {
        return { error: result.error };
      }
      if (result.status === 200) {
        try {
          const parsed = JSON.parse(result.body);
          return { lines: parsed.lines || [] };
        } catch {
          return { error: 'parse' };
        }
      }
      return { error: 'HTTP ' + result.status };
    },
  };

  return adapter;
}

/**
 * Standalone health check function.
 * @param {string} host - Server URL (optional, default http://localhost:8787)
 * @param {number} timeout - Timeout in ms (optional, default 2000)
 * @returns {Promise<{healthy: boolean, latencyMs: number, error?: string}>}
 */
async function healthCheck(host, timeout) {
  const url = host || DEFAULT_HOST;
  const t = timeout || DEFAULT_TIMEOUT_HEALTH;
  const start = Date.now();
  const result = await httpGet(url + '/health', t);
  const latencyMs = Date.now() - start;
  if (result.error) {
    return { healthy: false, latencyMs, error: result.error };
  }
  if (result.status === 200) {
    return { healthy: true, latencyMs };
  }
  return { healthy: false, latencyMs, error: 'HTTP ' + result.status };
}

module.exports = {
  createAdapter,
  healthCheck,
};
