'use strict';

const os = require('os');
const path = require('path');
const fs = require('fs');
const { runPowerShell } = require('../utils/powershell.js');

const green = '\x1b[32m';
const red = '\x1b[31m';
const yellow = '\x1b[33m';
const cyan = '\x1b[36m';
const bold = '\x1b[1m';
const reset = '\x1b[0m';

const HOME_DIR = os.homedir();
const WB_DIR = path.join(HOME_DIR, '.kimi-webbridge');
const DAEMON_BIN = path.join(WB_DIR, 'bin', 'kimi-webbridge.exe');
const PID_FILE = path.join(WB_DIR, 'daemon.pid');
const LOG_FILE = path.join(WB_DIR, 'logs', 'daemon.log');

/** Extension ID for Kimi WebBridge in Chrome/Edge. */
const EXTENSION_ID = 'fldmhceldgbpfpkbgopacenieobmligc';
/** Chrome Web Store URL. */
const EXTENSION_URL = `https://chromewebstore.google.com/detail/kimi-webbridge/${EXTENSION_ID}`;

/** Max attempts to check daemon readiness after start. */
const MAX_READY_ATTEMPTS = 10;
/** Delay between readiness checks in ms. */
const READY_CHECK_DELAY = 1500;

/**
 * Check if the Webbridge daemon binary exists.
 * @returns {Promise<boolean>}
 */
async function daemonBinaryExists() {
  const cmd = `Test-Path "${DAEMON_BIN}"`;
  const result = await runPowerShell(cmd);
  return result.stdout === 'True';
}

/**
 * Query daemon status using the native CLI.
 * @returns {Promise<{ running: boolean, pid?: number, note?: string } | null>}
 */
