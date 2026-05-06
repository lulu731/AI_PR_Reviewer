# AI PR Reviewer - Requirements

## Architecture Overview

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│   GitHub PR      │ ──▶ │ GitHub Actions  │ ──▶  │ Telegram User   │
│   (trigger)     │      │ (workflow)      │      │ Client (tdl)    │
└─────────────────┘      └─────────────────┘      └─────────────────┘
                                                           │
                                                           ▼
                                                  ┌─────────────────┐
                                                  │ OpenClaw Agent  │
                                                  │ (reviews PR)    │
                                                  └─────────────────┘
                                                           │
                                                           ▼
                                           User receives review in Telegram
```

## What This System Does

- Fetch the PR diff using GitHub's Octokit
- Sanitize/redact secrets from the diff
- Handle large diffs (trim to token limits)
- Send message to OpenClaw via Telegram user client (tdl/eilvelia/tdl)
- Include PR URL and sanitized diff in the message
- Trigger on PR open/reopen/update
- Fetch the PR diff
- Send to OpenClaw via Telegram user client (tdl)
- Define the system prompt for the PR reviewer agent
- Agent should fetch PR details, review code, and return structured feedback

## Technical Stack

Set up Node.js project with required packages
- `@octokit/rest` - to fetch PR diffs from GitHub
- `dotenv` - for environment variables

## Security Considerations

Based on the tutorial:
- **Diff is untrusted input** - can contain prompt injection, secrets, etc.
- **Sanitize** the diff before sending (redact secrets, trim large files)
- **LLM output validation** - validate the response structure
- **Fail safely** - if validation fails, report an error

## Configuration Needed

The following environment variables will be needed:
- `TELEGRAM_API_ID` - Telegram API ID (from my.telegram.org)
- `TELEGRAM_API_HASH` - Telegram API Hash (from my.telegram.org)
- `OPENCLAW_CHAT_ID` - Chat ID to send messages to
- `GITHUB_TOKEN` - GitHub token for fetching PRs (provided by GitHub Actions)
- `REPO_OWNER` - GitHub repository owner
- `REPO_NAME` - GitHub repository name
