/**
 * Send Telegram message to OpenClaw bot with PR URL and diff.
 * @module notify-claw
 */

import 'dotenv/config';
import https from 'https';
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
  let message = `🔍 New PR Review Request\n\nPR: ${prUrl}\n\nDiff:\n\`\`\`diff\n`;

  // Add diff content
  const diffSection = sanitizedDiff || '(no diff available)';
  message += diffSection;
  message += '\n\`\`\`\n\nPlease review this PR and provide structured feedback.';

  // Check if message exceeds Telegram limit
  if (message.length > MAX_MESSAGE_LENGTH) {
    console.warn(`⚠️ Message length (${message.length}) exceeds Telegram limit, truncating diff...`);

    // Calculate available space for diff (reserve space for PR URL and formatting)
    const baseLength = `🔍 New PR Review Request\n\nPR: ${prUrl}\n\nDiff:\n\`\`\`diff\n\`\`\`\n\nPlease review this PR and provide structured feedback.`.length;
    const availableForDiff = MAX_MESSAGE_LENGTH - baseLength - 100; // 100 char buffer

    if (availableForDiff > 0) {
      const truncatedDiff = sanitizedDiff.substring(0, availableForDiff) + '\n... [truncated]';
      message = `🔍 New PR Review Request\n\nPR: ${prUrl}\n\nDiff:\n\`\`\`diff\n${truncatedDiff}\n\`\`\`\n\nPlease review this PR and provide structured feedback.`;
    } else {
      // If even base message is too long, truncate the entire message
      message = message.substring(0, MAX_MESSAGE_LENGTH - 100) + '\n\n... [truncated]';
    }
  }

  return message;
}

/**
 * Send message via Telegram Bot API using built-in https module
 * @param {string} message - Message text to send
 * @returns {Promise<void>}
 */
function sendTelegramMessage(message) {
  return new Promise((resolve, reject) => {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.OPENCLAW_CHAT_ID;

    if (!botToken) {
      reject(new TelegramSendError('TELEGRAM_BOT_TOKEN environment variable is required', {}));
      return;
    }

    if (!chatId) {
      reject(new TelegramSendError('OPENCLAW_CHAT_ID environment variable is required', {}));
      return;
    }

    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const postData = JSON.stringify({
      chat_id: chatId,
      text: message
    });

    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    console.log(`📤 Sending message to Telegram chat ${chatId}...`);

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);

          if (response.ok) {
            console.log('✅ Message sent to Telegram successfully');
            resolve();
          } else {
            reject(new TelegramSendError(`Telegram API error: ${response.description}`, {
              errorCode: response.error_code,
              description: response.description
            }));
          }
        } catch (parseError) {
          reject(new TelegramSendError(`Failed to parse Telegram response: ${parseError.message}`, {
            rawResponse: data
          }));
        }
      });
    });

    req.on('error', (error) => {
      reject(new TelegramSendError(`Failed to send Telegram message: ${error.message}`, {
        originalError: error.message
      }));
    });

    req.write(postData);
    req.end();
  });
}

export {
  formatMessage,
  sendTelegramMessage
};
