#!/usr/bin/env node

require('./cli');
const { program } = require('commander');
const login = require('./commands/login');
const sync = require('./commands/sync');
const status = require('./commands/status');
const listTokens = require('./commands/tokens');
const createToken = require('./commands/tokensCreate');
const revokeToken = require('./commands/revoke');
const showAudit = require('./commands/audit');
const envList = require('./commands/envList');

program
  .name('vaultify')
  .description('Vaultify CLI - Secure API key proxy for Vercel deployments')
  .version('1.0.0');

program
  .command('login')
  .description('Authenticate with Vaultify server')
  .action(login);

const tokensCmd = program
  .command('tokens')
  .description('Manage proxy tokens');

tokensCmd
  .command('list')
  .description('List all active tokens')
  .action(listTokens);

tokensCmd
  .command('create')
  .description('Interactively generate a new proxy token')
  .action(createToken);

tokensCmd
  .command('revoke <id>')
  .description('Immediately revoke a token')
  .action(revokeToken);

program
  .command('sync')
  .description('Push proxy tokens from .env.vaultify to Vercel env vars')
  .action(sync);

program
  .command('status')
  .description('Vault connection health, active tokens, anomaly alerts')
  .action(status);

const envCmd = program
  .command('env')
  .description('Manage Vercel environment variables');

envCmd
  .command('list')
  .description('See what Vercel currently has set for this project')
  .action(envList);

program
  .command('audit')
  .description('View last 20 audit log entries')
  .option('-l, --limit <number>', 'number of entries to show', '20')
  .action((options) => showAudit(parseInt(options.limit)));

program.parse();