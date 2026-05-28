'use strict';

const { runPowerShell } = require('../utils/powershell.js');

const green = '\x1b[32m';
const red = '\x1b[31m';
const cyan = '\x1b[36m';
const bold = '\x1b[1m';
const reset = '\x1b[0m';

/**
 * Stop command handler.
 * @returns {Promise<{ success: boolean, message: string }>}
 */
async function handler() {
  console.log(bold + '🛑 Stopping Kimi WebBridge daemon...' + reset);
  console.log('');

  const cmd =
    '& "$env:USERPROFILE\\.kimi-webbridge\\bin\\kimi-webbridge.exe" stop';

  const result = await runPowerShell(cmd);

  if (result.exitCode === 0 && !result.stderr) {
    console.log(green + '✅ Daemon stopped successfully' + reset);
    return { success: true, message: '' };
  }

  // Check if the binary doesn't exist
  if (
    result.stderr &&
    (result.stderr.includes('cannot find') ||
      result.stderr.includes('not found') ||
      result.stderr.includes('does not exist'))
  ) {
    console.log(
      red +
        '❌ Daemon binary not found at $env:USERPROFILE\\.kimi-webbridge\\bin\\kimi-webbridge.exe' +
        reset
    );
    console.log('');
    console.log(cyan + '   The daemon may not be installed.' + reset);
    return { success: false, message: '' };
  }

  console.log(red + '❌ Failed to stop daemon' + reset);
  if (result.stderr) {
    console.log(cyan + '   Error: ' + result.stderr + reset);
  }
  return { success: false, message: '' };
}

module.exports = { handler };
