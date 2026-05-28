'use strict';

const { execFile } = require('child_process');
const os = require('os');

/**
 * Run a PowerShell command and return { stdout, stderr, exitCode }.
 *
 * If the current platform is not Windows, prints a message and exits.
 * Uses child_process.execFile with a 30-second timeout.
 *
 * @param {string} command - The PowerShell command to execute
 * @returns {Promise<{ stdout: string, stderr: string, exitCode: number }>}
 */
async function runPowerShell(command) {
  if (os.platform() !== 'win32') {
    console.log('\x1b[31mThis tool only runs on Windows.\x1b[0m');
    console.log('\x1b[36mCurrent platform: ' + os.platform() + '\x1b[0m');
    process.exit(1);
  }

  return new Promise((resolve) => {
    const child = execFile(
      'powershell.exe',
      ['-NoProfile', '-Command', command],
      {
        timeout: 30000,
        maxBuffer: 1024 * 1024,
      },
      (error, stdout, stderr) => {
        const exitCode = error && error.code ? error.code : 0;
        resolve({
          stdout: (stdout || '').trim(),
          stderr: (stderr || '').trim(),
          exitCode,
        });
      }
    );
  });
}

module.exports = { runPowerShell };
