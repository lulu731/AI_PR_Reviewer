/**
 * Send Telegram message to OpenClaw bot with PR URL.
 * @module notify-claw
 */

import 'dotenv/config';
import https from 'https';
import { TelegramSendError } from './errors.js';

const MAX_MESSAGE_LENGTH = 4096; // Telegram message limit

/**
 * Format message for OpenClaw agent
 * @param {string} prUrl - GitHub PR URL
 * @returns {string} Formatted message
 */
function formatMessage(prUrl) {
  const message = `🔍 New PR Review Request\n\nPR: ${prUrl}\n\nPlease review this PR and provide structured feedback.`;

  if (message.length > MAX_MESSAGE_LENGTH) {
    console.warn(`⚠️ Message length (${message.length}) exceeds Telegram limit, truncating...`);
    return message.substring(0, MAX_MESSAGE_LENGTH - 100) + '\n\n... [truncated]';
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

/**
 * Read stdin for piped input
 * @returns {Promise<string>}
 */
function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.on('data', (chunk) => {
      data += chunk;
    });
    process.stdin.on('end', () => {
      resolve(data.trim());
    });
    // If no stdin, resolve with empty string
    if (process.stdin.isTTY) {
      resolve('');
    }
  });
}

/**
 * Main function
 */
async function main() {
  try {
    // Try to get PR URL from stdin first (piped from get-diff.js), then env
    const pipedInput = await readStdin();
    const prUrl = pipedInput || process.env.PR_URL || process.argv[2];

    if (!prUrl) {
      console.error('❌ Error: PR_URL is required (from stdin, env, or command line argument)');
      process.exit(1);
    }

    // Validate it looks like a GitHub PR URL
    if (!prUrl.includes('github.com') || !prUrl.includes('/pull/')) {
      console.error(`❌ Error: Invalid PR URL format: ${prUrl}`);
      process.exit(1);
    }

    const message = formatMessage(prUrl);
    await sendTelegramMessage(message);

    console.log('✅ Notification sent to OpenClaw agent');
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error instanceof TelegramSendError) {
      console.error(`   Code: ${error.code}`);
      if (error.details) {
        console.error(`   Details:`, error.details);
      }
    }
    process.exit(1);
  }
}

// Run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export {
  formatMessage,
  sendTelegramMessage
};
