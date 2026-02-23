#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const inquirer = require('inquirer');

const CLAUDE_JSON_PATH = path.join(os.homedir(), '.claude.json');
const CLAUDE_JSON_TMP = CLAUDE_JSON_PATH + '.tmp';

// ---------------------------------------------------------------------------
// Core helpers
// ---------------------------------------------------------------------------

function readClaudeJson() {
  if (!fs.existsSync(CLAUDE_JSON_PATH)) {
    throw new Error(`~/.claude.json not found at ${CLAUDE_JSON_PATH}`);
  }
  let raw;
  try {
    raw = fs.readFileSync(CLAUDE_JSON_PATH, 'utf8');
  } catch (err) {
    throw new Error(`Cannot read ~/.claude.json: ${err.message}`);
  }
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`~/.claude.json contains invalid JSON: ${err.message}`);
  }
}

function writeClaudeJson(data) {
  const json = JSON.stringify(data, null, 2);
  fs.writeFileSync(CLAUDE_JSON_TMP, json, 'utf8');
  fs.renameSync(CLAUDE_JSON_TMP, CLAUDE_JSON_PATH);
}

function getGlobalMcpServers(data) {
  return data.mcpServers || {};
}

function slotDisplayLine(name, cfg) {
  const model = cfg.env && cfg.env.CLAUDE_DEFAULT_MODEL ? cfg.env.CLAUDE_DEFAULT_MODEL : cfg.command || '?';
  const url = cfg.env && cfg.env.ANTHROPIC_BASE_URL ? cfg.env.ANTHROPIC_BASE_URL : '';
  return `${name}  [${model}]  ${url}`;
}

// ---------------------------------------------------------------------------
// List agents
// ---------------------------------------------------------------------------

async function listAgents() {
  const data = readClaudeJson();
  const mcpServers = getGlobalMcpServers(data);
  const entries = Object.entries(mcpServers);

  if (entries.length === 0) {
    console.log('\n  (no agents configured in ~/.claude.json mcpServers)\n');
    return;
  }

  console.log('\n  Current agents in ~/.claude.json mcpServers:\n');

  const rows = entries.map(([name, cfg], i) => ({
    '#': i + 1,
    'Slot': name,
    'Model / Command': (cfg.env && cfg.env.CLAUDE_DEFAULT_MODEL) ? cfg.env.CLAUDE_DEFAULT_MODEL : cfg.command || '?',
    'Base URL': (cfg.env && cfg.env.ANTHROPIC_BASE_URL) ? cfg.env.ANTHROPIC_BASE_URL : '—',
    'Type': cfg.type || 'stdio',
  }));

  console.table(rows);
  console.log('');
}

// ---------------------------------------------------------------------------
// Add agent
// ---------------------------------------------------------------------------

async function addAgent() {
  const data = readClaudeJson();
  const mcpServers = getGlobalMcpServers(data);

  const existingSlots = Object.keys(mcpServers);

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'slotName',
      message: 'Slot name (e.g. claude-7):',
      validate(val) {
        if (!val || !val.trim()) return 'Slot name is required';
        if (/\s/.test(val)) return 'Slot name must not contain spaces';
        if (existingSlots.includes(val.trim())) return `Slot "${val.trim()}" already exists — use Edit to modify it`;
        return true;
      },
    },
    {
      type: 'input',
      name: 'command',
      message: 'Command (default: node):',
      default: 'node',
    },
    {
      type: 'input',
      name: 'args',
      message: 'Args (comma-separated, e.g. /path/to/server.mjs):',
      default: '',
    },
    {
      type: 'input',
      name: 'baseUrl',
      message: 'ANTHROPIC_BASE_URL (blank = skip):',
      default: '',
    },
    {
      type: 'password',
      name: 'apiKey',
      message: 'ANTHROPIC_API_KEY (blank = skip):',
      mask: '*',
      default: '',
    },
    {
      type: 'input',
      name: 'model',
      message: 'CLAUDE_DEFAULT_MODEL (blank = skip):',
      default: '',
    },
    {
      type: 'input',
      name: 'timeoutMs',
      message: 'CLAUDE_MCP_TIMEOUT_MS (blank = 30000):',
      default: '30000',
    },
    {
      type: 'input',
      name: 'providerSlot',
      message: 'PROVIDER_SLOT (default = slot name):',
      default: (answers) => answers.slotName || '',
    },
  ]);

  const slotName = answers.slotName.trim();
  const argsArr = answers.args
    ? answers.args.split(',').map((a) => a.trim()).filter(Boolean)
    : [];

  const env = {};
  if (answers.baseUrl && answers.baseUrl.trim()) env.ANTHROPIC_BASE_URL = answers.baseUrl.trim();
  if (answers.apiKey && answers.apiKey.trim()) env.ANTHROPIC_API_KEY = answers.apiKey.trim();
  if (answers.model && answers.model.trim()) env.CLAUDE_DEFAULT_MODEL = answers.model.trim();
  if (answers.timeoutMs && answers.timeoutMs.trim()) env.CLAUDE_MCP_TIMEOUT_MS = answers.timeoutMs.trim();
  env.PROVIDER_SLOT = (answers.providerSlot && answers.providerSlot.trim()) ? answers.providerSlot.trim() : slotName;

  const entry = {
    type: 'stdio',
    command: answers.command.trim() || 'node',
    args: argsArr,
    env,
  };

  data.mcpServers = Object.assign({}, mcpServers, { [slotName]: entry });
  writeClaudeJson(data);

  console.log(`\n  \x1b[32mAdded agent "${slotName}" to ~/.claude.json\x1b[0m\n`);
}

