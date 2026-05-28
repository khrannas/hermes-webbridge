'use strict';

const { runPowerShell } = require('../utils/powershell.js');

const green = '\x1b[32m';
const red = '\x1b[31m';
const cyan = '\x1b[36m';
const bold = '\x1b[1m';
const reset = '\x1b[0m';

/**
 * Check if the Webbridge daemon binary exists.
 * @returns {Promise<boolean>}
 */
async function daemonBinaryExists() {
  const cmd =
    'Test-Path "$env:USERPROFILE\\.kimi-webbridge\\bin\\kimi-webbridge.exe"';
  const result = await runPowerShell(cmd);
  return result.stdout === 'True';
}

/**
 * Start the Webbridge daemon on port 10086.
 * @returns {Promise<boolean>}
 */
async function startDaemon() {
  const cmd =
    '& "$env:USERPROFILE\\.kimi-webbridge\\bin\\kimi-webbridge.exe" start --addr 0.0.0.0:10086';
  const result = await runPowerShell(cmd);
  return result.exitCode === 0;
}

/**
 * Wait for a given number of milliseconds.
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Enable Tailscale Serve for the Webbridge port.
 * @returns {Promise<boolean>}
 */
async function enableTailscaleServe() {
  const cmd = 'tailscale serve --bg --https=0 http://127.0.0.1:10086';
  const result = await runPowerShell(cmd);
  return result.exitCode === 0;
}

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
 * Print the daemon status summary.
 * @param {object|null} status
 */
function printStatus(status) {
  console.log('');
  console.log(bold + 'WebBridge Status' + reset);
  console.log('');

  if (status) {
    const running = status.running === true || status.running === 'true';
    const connected =
      status.extension_connected === true ||
      status.extension_connected === 'true';

    console.log(
      (running ? green + '✅' : red + '❌') +
        reset +
        ' Daemon        running:' +
        String(running)
    );
    if (status.port) {
      console.log('    Port          ' + status.port);
    }
    if (status.uptime) {
      console.log('    Uptime        ' + status.uptime);
    }
    console.log(
      (connected ? green + '✅' : red + '❌') +
        reset +
        ' Extension     connected:' +
        String(connected)
    );
  } else {
    console.log(red + '❌ Daemon is not reachable at http://127.0.0.1:10086' + reset);
    console.log(
      cyan +
        '   Make sure the daemon is running and port 10086 is accessible.' +
        reset
    );
  }
}

/**
 * Start command handler.
 * @returns {Promise<{ success: boolean, message: string }>}
 */
async function handler() {
  console.log(bold + '🔧 Starting Kimi WebBridge...' + reset);
  console.log('');

  // Step 1: Check binary exists
  const exists = await daemonBinaryExists();
  if (!exists) {
    console.log(
      red +
        '❌ Daemon binary not found at $env:USERPROFILE\\.kimi-webbridge\\bin\\kimi-webbridge.exe' +
        reset
    );
    console.log('');
    console.log('To install the Webbridge daemon:');
    console.log(
      '  1. Download Kimi WebBridge from https://kimi.com/download'
    );
    console.log('  2. Extract to %USERPROFILE%\\.kimi-webbridge\\');
    console.log(
      '  3. Make sure kimi-webbridge.exe is in %USERPROFILE%\\.kimi-webbridge\\bin\\'
    );
    console.log('');
    console.log(cyan + '   Run this command again after installing.' + reset);
    return { success: false, message: '' };
  }
  console.log(green + '✅ Daemon binary found' + reset);

  // Step 2: Start the daemon
  console.log(cyan + 'ℹ️  Starting daemon on 0.0.0.0:10086...' + reset);
  const daemonStarted = await startDaemon();
  if (!daemonStarted) {
    console.log(red + '❌ Failed to start daemon' + reset);
    return { success: false, message: '' };
  }
  console.log(green + '✅ Daemon start command issued' + reset);

  // Step 3: Wait for daemon to initialize
  console.log(cyan + 'ℹ️  Waiting for daemon to initialize...' + reset);
  await sleep(3000);

  // Step 4: Enable Tailscale Serve
  console.log(cyan + 'ℹ️  Enabling Tailscale Serve...' + reset);
  const tailscaleOk = await enableTailscaleServe();
  if (!tailscaleOk) {
    console.log(red + '❌ Failed to enable Tailscale Serve' + reset);
    return { success: false, message: '' };
  }
  console.log(green + '✅ Tailscale Serve enabled' + reset);

  // Step 5: Wait for Tailscale
  await sleep(2000);

  // Step 6: Check status
  console.log(cyan + 'ℹ️  Checking daemon status...' + reset);
  const status = await fetchDaemonStatus();
  printStatus(status);

  console.log('');
  console.log(green + '✅ Start complete' + reset);

  return { success: true, message: '' };
}

module.exports = { handler };
