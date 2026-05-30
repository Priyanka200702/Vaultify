const chalk = require('chalk');
const ora = require('ora');

const info = (msg) => console.log(chalk.blue('ℹ'), msg);
const success = (msg) => console.log(chalk.green('✓'), msg);
const warn = (msg) => console.log(chalk.yellow('⚠'), msg);
const error = (msg) => console.log(chalk.red('✗'), msg);
const table = (data) => console.table(data);

const spinner = (msg) => ora({ text: msg, spinner: 'dots' });

module.exports = { info, success, warn, error, table, spinner };