// ---------------------------------------------------------------------------
// Edit agent
// ---------------------------------------------------------------------------

async function editAgent() {
  const data = readClaudeJson();
  const mcpServers = getGlobalMcpServers(data);
  const slots = Object.keys(mcpServers);

  if (slots.length === 0) {
    console.log('\n  No agents to edit.\n');
    return;
  }

  const { slotName } = await inquirer.prompt([
    {
      type: 'list',
      name: 'slotName',
      message: 'Select agent to edit:',
      choices: slots,
    },
  ]);

  const existing = mcpServers[slotName];
  const existingEnv = existing.env || {};

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'command',
      message: 'Command:',
      default: existing.command || 'node',
    },
    {
      type: 'input',
      name: 'args',
      message: 'Args (comma-separated):',
      default: (existing.args || []).join(', '),
    },
    {
      type: 'input',
      name: 'baseUrl',
      message: 'ANTHROPIC_BASE_URL (blank = remove):',
      default: existingEnv.ANTHROPIC_BASE_URL || '',
    },
    {
      type: 'password',
      name: 'apiKey',
      message: 'ANTHROPIC_API_KEY (blank = keep existing / remove if never set):',
      mask: '*',
      default: '',
    },
    {
      type: 'input',
      name: 'model',
      message: 'CLAUDE_DEFAULT_MODEL (blank = remove):',
      default: existingEnv.CLAUDE_DEFAULT_MODEL || '',
    },
    {
      type: 'input',
      name: 'timeoutMs',
      message: 'CLAUDE_MCP_TIMEOUT_MS (blank = remove):',
      default: existingEnv.CLAUDE_MCP_TIMEOUT_MS || '',
    },
    {
      type: 'input',
      name: 'providerSlot',
      message: 'PROVIDER_SLOT:',
      default: existingEnv.PROVIDER_SLOT || slotName,
    },
  ]);

  const argsArr = answers.args
    ? answers.args.split(',').map((a) => a.trim()).filter(Boolean)
    : [];

  const env = {};
  if (answers.baseUrl && answers.baseUrl.trim()) env.ANTHROPIC_BASE_URL = answers.baseUrl.trim();

  // For API key: if user typed something new, use it; else preserve existing
  if (answers.apiKey && answers.apiKey.trim()) {
    env.ANTHROPIC_API_KEY = answers.apiKey.trim();
  } else if (existingEnv.ANTHROPIC_API_KEY) {
    env.ANTHROPIC_API_KEY = existingEnv.ANTHROPIC_API_KEY;
  }

  if (answers.model && answers.model.trim()) env.CLAUDE_DEFAULT_MODEL = answers.model.trim();
  if (answers.timeoutMs && answers.timeoutMs.trim()) env.CLAUDE_MCP_TIMEOUT_MS = answers.timeoutMs.trim();
  env.PROVIDER_SLOT = (answers.providerSlot && answers.providerSlot.trim()) ? answers.providerSlot.trim() : slotName;

  const updatedEntry = {
    type: existing.type || 'stdio',
    command: answers.command.trim() || 'node',
    args: argsArr,
    env,
  };

  // Rebuild mcpServers preserving key order, replacing only the target key
  const updatedMcpServers = Object.fromEntries(
    Object.entries(mcpServers).map(([k, v]) => [k, k === slotName ? updatedEntry : v])
  );

  data.mcpServers = updatedMcpServers;
  writeClaudeJson(data);

  console.log(`\n  \x1b[32mUpdated agent "${slotName}" in ~/.claude.json\x1b[0m\n`);
}

