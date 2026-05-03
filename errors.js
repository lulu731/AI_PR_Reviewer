/**
 * Custom error classes for consistent error handling across the PR reviewer system.
 * @module errors
 */

/**
 * Base error class that extends the built-in Error class.
 */
class BaseError extends Error {
  /**
   * @param {string} code - Error code identifier
   * @param {string} message - Human-readable error message
   * @param {any} details - Additional error details (must not contain secrets)
   */
  constructor(code, message, details) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Error thrown when diff sanitization fails.
 */
class DiffSanitizationError extends BaseError {
  /**
   * @param {string} message - Error message
   * @param {any} details - Additional details
   */
  constructor(message, details) {
    super('DIFF_SANITIZATION_FAILED', message, details);
  }
}

/**
 * Error thrown when Telegram message sending fails.
 */
class TelegramSendError extends BaseError {
  /**
   * @param {string} message - Error message
   * @param {any} details - Additional details
   */
  constructor(message, details) {
    super('TELEGRAM_SEND_FAILED', message, details);
  }
}

/**
 * Error thrown when GitHub API calls fail.
 */
class GitHubAPIError extends BaseError {
  /**
   * @param {string} message - Error message
   * @param {any} details - Additional details
   */
  constructor(message, details) {
    super('GITHUB_API_FAILED', message, details);
  }
}

module.exports = {
  BaseError,
  DiffSanitizationError,
  TelegramSendError,
  GitHubAPIError
};