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
const EXTENSION_ID = 'fldmhceldgbpfpkbgopacenieobmligc';
const EXTENSION_URL = `https://chromewebstore.google.com/detail/kimi-webbridge/${EXTENSION_ID}`;

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
 * @returns {Promise<{ running: boolean, pid: number|null }>}
 */
async function checkDaemonRunning() {
  if (!fs.existsSync(PID_FILE)) {
    return { running: false, pid: null };
  }

  const pidStr = fs.readFileSync(PID_FILE, 'utf8').trim();
  const pid = Number(pidStr);
  if (!pid || Number.isNaN(pid)) {
    return { running: false, pid: null };
  }

  const alive = await isProcessAlive(pid);
  if (!alive) {
    return { running: false, pid: null };
  }

  const cmd = `netstat -ano | Select-String ':10086' | Select-String 'LISTENING'`;
  const result = await runPowerShell(cmd, { timeout: 5000 });
  const portBound = result.exitCode === 0 && result.stdout.length > 0;

  return { running: alive && portBound, pid };
}

/**
 * Check daemon logs for extension connection events.
 * @returns {{ connected: boolean, details: string }}
 */
function checkExtensionInLogs() {
  if (!fs.existsSync(LOG_FILE)) {
    return { connected: false, details: 'No log file found' };
  }

  const logs = fs.readFileSync(LOG_FILE, 'utf8');
  const lines = logs.split('\n');

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
 * @returns {{ installed: boolean, browser: string|null }}
 */
function checkExtensionInstalled() {
  const localAppData = path.join(os.homedir(), 'AppData', 'Local');

  const browsers = [
    { name: 'Chrome', base: path.join(localAppData, 'Google', 'Chrome', 'User Data') },
    { name: 'Edge', base: path.join(localAppData, 'Microsoft', 'Edge', 'User Data') },
  ];

  for (const { name, base } of browsers) {
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
  const urlMatch = stdout.match(/https?:\/\/[^\s]+/);
  const url = urlMatch ? urlMatch[0] : null;
  return { active, url };
}

/**
 * Print a clean status box.
 * @param {{ running: boolean, pid: number|null }} daemonState
 * @param {{ active: boolean, url: string|null }} tailscaleStatus
 * @param {{ installed: boolean, browser: string|null }} extensionState
 * @param {{ connected: boolean, details: string }} extensionLog
 */
function printStatusBox(daemonState, tailscaleStatus, extensionState, extensionLog) {
  const boxWidth = 52;
  const line = '─'.repeat(boxWidth - 2);

  console.log('');
  console.log('╭' + line + '╮');
  console.log('│  ' + bold + 'Hermes WebBridge Status' + reset + ' '.repeat(boxWidth - 24 - 2) + '│');
  console.log('├' + line + '┤');

  // Daemon row
  const runIcon = daemonState.running ? green + '✅' : red + '❌';
  const runText = 'running: ' + String(daemonState.running);
  console.log(
    '│ ' + runIcon + reset + ' Daemon        ' + runText + ' '.repeat(Math.max(1, boxWidth - 24 - runText.length - 2)) + '│'
  );
  if (daemonState.pid) {
    const pidStr = 'PID           ' + daemonState.pid;
    console.log('│    ' + pidStr + ' '.repeat(Math.max(1, boxWidth - 6 - pidStr.length - 2)) + '│');
  }

  // Extension row
  if (extensionState.installed) {
    const extIcon = extensionLog.connected ? green + '✅' : yellow + '⚠️';
    const extText = extensionLog.connected ? 'connected' : 'not connected';
    console.log('│ ' + extIcon + reset + ' Extension     ' + extText + ' '.repeat(Math.max(1, boxWidth - 24 - extText.length - 2)) + '│');
    const browserStr = 'Browser       ' + extensionState.browser;
    console.log('│    ' + browserStr + ' '.repeat(Math.max(1, boxWidth - 6 - browserStr.length - 2)) + '│');
  } else {
    console.log('│ ' + red + '❌' + reset + ' Extension     not installed' + ' '.repeat(Math.max(1, boxWidth - 36)) + '│');
  }

  // Tailscale row
  const tsIcon = tailscaleStatus.active ? green + '✅' : red + '❌';
  const tsText = 'serve ' + (tailscaleStatus.active ? 'active' : 'inactive');
  console.log('│ ' + tsIcon + reset + ' Tailscale     ' + tsText + ' '.repeat(Math.max(1, boxWidth - 24 - tsText.length - 2)) + '│');

  if (tailscaleStatus.url) {
    const urlLabel = '\x1b[36m🌐 ' + tailscaleStatus.url + '\x1b[0m';
    console.log('│ ' + urlLabel + ' '.repeat(Math.max(1, boxWidth - 6 - tailscaleStatus.url.length - 1)) + '│');
  }

  console.log('╰' + line + '╯');
  console.log('');

  // Guidance
  if (!daemonState.running) {
    console.log(cyan + '   Daemon not running. Try: hwb start' + reset);
    console.log('');
  }
  if (!extensionState.installed) {
    console.log(cyan + '   Extension not installed:' + reset);
    console.log(cyan + '   ' + EXTENSION_URL + reset);
    console.log('');
  } else if (!extensionLog.connected) {
    console.log(cyan + '   Extension installed but not connected.' + reset);
    console.log(cyan + '   Open ' + extensionState.browser + ' and click the WebBridge toolbar icon.' + reset);
    console.log('');
  }
}

/**
 * Check command handler.
 * @returns {Promise<{ success: boolean, message: string }>}
 */
async function handler() {
  console.log(bold + '🔍 Checking WebBridge status...' + reset);

  const [daemonState, tailscaleStatus] = await Promise.all([
    checkDaemonRunning(),
    fetchTailscaleStatus(),
  ]);

  const extensionState = checkExtensionInstalled();
  const extensionLog = checkExtensionInLogs();

  printStatusBox(daemonState, tailscaleStatus, extensionState, extensionLog);

  return { success: true, message: '' };
}

module.exports = { handler };
