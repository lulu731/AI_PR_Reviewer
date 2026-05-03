# AI PR Reviewer - Implementation Plan

## Architecture Overview

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│   GitHub PR      │ ──▶  │ GitHub Actions  │ ──▶  │ Telegram Bot    │
│   (trigger)     │      │ (workflow)     │      │ (OpenClaw)     │
└─────────────────┘      └─────────────────┘      └─────────────────┘
                                                          │
                                                          ▼
                                                 ┌─────────────────┐
                                                 │ OpenClaw Agent  │
                                                 │ (reviews PR)   │
                                                 └─────────────────┘
                                                          │
                                                          ▼
                                          User receives review in Telegram
```

## What This System Does

1. **Trigger**: A PR is opened, updated, or reopened in a GitHub repository
2. **Fetch**: GitHub Actions fetches the PR diff
3. **Notify**: GitHub Actions sends a message to the OpenClaw Telegram bot with the PR URL
4. **Review**: OpenClaw agent reviews the code using the LLM
5. **Result**: User receives the review in Telegram

## Implementation Steps

### 1. Set up Node.js project with required packages
- Install `@octokit/rest` - to fetch PR diffs from GitHub
- Install `dotenv` - for environment variables
- Note: No Anthropic SDK needed (OpenClaw handles the LLM)

### 2. Create diff fetching script (get-diff.js)
- Fetch the PR diff using GitHub's Octokit
- Sanitize/redact secrets from the diff
- Handle large diffs (trim to token limits)

### 3. Create Telegram notification script (notify-claw.js)
- Send message to OpenClaw Telegram bot via Telegram Bot API
- Include PR URL in the message

### 4. Create GitHub Actions workflow (.github/workflows/pr-review.yml)
- Trigger on PR open/reopen/update
- Fetch the PR diff
- Send to OpenClaw via Telegram Bot API

### 5. Create OpenClaw agent prompt for PR review
- Define the system prompt for the PR reviewer agent
- Agent should fetch PR details, review code, and return structured feedback

## Security Considerations

Based on the tutorial:
- **Diff is untrusted input** - can contain prompt injection, secrets, etc.
- **Sanitize** the diff before sending (redact secrets, trim large files)
- **LLM output validation** - validate the response structure
- **Fail safely** - if validation fails, report an error

## Configuration Needed

The following environment variables will be needed:
- `TELEGRAM_BOT_TOKEN` - Token for the Telegram bot
- `OPENCLAW_CHAT_ID` - Chat ID to send messages to
- `GITHUB_TOKEN` - GitHub token for fetching PRs (provided by GitHub Actions)
- `REPO_OWNER` - GitHub repository owner
- `REPO_NAME` - GitHub repository name

## Files to Create

1. `get-diff.js` - Fetches PR diff from GitHub
2. `notify-claw.js` - Sends message to Telegram bot
3. `.github/workflows/pr-review.yml` - GitHub Actions workflow
4. `prompts/pr-reviewer.md` - System prompt for OpenClaw
5. `.env.example` - Example environment configuration