async function getNativeStatus() {
  const cmd = `& "${DAEMON_BIN}" status`;
  const result = await runPowerShell(cmd, { timeout: 10000 });
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
 * Check if a process with the given PID is alive.
 * @param {number} pid
 * @returns {Promise<boolean>}
 */
async function isProcessAlive(pid) {
  const cmd = `Get-Process -Id ${pid} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id`;
  const result = await runPowerShell(cmd, { timeout: 5000 });
  return result.stdout === String(pid);
}

/**
 * Check if daemon is running by verifying PID file + process alive + port bound.
 * The native CLI's `running` field relies on an internal HTTP probe that always
 * fails on Windows (daemon uses CDP, not plain HTTP), so we check directly.
 * @returns {Promise<boolean>}
 */
async function isDaemonRunning() {
  if (!fs.existsSync(PID_FILE)) {
    return false;
  }

  const pidStr = fs.readFileSync(PID_FILE, 'utf8').trim();
  const pid = Number(pidStr);
  if (!pid || Number.isNaN(pid)) {
    return false;
  }

  const alive = await isProcessAlive(pid);
  if (!alive) {
    return false;
  }

  const cmd = `netstat -ano | Select-String ':10086' | Select-String 'LISTENING'`;
  const result = await runPowerShell(cmd, { timeout: 5000 });
  return result.exitCode === 0 && result.stdout.length > 0;
}

/**
 * Remove stale PID file if the referenced process is dead.
 * @returns {Promise<void>}
 */
async function cleanStalePidFile() {
  if (!fs.existsSync(PID_FILE)) {
    return;
  }

  const pidStr = fs.readFileSync(PID_FILE, 'utf8').trim();
  const pid = Number(pidStr);

  if (!pid || Number.isNaN(pid)) {
    fs.unlinkSync(PID_FILE);
    console.log(cyan + 'ℹ️  Removed corrupt PID file' + reset);
    return;
  }

  const alive = await isProcessAlive(pid);
  if (!alive) {
    fs.unlinkSync(PID_FILE);
    console.log(cyan + `ℹ️  Cleaned stale PID file (dead process ${pid})` + reset);
  }
}

/**
 * Check for a Windows port proxy rule on port 10086.
 * A stale portproxy (from a previous setup) causes IP Helper (iphlpsvc)
 * to bind 0.0.0.0:10086, which blocks the daemon and intercepts
 * extension connections. Warns the user and provides the fix command.
 * @returns {Promise<boolean>} true if a conflicting proxy was found
 */
async function checkAndWarnPortProxy() {
  const cmd = 'netsh interface portproxy show v4tov4';
  const result = await runPowerShell(cmd, { timeout: 10000 });
  if (result.exitCode !== 0 || !result.stdout) {
    return false;
  }

  const hasProxy = result.stdout.includes('10086');
  if (!hasProxy) {
    return false;
  }

  console.log(
    yellow + '⚠️  Windows port proxy detected on port 10086 (IP Helper service).' + reset
  );
  console.log(
    yellow + '   This blocks the daemon from binding and prevents extension connection.' + reset
  );
  console.log('');
  console.log('   Fix (run in an elevated terminal):');
  console.log(
    cyan + '   netsh interface portproxy delete v4tov4 listenaddress=0.0.0.0 listenport=10086' + reset
  );
  console.log('');

  return true;
}

/**
 * Start the Webbridge daemon on port 10086.
 * @returns {Promise<boolean>}
 */
async function startDaemon() {
  const cmd = `& "${DAEMON_BIN}" start --addr 0.0.0.0:10086`;
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
 * Wait for daemon to become ready by checking PID + port binding.
 * @returns {Promise<boolean>}
 */
async function waitForDaemon() {
  for (let attempt = 1; attempt <= MAX_READY_ATTEMPTS; attempt++) {
    await sleep(READY_CHECK_DELAY);

    const running = await isDaemonRunning();
    if (running) {
      return true;
    }
    if (attempt < MAX_READY_ATTEMPTS) {
      process.stdout.write('.');
    }
  }
  return false;
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
 * Check daemon logs for extension connection events.
 * Looks for patterns like "extension connected" or "extension_connect".
 * @returns {{ connected: boolean, details: string }}
 */
function checkExtensionInLogs() {
  if (!fs.existsSync(LOG_FILE)) {
    return { connected: false, details: 'No log file found' };
  }

  const logs = fs.readFileSync(LOG_FILE, 'utf8');
  const lines = logs.split('\n');

  // Check for extension connection indicators
  const connectedPatterns = [
    /extension.*connect/i,
    /client.*connect/i,
    /browser.*connect/i,
    /ws.*connect/i,
    /websocket.*open/i,
    /handshake/i,
  ];

  for (const line of lines) {
    for (const pattern of connectedPatterns) {
      if (pattern.test(line)) {
        return { connected: true, details: line.trim() };
      }
    }
  }

  return { connected: false, details: 'No extension connection event in logs' };
}

/**
 * Check if the WebBridge browser extension is installed.
 * Checks Chrome and Edge extension directories.
 * @returns {{ installed: boolean, browser: string|null }}
 */
function checkExtensionInstalled() {
  const localAppData = path.join(os.homedir(), 'AppData', 'Local');

  const paths = [
    { browser: 'Chrome', dir: path.join(localAppData, 'Google', 'Chrome', 'User Data', 'Default', 'Extensions', EXTENSION_ID) },
    { browser: 'Edge', dir: path.join(localAppData, 'Microsoft', 'Edge', 'User Data', 'Default', 'Extensions', EXTENSION_ID) },
  ];

  // Check all browser profiles (Default, Profile 1, Profile 2, etc.)
  for (const { name, base } of [
    { name: 'Chrome', base: path.join(localAppData, 'Google', 'Chrome', 'User Data') },
    { name: 'Edge', base: path.join(localAppData, 'Microsoft', 'Edge', 'User Data') },
  ]) {
    try {
      const entries = fs.readdirSync(base);
      for (const entry of entries) {
        if (entry.startsWith('Profile ') || entry === 'Default') {
          const extPath = path.join(base, entry, 'Extensions', EXTENSION_ID);
          if (fs.existsSync(extPath)) {
            return { installed: true, browser: name };
          }
        }
      }
    } catch {
      // Directory doesn't exist
    }
  }

  return { installed: false, browser: null };
}

/**
 * Print the daemon status summary using native CLI status + direct checks.
 * @param {object|null} status - Parsed JSON from kimi-webbridge status
 */
async function printStatus(status) {
  console.log('');
  console.log(bold + 'WebBridge Status' + reset);
  console.log('');

  const actuallyRunning = await isDaemonRunning();

  if (status || actuallyRunning) {
    const icon = actuallyRunning ? green + '✅' : yellow + '⚠️';
    console.log(icon + reset + ' Daemon        running: ' + String(actuallyRunning));

    if (status && status.pid) {
      console.log('    PID           ' + status.pid);
    }
  } else {
    console.log(red + '❌ Daemon is not running' + reset);
    console.log(cyan + '   Try: hwb start' + reset);
  }

  // Extension status
  const extInstalled = checkExtensionInstalled();
  const extLog = checkExtensionInLogs();

  if (extInstalled.installed) {
    const extIcon = extLog.connected ? green + '✅' : yellow + '⚠️';
    const extText = extLog.connected ? 'connected' : 'installed but not connected';
    console.log(extIcon + reset + ' Extension     ' + extText);
    console.log('    Browser       ' + extInstalled.browser);
  } else {
    console.log(red + '❌ Extension   not installed' + reset);
    console.log(cyan + '    Install:  ' + EXTENSION_URL + reset);
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
      red + `❌ Daemon binary not found at ${DAEMON_BIN}` + reset
    );
    console.log('');
    console.log('To install the Webbridge daemon:');
    console.log('  1. Download Kimi WebBridge from https://kimi.com/download');
    console.log('  2. Extract to %USERPROFILE%\\.kimi-webbridge\\');
    console.log('  3. Make sure kimi-webbridge.exe is in %USERPROFILE%\\.kimi-webbridge\\bin\\');
    console.log('');
    console.log(cyan + '   Run this command again after installing.' + reset);
    return { success: false, message: '' };
  }
  console.log(green + '✅ Daemon binary found' + reset);

  // Step 2: Check for stale Windows port proxy on port 10086
  await checkAndWarnPortProxy();

  // Step 3: Check if already running
  const alreadyRunning = await isDaemonRunning();
  if (alreadyRunning) {
    console.log(cyan + 'ℹ️  Daemon already running on port 10086' + reset);
  } else {
    // Step 3: Clean stale PID file before starting
    await cleanStalePidFile();

    // Step 4: Start the daemon
    console.log(cyan + 'ℹ️  Starting daemon on 0.0.0.0:10086...' + reset);
    const daemonStarted = await startDaemon();
    if (!daemonStarted) {
      console.log(red + '❌ Failed to start daemon' + reset);
      return { success: false, message: '' };
    }
    console.log(green + '✅ Daemon start command issued' + reset);

    // Step 5: Wait for daemon to become ready
    process.stdout.write(cyan + 'ℹ️  Waiting for daemon to initialize' + reset);
    const ready = await waitForDaemon();
    console.log('');
    if (!ready) {
      console.log(yellow + '⚠️  Daemon process started but status check timed out' + reset);
      console.log(cyan + '   Check logs: ' + path.join(WB_DIR, 'logs') + reset);

      const logFile = LOG_FILE;
      if (fs.existsSync(logFile)) {
        console.log(cyan + '   Recent logs:' + reset);
        const logs = fs.readFileSync(logFile, 'utf8').trim().split('\n').slice(-5);
        for (const line of logs) {
          console.log('   ' + line);
        }
      }
    } else {
      console.log(green + '✅ Daemon is ready' + reset);
    }
  }

  // Step 6: Enable Tailscale Serve
  console.log(cyan + 'ℹ️  Enabling Tailscale Serve...' + reset);
  const tailscaleOk = await enableTailscaleServe();
  if (!tailscaleOk) {
    console.log(red + '❌ Failed to enable Tailscale Serve' + reset);
    return { success: false, message: '' };
  }
  console.log(green + '✅ Tailscale Serve enabled' + reset);

  // Step 7: Show status (daemon + extension)
  console.log(cyan + 'ℹ️  Checking status...' + reset);
  const nativeStatus = await getNativeStatus();
  await printStatus(nativeStatus);

  // Step 8: Extension guidance
  const extInstalled = checkExtensionInstalled();
  if (!extInstalled.installed) {
    console.log('');
    console.log(yellow + '⚠️  Kimi WebBridge extension is not installed in Chrome or Edge.' + reset);
    console.log(cyan + '   Install it from:' + reset);
    console.log(cyan + '   ' + EXTENSION_URL + reset);
    console.log('');
  } else if (!checkExtensionInLogs().connected) {
    console.log('');
    console.log(yellow + '⚠️  Extension installed but not connected to daemon yet.' + reset);
    console.log(cyan + '   Open ' + extInstalled.browser + ' and click the WebBridge icon in the toolbar.' + reset);
    console.log(cyan + '   It should show "Connected" when paired with the daemon.' + reset);
    console.log('');
  }

  console.log(green + '✅ Start complete' + reset);

  return { success: true, message: '' };
}

module.exports = { handler };
