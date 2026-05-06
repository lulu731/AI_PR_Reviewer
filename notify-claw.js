/**
 * Send Telegram message to OpenClaw as a Telegram user using tdl (eilvelia/tdl).
 * @module notify-claw
 */

import 'dotenv/config';
import tdl from 'tdl';
import prebuiltTdlib from 'prebuilt-tdlib';
const { getTdjson } = prebuiltTdlib;
import { TelegramSendError } from './errors.js';

const MAX_MESSAGE_LENGTH = 4096; // Telegram message limit

/**
 * Format message for OpenClaw agent with PR URL and sanitized diff
 * @param {string} prUrl - GitHub PR URL
 * @param {string} sanitizedDiff - Sanitized diff content
 * @returns {string} Formatted message
 */
function formatMessage(prUrl, sanitizedDiff) {
  // Start with PR URL (must be kept intact)
  let message = '🔍 New PR Review Request\n\nPR: ' + prUrl + '\n\nDiff:\n```diff\n';

  // Add diff content
  const diffSection = sanitizedDiff || '(no diff available)';
  message += diffSection;
  message += '\n```\n\nReview this PR and provide structured feedback.';

  // Check if message exceeds Telegram limit
  if (message.length > MAX_MESSAGE_LENGTH) {
    console.warn(`⚠️ Message length (${message.length}) exceeds Telegram limit, truncating diff...`);

    // Calculate available space for diff (reserve space for PR URL and formatting)
    const baseLength = '🔍 New PR Review Request\n\nPR: \n\nDiff:\n```diff\n```\n\nReview this PR and provide structured feedback.'.length + prUrl.length;
    const availableForDiff = MAX_MESSAGE_LENGTH - baseLength - 100; // 100 char buffer

    if (availableForDiff > 0) {
      const truncatedDiff = sanitizedDiff.substring(0, availableForDiff) + '\n... [truncated]';
      message = '🔍 New PR Review Request\n\nPR: ' + prUrl + '\n\nDiff:\n```diff\n' + truncatedDiff + '\n```\n\nReview this PR and provide structured feedback.';
    } else {
      // If even base message is too long, truncate the entire message
      message = message.substring(0, MAX_MESSAGE_LENGTH - 100) + '\n\n... [truncated]';
    }
  }

  return message;
}

/**
 * Send message via Telegram using tdl (user client, not bot API)
 * @param {string} message - Message text to send
 * @returns {Promise<void>}
 */
async function sendTelegramMessage(message) {
  const apiId = process.env.TELEGRAM_API_ID;
  const apiHash = process.env.TELEGRAM_API_HASH;
  const chatId = process.env.OPENCLAW_CHAT_ID;

  if (!apiId) {
    throw new TelegramSendError('TELEGRAM_API_ID environment variable is required', {});
  }

  if (!apiHash) {
    throw new TelegramSendError('TELEGRAM_API_HASH environment variable is required', {});
  }

  if (!chatId) {
    throw new TelegramSendError('OPENCLAW_CHAT_ID environment variable is required', {});
  }

  // Configure tdl with prebuilt-tdlib
  tdl.configure({ tdjson: getTdjson() });

  // Create client with API credentials
  const client = tdl.createClient({
    apiId: parseInt(apiId, 10),
    apiHash: apiHash,
    databaseDirectory: process.env.TDL_DATABASE_DIR || '_td_database',
    filesDirectory: process.env.TDL_FILES_DIR || '_td_files'
  });

  client.on('error', (err) => {
    console.error('TDLib client error:', err);
  });

  try {
    console.log('📤 Logging in to Telegram as user...');
    await client.login();

    console.log(`📤 Sending message to chat ${chatId}...`);

    // Send message using TDLib sendMessage method
    await client.invoke({
      _: 'sendMessage',
      chat_id: parseInt(chatId, 10),
      input_message_content: {
        _: 'inputMessageText',
        text: {
          _: 'formattedText',
          text: message
        }
      }
    });

    console.log('✅ Message sent to Telegram successfully');
  } catch (error) {
    if (error instanceof tdl.TDLibError) {
      throw new TelegramSendError(`TDLib error: ${error.message}`, {
        code: error.code,
        message: error.message
      });
    }
    throw new TelegramSendError(`Failed to send Telegram message: ${error.message}`, {
      originalError: error.message
    });
  } finally {
    // Gracefully close the client
    try {
      await client.close();
      console.log('✅ Telegram client closed');
    } catch (closeError) {
      console.error('Warning: Failed to close TDLib client gracefully:', closeError.message);
    }
  }
}

export {
  formatMessage,
  sendTelegramMessage
};