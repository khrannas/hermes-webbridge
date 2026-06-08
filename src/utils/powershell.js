'use strict';

const { execFile } = require('child_process');
const os = require('os');

/**
 * Run a PowerShell command and return { stdout, stderr, exitCode }.
 *
 * If the current platform is not Windows, prints a message and exits.
 * Uses child_process.execFile with a configurable timeout (default 30s).
 *
 * IMPORTANT: Do NOT use `$env:USERPROFILE` in commands — execFile does not
 * expand PowerShell environment variables. Use os.homedir() from Node instead
 * and embed the literal path in the command string.
 *
 * @param {string} command - The PowerShell command to execute
 * @param {{ timeout?: number }} [options] - Optional overrides
 * @returns {Promise<{ stdout: string, stderr: string, exitCode: number }>}
 */
async function runPowerShell(command, options = {}) {
  if (os.platform() !== 'win32') {
    console.log('\x1b[31mThis tool only runs on Windows.\x1b[0m');
    console.log('\x1b[36mCurrent platform: ' + os.platform() + '\x1b[0m');
    process.exit(1);
  }

  const timeout = options.timeout ?? 30000;

  return new Promise((resolve) => {
    const child = execFile(
      'powershell.exe',
      ['-NoProfile', '-Command', command],
      {
        timeout,
        maxBuffer: 1024 * 1024,
      },
      (error, stdout, stderr) => {
        let exitCode = 0;
        if (error) {
          // error.code is the process exit code when it's a number,
          // or a Node system error string when spawn itself failed.
          if (typeof error.code === 'number') {
            exitCode = error.code;
          } else if (error.killed) {
            // Process was killed (timeout)
            exitCode = 1;
          } else {
            exitCode = 1;
          }
        }
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
