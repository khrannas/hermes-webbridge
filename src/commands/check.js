'use strict';

const { runPowerShell } = require('../utils/powershell.js');

const green = '\x1b[32m';
const red = '\x1b[31m';
const cyan = '\x1b[36m';
const bold = '\x1b[1m';
const reset = '\x1b[0m';

/**
 * Fetch daemon status via local HTTP endpoint.
 * @returns {Promise<object|null>}
 */
async function fetchDaemonStatus() {
  const cmd = 'curl.exe -s http://127.0.0.1:10086/status';
  const result = await runPowerShell(cmd);
  if (result.exitCode !== 0 || !result.stdout) {
    return null;
  }
  try {
    return JSON.parse(result.stdout);
  } catch {
    return null;
  }
}

/**
 * Fetch Tailscale serve status.
 * @returns {Promise<{ active: boolean, url: string|null }>}
 */
async function fetchTailscaleStatus() {
  const cmd = 'tailscale serve status';
  const result = await runPowerShell(cmd);
  if (result.exitCode !== 0) {
    return { active: false, url: null };
  }
  const stdout = result.stdout || '';
  const active = stdout.length > 0 && !stdout.includes('no serve');
  // Try to extract HTTPS URL from output
  const urlMatch = stdout.match(/https?:\/\/[^\s]+/);
  const url = urlMatch ? urlMatch[0] : null;
  return { active, url };
}

/**
 * Print a clean status box.
 * @param {object|null} daemonStatus
 * @param {{ active: boolean, url: string|null }} tailscaleStatus
 */
function printStatusBox(daemonStatus, tailscaleStatus) {
  const boxWidth = 49;
  const line = '─'.repeat(boxWidth - 2);

  console.log('');
  console.log('╭' + line + '╮');
  console.log('│  ' + bold + 'Hermes WebBridge Status' + reset + ' '.repeat(boxWidth - 24 - 2) + '│');
  console.log('├' + line + '┤');

  if (daemonStatus) {
    const running = daemonStatus.running === true || daemonStatus.running === 'true';
    const connected = daemonStatus.extension_connected === true || daemonStatus.extension_connected === 'true';

    const runIcon = running ? green + '✅' : red + '❌';
    const runText = 'running:' + String(running);
    console.log(
      '│ ' + runIcon + reset + ' Daemon        ' + runText + ' '.repeat(boxWidth - 24 - runText.length - 2) + '│'
    );

    if (daemonStatus.port) {
      const portStr = 'Port          ' + daemonStatus.port;
      console.log(
        '│    ' + portStr + ' '.repeat(boxWidth - 6 - portStr.length - 2) + '│'
      );
    }
    if (daemonStatus.uptime) {
      const uptimeStr = 'Uptime        ' + daemonStatus.uptime;
      console.log(
        '│    ' + uptimeStr + ' '.repeat(boxWidth - 6 - uptimeStr.length - 2) + '│'
      );
    }

    const connIcon = connected ? green + '✅' : red + '❌';
    const connText = 'connected:' + String(connected);
    console.log(
      '│ ' + connIcon + reset + ' Extension     ' + connText + ' '.repeat(boxWidth - 24 - connText.length - 2) + '│'
    );
  } else {
    const errMsg = 'Daemon is not reachable';
    console.log(
      '│ ' + red + '❌' + reset + ' ' + errMsg + ' '.repeat(boxWidth - 6 - errMsg.length - 2) + '│'
    );
  }

  const tsIcon = tailscaleStatus.active ? green + '✅' : red + '❌';
  const tsText = 'serve ' + (tailscaleStatus.active ? 'active' : 'inactive');
  console.log(
    '│ ' + tsIcon + reset + ' Tailscale     ' + tsText + ' '.repeat(boxWidth - 24 - tsText.length - 2) + '│'
  );

  if (tailscaleStatus.url) {
    const urlLabel = '\x1b[36m🌐 ' + tailscaleStatus.url + '\x1b[0m';
    // We print without alignment since the URL has ANSI codes
    console.log('│ ' + urlLabel + ' '.repeat(Math.max(1, boxWidth - 6 - tailscaleStatus.url.length - 1)) + '│');
  }

  console.log('╰' + line + '╯');
  console.log('');

  if (!daemonStatus) {
    console.log(cyan + '   Make sure the Webbridge daemon is running on port 10086.' + reset);
    console.log(cyan + '   Try: hwb start' + reset);
    console.log('');
  }
}

/**
 * Check command handler.
 * @returns {Promise<{ success: boolean, message: string }>}
 */
async function handler() {
  console.log(bold + '🔍 Checking WebBridge status...' + reset);

  const [daemonStatus, tailscaleStatus] = await Promise.all([
    fetchDaemonStatus(),
    fetchTailscaleStatus(),
  ]);

  printStatusBox(daemonStatus, tailscaleStatus);

  return { success: true, message: '' };
}

module.exports = { handler };
