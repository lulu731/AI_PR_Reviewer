/**
 * Fetch PR diff from GitHub and output sanitized version.
 * @module get-diff
 */

import 'dotenv/config';
import { Octokit } from '@octokit/rest';
import { GitHubAPIError, DiffSanitizationError } from './errors.js';

// Secret redaction patterns
const SECRET_PATTERNS = [
  /AKIA[0-9A-Z]{16}/g,           // AWS API keys
  /ghp_[a-zA-Z0-9]{36}/g,        // GitHub personal access tokens
  /glpat-[a-zA-Z0-9\-_]{20}/g,   // GitLab personal access tokens
  /(?<![A-Za-z0-9_])password['"]?\s*[:=]\s*['"]?[^\s'"]+/gi, // password patterns
  /-----BEGIN [A-Z]+ PRIVATE KEY-----.+-----END [A-Z]+ PRIVATE KEY-----/gs // Private keys
];

const MAX_TOKENS = parseInt(process.env.MAX_TOKENS) || 8000;

/**
 * Parse GitHub PR URL to extract owner, repo, and PR number
 * @param {string} prUrl - GitHub PR URL
 * @returns {{ owner: string, repo: string, prNumber: number }}
 */
function parsePrUrl(prUrl) {
  const match = prUrl.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
  if (!match) {
    throw new Error(`Invalid PR URL format: ${prUrl}`);
  }
  return {
    owner: match[1],
    repo: match[2],
    prNumber: parseInt(match[3])
  };
}

/**
 * Fetch PR diff from GitHub API
 * @param {string} prUrl - GitHub PR URL
 * @returns {string} Raw diff content
 */
async function fetchDiff(prUrl) {
  const { owner, repo, prNumber } = parsePrUrl(prUrl);
  const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN
  });

  try {
    console.log(`🔍 Fetching diff for PR #${prNumber} in ${owner}/${repo}...`);
    const response = await octokit.pulls.get({
      owner,
      repo,
      pull_number: prNumber,
      mediaType: {
        format: 'diff'
      }
    });

    if (!response.data) {
      throw new GitHubAPIError('Empty response from GitHub API', { prUrl });
    }

    return response.data;
  } catch (error) {
    throw new GitHubAPIError(`Failed to fetch diff: ${error.message}`, {
      prUrl,
      originalError: error.message
    });
  }
}

/**
 * Sanitize diff by redacting secrets
 * @param {string} diff - Raw diff content
 * @returns {string} Sanitized diff
 */
function sanitizeDiff(diff) {
  if (!diff || typeof diff !== 'string') {
    return diff;
  }

  let sanitized = diff;
  let redactionCount = 0;

  try {
    SECRET_PATTERNS.forEach(pattern => {
      const matches = sanitized.match(pattern);
      if (matches) {
        redactionCount += matches.length;
      }
      sanitized = sanitized.replace(pattern, '[REDACTED]');
    });

    if (redactionCount > 0) {
      console.log(`✅ Diff sanitized (${redactionCount} secrets redacted)`);
    }
    return sanitized;
  } catch (error) {
    throw new DiffSanitizationError(`Failed to sanitize diff: ${error.message}`, {
      redactionCount
    });
  }
}

/**
 * Trim diff to token limit (approximate tokens as characters / 4)
 * @param {string} diff - Diff content
 * @param {number} maxTokens - Maximum token count
 * @returns {string} Trimmed diff
 */
function trimToTokenLimit(diff, maxTokens) {
  if (!diff) {
    return diff;
  }

  const estimatedTokens = diff.length / 4;

  if (estimatedTokens <= maxTokens) {
    return diff;
  }

  console.log(`⚠️ Diff exceeds token limit (estimated ${Math.round(estimatedTokens)} tokens), truncating...`);

  // Find a good truncation point (try to preserve diff headers)
  const targetLength = maxTokens * 4;
  let truncated = diff.substring(0, targetLength);

  // Try to avoid cutting in the middle of a diff hunk
  const lastHeader = Math.max(
    truncated.lastIndexOf('\n--- '),
    truncated.lastIndexOf('\n+++ '),
    truncated.lastIndexOf('\n@@ ')
  );

  if (lastHeader > targetLength * 0.8) {
    truncated = diff.substring(0, lastHeader) + '\n... [truncated]';
  } else {
    truncated = truncated + '... [truncated]';
  }

  return truncated;
}

/**
 * Orchestrate fetching, sanitizing, and trimming the diff
 * @param {string} prUrl - GitHub PR URL
 * @returns {string} Sanitized and trimmed diff
 */
async function getSanitizedDiff(prUrl) {
  const diff = await fetchDiff(prUrl);

  if (!diff || diff.trim().length === 0) {
    console.log('⚠️ Empty diff, skipping processing');
    return '';
  }

  const sanitized = sanitizeDiff(diff);
  const trimmed = trimToTokenLimit(sanitized, MAX_TOKENS);
  return trimmed;
}

export {
  fetchDiff,
  sanitizeDiff,
  trimToTokenLimit,
  parsePrUrl,
  getSanitizedDiff
};
