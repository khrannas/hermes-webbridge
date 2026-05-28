'use strict';

const startCmd = require('./start.js');
const checkCmd = require('./check.js');

const green = '\x1b[32m';
const bold = '\x1b[1m';
const reset = '\x1b[0m';

/**
 * Recover command handler.
 * Runs start + verification, same as start but with check at the end.
 * @returns {Promise<{ success: boolean, message: string }>}
 */
async function handler() {
  console.log(bold + '🔄 Full post-restart recovery...' + reset);
  console.log('');

  // Step 1: Run start logic
  const startResult = await startCmd.handler();
  if (!startResult.success) {
    console.log('');
    console.log(bold + '❌ Recovery failed at start step' + reset);
    return { success: false, message: '' };
  }

  // Step 2: Run check/verification
  console.log('');
  console.log(bold + '✅ Verifying recovery...' + reset);
  await checkCmd.handler();

  console.log(green + '✅ Recovery complete' + reset);
  return { success: true, message: '' };
}

module.exports = { handler };
