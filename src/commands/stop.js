'use strict';

const os = require('os');
const path = require('path');
const fs = require('fs');
const { runPowerShell } = require('../utils/powershell.js');

const green = '\x1b[32m';
const red = '\x1b[31m';
const cyan = '\x1b[36m';
const bold = '\x1b[1m';
const reset = '\x1b[0m';

const HOME_DIR = os.homedir();
const WB_DIR = path.join(HOME_DIR, '.kimi-webbridge');
const DAEMON_BIN = path.join(WB_DIR, 'bin', 'kimi-webbridge.exe');
const PID_FILE = path.join(WB_DIR, 'daemon.pid');

/**
 * Try native stop command first. Returns true if it worked.
 * @returns {Promise<boolean>}
 */
async function nativeStop() {
  const cmd = `& "${DAEMON_BIN}" stop`;
  const result = await runPowerShell(cmd);
  return result.exitCode === 0 && !result.stderr;
}

/**
 * Force-kill the daemon by PID from the PID file.
 * @returns {Promise<boolean>}
 */
async function forceKill() {
  if (!fs.existsSync(PID_FILE)) {
    return false;
  }

  const pidStr = fs.readFileSync(PID_FILE, 'utf8').trim();
  const pid = Number(pidStr);
  if (!pid || Number.isNaN(pid)) {
    return false;
  }

  const cmd = `Stop-Process -Id ${pid} -Force -ErrorAction SilentlyContinue`;
  const result = await runPowerShell(cmd);
  if (result.exitCode !== 0) {
    return false;
  }

  // Clean up PID file
  try { fs.unlinkSync(PID_FILE); } catch { /* ignore */ }
  return true;
}

/**
 * Stop command handler.
 * @returns {Promise<{ success: boolean, message: string }>}
 */
async function handler() {
  console.log(bold + '🛑 Stopping Kimi WebBridge daemon...' + reset);
  console.log('');

  // Step 1: Try native stop
  console.log(cyan + 'ℹ️  Sending stop command...' + reset);
  const nativeOk = await nativeStop();
  if (nativeOk) {
    console.log(green + '✅ Daemon stopped successfully' + reset);
    return { success: true, message: '' };
  }

  // Step 2: Native stop failed (common — daemon uses CDP, not HTTP).
  // Fall back to force-kill.
  console.log(cyan + 'ℹ️  Native stop failed (daemon may not respond to HTTP). Force-killing...' + reset);
  const killed = await forceKill();
  if (killed) {
    console.log(green + '✅ Daemon force-killed' + reset);
    return { success: true, message: '' };
  }

  console.log(red + '❌ Failed to stop daemon' + reset);
  console.log(cyan + '   No PID file found. Daemon may not be running.' + reset);
  return { success: false, message: '' };
}

module.exports = { handler };