// ---------------------------------------------------------------------------
// Remove agent
// ---------------------------------------------------------------------------

async function removeAgent() {
  const data = readClaudeJson();
  const mcpServers = getGlobalMcpServers(data);
  const slots = Object.keys(mcpServers);

  if (slots.length === 0) {
    console.log('\n  No agents to remove.\n');
    return;
  }

  const { slotName } = await inquirer.prompt([
    {
      type: 'list',
      name: 'slotName',
      message: 'Select agent to remove:',
      choices: slots,
    },
  ]);

  const { confirmed } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirmed',
      message: `Remove "${slotName}"? This cannot be undone.`,
      default: false,
    },
  ]);

  if (!confirmed) {
    console.log('\n  Cancelled.\n');
    return;
  }

  const updated = Object.fromEntries(
    Object.entries(mcpServers).filter(([k]) => k !== slotName)
  );
  data.mcpServers = updated;
  writeClaudeJson(data);

  console.log(`\n  \x1b[32mRemoved agent "${slotName}" from ~/.claude.json\x1b[0m\n`);
}

// ---------------------------------------------------------------------------
// Reorder agents
// ---------------------------------------------------------------------------

async function reorderAgents() {
  const data = readClaudeJson();
  const mcpServers = getGlobalMcpServers(data);
  const slots = Object.keys(mcpServers);

  if (slots.length === 0) {
    console.log('\n  No agents to reorder.\n');
    return;
  }

  console.log('\n  Current order:\n');
  slots.forEach((name, i) => {
    console.log(`    ${i + 1}. ${slotDisplayLine(name, mcpServers[name])}`);
  });
  console.log('');

  const { slotName } = await inquirer.prompt([
    {
      type: 'input',
      name: 'slotName',
      message: 'Enter slot name to move:',
      validate(val) {
        if (!val || !val.trim()) return 'Slot name is required';
        if (!slots.includes(val.trim())) return `Slot "${val.trim()}" not found`;
        return true;
      },
    },
  ]);

  const targetSlot = slotName.trim();
  const currentIdx = slots.indexOf(targetSlot);

  const { newPos } = await inquirer.prompt([
    {
      type: 'input',
      name: 'newPos',
      message: `Move to position (1–${slots.length}):`,
      default: String(currentIdx + 1),
      validate(val) {
        const n = parseInt(val, 10);
        if (isNaN(n) || n < 1 || n > slots.length) return `Enter a number between 1 and ${slots.length}`;
        return true;
      },
    },
  ]);

  const entries = Object.entries(mcpServers);
  const idx = entries.findIndex(([k]) => k === targetSlot);
  const [entry] = entries.splice(idx, 1);
  entries.splice(parseInt(newPos, 10) - 1, 0, entry);
  const reordered = Object.fromEntries(entries);

  data.mcpServers = reordered;
  writeClaudeJson(data);

  console.log('\n  \x1b[32mUpdated order:\x1b[0m\n');
  Object.keys(reordered).forEach((name, i) => {
    console.log(`    ${i + 1}. ${slotDisplayLine(name, reordered[name])}`);
  });
  console.log('');
}

// ---------------------------------------------------------------------------
// Main menu loop
// ---------------------------------------------------------------------------

async function mainMenu() {
  let running = true;

  while (running) {
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'QGSD Agent Manager — ~/.claude.json mcpServers',
        choices: [
          { name: '1. List agents', value: 'list' },
          { name: '2. Add agent', value: 'add' },
          { name: '3. Edit agent', value: 'edit' },
          { name: '4. Remove agent', value: 'remove' },
          { name: '5. Reorder agents', value: 'reorder' },
          new inquirer.Separator(),
          { name: '0. Exit', value: 'exit' },
        ],
      },
    ]);

    try {
      switch (action) {
        case 'list':
          await listAgents();
          break;
        case 'add':
          await addAgent();
          break;
        case 'edit':
          await editAgent();
          break;
        case 'remove':
          await removeAgent();
          break;
        case 'reorder':
          await reorderAgents();
          break;
        case 'exit':
          running = false;
          console.log('\n  Goodbye!\n');
          break;
        default:
          console.log('\n  Unknown action.\n');
      }
    } catch (err) {
      console.error(`\n  \x1b[31mError: ${err.message}\x1b[0m\n`);
    }
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

if (require.main === module) {
  mainMenu().catch((err) => {
    console.error('\x1b[31mFatal error:\x1b[0m', err.message);
    process.exit(1);
  });
}

module.exports = { readClaudeJson, writeClaudeJson, getGlobalMcpServers, slotDisplayLine, mainMenu };
