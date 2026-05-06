/**
 * Orchestrator for AI PR Reviewer workflow.
 * Fetches PR diff, sanitizes it, and sends notification to OpenClaw via Telegram.
 * @module index
 */

import 'dotenv/config';
import { getSanitizedDiff } from './get-diff.js';
import { formatMessage, sendTelegramMessage } from './notify-claw.js';
import { GitHubAPIError, TelegramSendError, DiffSanitizationError } from './errors.js';

/**
 * Main orchestrator function
 * @returns {Promise<void>}
 */
async function main() {
  try {
    // Load and validate environment variables
    const githubToken = process.env.GITHUB_TOKEN;
    const telegramApiId = process.env.TELEGRAM_API_ID;
    const telegramApiHash = process.env.TELEGRAM_API_HASH;
    const openclawChatId = process.env.OPENCLAW_CHAT_ID;

    if (!githubToken) {
      throw new Error('GITHUB_TOKEN environment variable is required');
    }
    if (!telegramApiId) {
      throw new Error('TELEGRAM_API_ID environment variable is required');
    }
    if (!telegramApiHash) {
      throw new Error('TELEGRAM_API_HASH environment variable is required');
    }
    if (!openclawChatId) {
      throw new Error('OPENCLAW_CHAT_ID environment variable is required');
    }

    // Get PR URL from environment or command line
    const prUrl = process.env.PR_URL || process.argv[2];

    if (!prUrl) {
      console.error('❌ Error: PR_URL is required (from env or command line argument)');
      process.exit(1);
    }

    // Validate PR URL format
    if (!prUrl.includes('github.com') || !prUrl.includes('/pull/')) {
      console.error(`❌ Error: Invalid PR URL format: ${prUrl}`);
      process.exit(1);
    }

    console.log(`🚀 Starting PR review workflow for: ${prUrl}`);

    // Step 1: Fetch and sanitize the diff
    console.log('📥 Fetching and sanitizing diff...');
    const sanitizedDiff = await getSanitizedDiff(prUrl);

    if (!sanitizedDiff || sanitizedDiff.trim().length === 0) {
      console.log('⚠️ Empty diff, skipping notification');
      process.exit(0);
    }

    // Step 2: Format the message
    console.log('📝 Formatting message...');
    const message = formatMessage(prUrl, sanitizedDiff);

    // Step 3: Send Telegram notification
    console.log('📤 Sending notification to OpenClaw...');
    await sendTelegramMessage(message);

    console.log('✅ PR review request sent to OpenClaw');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);

    if (error instanceof GitHubAPIError) {
      console.error(`   Code: ${error.code}`);
      console.error(`   Details:`, error.details);
    } else if (error instanceof DiffSanitizationError) {
      console.error(`   Code: ${error.code}`);
      console.error(`   Details:`, error.details);
    } else if (error instanceof TelegramSendError) {
      console.error(`   Code: ${error.code}`);
      console.error(`   Details:`, error.details);
    } else {
      console.error(`   Stack: ${error.stack}`);
    }

    process.exit(1);
  }
}

// Run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}