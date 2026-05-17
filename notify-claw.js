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
 * Create and configure a TDLib client using environment credentials.
 * Shared factory for both sendTelegramMessage and addChatIdMode.
 * @returns {object} Configured TDLib client instance
 */
function createClient() {
  tdl.configure({ tdjson: getTdjson() });

  const client = tdl.createClient({
    apiId: parseInt(process.env.TELEGRAM_API_ID, 10),
    apiHash: process.env.TELEGRAM_API_HASH,
    databaseDirectory: process.env.TDL_DATABASE_DIR || '_td_database',
    filesDirectory: process.env.TDL_FILES_DIR || '_td_files',
    tdlibParameters: {
      use_message_database: true,
      use_secret_chats: true,
      system_language_code: 'en',
      application_version: '1.0',
      device_model: 'Unknown device',
      system_version: 'Unknown',
      enable_storage_optimizer: true
    }
  });

  client.on('error', (err) => {
    console.error('TDLib client error:', err);
  });

  return client;
}

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
  message += '\n```\n\nReview this PR and provide structured feedback. Use ai-pr-reviewer skill.';

  // Check if message exceeds Telegram limit
  if (message.length > MAX_MESSAGE_LENGTH) {
    console.warn(`⚠️ Message length (${message.length}) exceeds Telegram limit, truncating diff...`);

    // Calculate available space for diff (reserve space for PR URL and formatting)
    const baseLength = '🔍 New PR Review Request\n\nPR: \n\nDiff:\n```diff\n```\n\nReview this PR and provide structured feedback. Use ai-pr-reviewer skill.'.length + prUrl.length;
    const availableForDiff = MAX_MESSAGE_LENGTH - baseLength - 100; // 100 char buffer

    if (availableForDiff > 0) {
      const truncatedDiff = sanitizedDiff.substring(0, availableForDiff) + '\n... [truncated]';
      message = '🔍 New PR Review Request\n\nPR: ' + prUrl + '\n\nDiff:\n```diff\n' + truncatedDiff + '\n```\n\nReview this PR and provide structured feedback. Use ai-pr-reviewer skill.';
    } else {
      // If even base message is too long, truncate the entire message
      message = message.substring(0, MAX_MESSAGE_LENGTH - 100) + '\n\n... [truncated]';
    }
  }

  return message;
}

/**
 * Resolve chat ID from string (numeric or @username)
 * @param {object} client - TDLib client instance
 * @param {string} chatIdStr - Chat ID string (numeric or @username)
 * @returns {Promise<number>} Numeric chat ID
 */
async function resolveChatId(client, chatIdStr) {
  // If it's numeric, parse and return
  if (/^\d+$/.test(chatIdStr)) {
    return parseInt(chatIdStr, 10);
  }

  // If it starts with @, it's a username - search for public chat
  if (chatIdStr.startsWith('@')) {
    const username = chatIdStr.substring(1);
    console.log(`🔍 Resolving chat username: ${username}...`);

    try {
      const chat = await client.invoke({
        _: 'searchPublicChat',
        username: username
      });

      if (chat && chat.id) {
        console.log(`✅ Resolved @${username} to chat ID: ${chat.id}`);
        return chat.id;
      }
      throw new Error(`Chat not found for username: ${username}`);
    } catch (error) {
      throw new TelegramSendError(`Failed to resolve chat username: ${error.message}`, {
        username: username
      });
    }
  }

  // Try to parse as number anyway (handles string numbers)
  const parsed = parseInt(chatIdStr, 10);
  if (!isNaN(parsed)) {
    return parsed;
  }

  throw new TelegramSendError(`Invalid chat ID format: ${chatIdStr}. Must be numeric or @username.`, {
    chatId: chatIdStr
  });
}

/**
 * Send message via Telegram using tdl (user client, not bot API)
 * @param {string} message - Message text to send
 * @returns {Promise<void>}
 */
async function sendTelegramMessage(message) {
  const apiId = process.env.TELEGRAM_API_ID;
  const apiHash = process.env.TELEGRAM_API_HASH;
  const chatIdStr = process.env.OPENCLAW_CHAT_ID;

  if (!apiId) {
    throw new TelegramSendError('TELEGRAM_API_ID environment variable is required', {});
  }

  if (!apiHash) {
    throw new TelegramSendError('TELEGRAM_API_HASH environment variable is required', {});
  }

  if (!chatIdStr) {
    throw new TelegramSendError('OPENCLAW_CHAT_ID environment variable is required', {});
  }

  // Create client using shared factory
  const client = createClient();

  try {
    console.log('📤 Logging in to Telegram as user...');
    await client.login();

    // Resolve chat ID (handles both numeric and @username formats)
    const chatId = await resolveChatId(client, chatIdStr);

    console.log(`📤 Sending message to chat ${chatId}...`);

    //const chats = await client.invoke({
    //_: 'getChats',
    //chat_list: { _: 'chatListMain' },
    //limit: 10
    //})

    //console.log('A part of my chat list:', chats);

    // Send message using TDLib sendMessage method
    await client.invoke({
      _: 'sendMessage',
      chat_id: chatId,
      input_message_content: {
        _: 'inputMessageText',
        text: {
          _: 'formattedText',
          text: message
        }
      }
    });

    client.on('update', update => {
      if (update._ === 'updateMessageSendSucceeded') {
        console.log ('✅ Message sent to Telegram successfully');
      }
    });

  } catch (error) {

    if (error instanceof tdl.TdlError) {
      throw new TelegramSendError(`TDLib error: ${error.message}`, {
        code: error.code,
        message: error.message
      });
    }
    throw new TelegramSendError(`Failed to send Telegram message : ${error.message}`, {
      originalError: error.message
    });
  }
}

/**
 * Capture a Telegram chat ID by listening for incoming messages.
 * Connects to Telegram, waits for a message, extracts chat_id, and displays it.
 * @returns {Promise<void>}
 */
async function addChatIdMode() {
  const client = createClient();
  let timeoutId = null;
  let sigintHandler = null;

  try {
    console.log('🔑 Connecting to Telegram...');
    await client.login();

    console.log('Waiting for message...');

    // Set a 60-second timeout
    timeoutId = setTimeout(() => {
      console.log('⚠️ Timeout: No message received within 60 seconds.');
      process.exit(0);
    }, 60000);

    // Handle Ctrl+C gracefully
    sigintHandler = () => {
      console.log('\n⚠️ Cancelled by user.');
      clearTimeout(timeoutId);
      client.close().then(() => process.exit(0)).catch(() => process.exit(0));
    };
    process.on('SIGINT', sigintHandler);

    // Listen for incoming messages - resolve on first updateNewMessage
    await new Promise((resolve) => {
      client.on('update', (update) => {
        if (update._ === 'updateNewMessage') {
          const chatId = update.message.chat_id;
          clearTimeout(timeoutId);
          console.log(`Chat ID captured: ${chatId}`);
          resolve();
        }
      });
    });
  } catch (error) {
    if (error instanceof tdl.TdlError) {
      throw new TelegramSendError(`TDLib error: ${error.message}`, {
        code: error.code,
        message: error.message
      });
    }
    throw error;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    if (sigintHandler) {
      process.removeListener('SIGINT', sigintHandler);
    }
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
  sendTelegramMessage,
  createClient,
  addChatIdMode
};