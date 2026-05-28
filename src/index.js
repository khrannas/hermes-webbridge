'use strict';

const commands = {
  check: require('./commands/check.js'),
  start: require('./commands/start.js'),
  stop: require('./commands/stop.js'),
  recover: require('./commands/recover.js'),
};

function showUsage() {
  const bold = '\x1b[1m';
  const cyan = '\x1b[36m';
  const reset = '\x1b[0m';

  console.log('');
  console.log(bold + 'hermes-webbridge' + reset + ' — Kimi WebBridge + Tailscale Serve manager');
  console.log('');
  console.log('Usage:');
  console.log('  ' + cyan + 'hwb check' + reset + '     Check Webbridge daemon + Tailscale Serve status');
  console.log('  ' + cyan + 'hwb start' + reset + '     Start Webbridge daemon + enable Tailscale Serve');
  console.log('  ' + cyan + 'hwb stop' + reset + '      Stop Webbridge daemon');
  console.log('  ' + cyan + 'hwb recover' + reset + '   Full post-restart recovery (start + verify)');
  console.log('');
  console.log('All commands run asynchronously and print colored output.');
  console.log('');
}

/**
 * @param {string[]} argv process.argv
 */
async function run(argv) {
  const args = argv.slice(2);
  const cmd = args[0];

  if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') {
    showUsage();
    return;
  }

  if (!commands[cmd]) {
    console.error('\x1b[31mUnknown command: ' + cmd + '\x1b[0m');
    showUsage();
    process.exit(1);
  }

  const result = await commands[cmd].handler();
  if (result && result.message) {
    console.log(result.message);
  }
}

module.exports = { run, showUsage };
