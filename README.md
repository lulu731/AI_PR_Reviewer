# AI PR Reviewer

An automated Pull Request review system that integrates GitHub Actions with OpenClaw Telegram bot to provide AI-powered code reviews directly in Telegram.

## Architecture Overview

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│   GitHub PR     │ ──▶  │ GitHub Actions  │ ──▶  │ Telegram Bot    │
│   (trigger)     │      │ (workflow)      │      │ (OpenClaw)      │
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

## Features

- **Automated PR Diff Fetching**: Uses GitHub's Octokit API to retrieve PR diffs
- **Diff Sanitization**: Redacts sensitive information (AWS keys, GitHub tokens, passwords, private keys) before processing
- **Token Limit Handling**: Trims large diffs to fit LLM token limits (default 8000 tokens)
- **Telegram Integration**: Sends PR review requests to OpenClaw Telegram bot
- **Structured Feedback**: Returns reviews in JSON format with overall status (pass/warning/fail), file-specific comments, and summary
- **Security-First Design**: Validates inputs, fails safely, and prevents secret exposure

## How It Works

1. **Trigger**: A PR is opened, updated, or reopened in a GitHub repository
2. **Fetch Diff**: GitHub Actions runs `get-diff.js` to fetch the PR diff via GitHub API
3. **Sanitize**: The diff is sanitized to redact secrets and trimmed to token limits
4. **Notify**: `notify-claw.js` sends a message with the PR URL to the OpenClaw Telegram bot
5. **Review**: OpenClaw agent uses the PR reviewer prompt to analyze the code and generate feedback
6. **Deliver**: The structured review is sent back to the user via Telegram

## Installation

### Prerequisites
- Node.js (v16+ recommended)
- Telegram bot token (for OpenClaw integration)
- GitHub repository with Actions enabled

### Steps
1. Clone the repository:
   ```bash
   git clone https://github.com/lulu731/AI_PR_Reviewer.git
   cd AI_PR_Reviewer
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure environment variables (see Configuration section)

## Configuration

Set the following environment variables (either in `.env` file or GitHub Actions secrets):

| Variable             | Required | Description                                                     |
|----------------------|----------|-----------------------------------------------------------------|
| `TELEGRAM_BOT_TOKEN` | Yes      | Token for the Telegram bot                                      |
| `OPENCLAW_CHAT_ID`   | Yes      | Chat ID to send messages to                                     |
| `GITHUB_TOKEN`       | Yes      | GitHub token for fetching PRs (auto-provided by GitHub Actions) |
| `REPO_OWNER`         | Yes      | GitHub repository owner                                         |
| `REPO_NAME`          | Yes      | GitHub repository name                                          |
| `MAX_TOKENS`         | No       | Maximum token limit for diffs (default: 8000)                   |
| `PR_URL`             | No       | PR URL for manual testing (can also be passed as CLI argument)  |

## Usage

### GitHub Actions Workflow
Set up a GitHub Actions workflow (e.g., `.github/workflows/pr-review.yml`) to trigger on PR events. The workflow should:
1. Check out the repository
2. Install dependencies
3. Run `node index.js` to fetch, sanitize the diff and send message to Telegram

### Manual Testing
Use the provided test script to verify API integrations:
```bash
./scripts/test-api.sh
```

### Customizing Reviews
Modify the system prompt in `prompts/pr-reviewer.md` to adjust review focus areas, output format, or constraints.

## Project Structure

```
AI_PR_Reviewer/
├── get-diff.js          # Fetches and sanitizes PR diffs from GitHub
├── notify-claw.js       # Sends PR review requests to Telegram bot
├── errors.js            # Custom error classes for GitHub API and Telegram errors
├── package.json         # Node.js project configuration
├── prompts/
│   └── pr-reviewer.md   # System prompt for OpenClaw PR reviewer agent
├── scripts/
│   └── test-api.sh      # Test script for API integrations
└── README.md            # This file
```

## Security Considerations

- **Untrusted Input**: PR diffs are untrusted and may contain prompt injections or secrets. All diffs are sanitized before processing.
- **Secret Redaction**: Multiple patterns are used to redact AWS keys, GitHub tokens, GitLab tokens, passwords, and private keys.
- **Fail-Safe Design**: If any step fails (e.g., API error, invalid diff), the system exits with an error code and logs details.
- **Input Validation**: PR URLs are validated to ensure they match GitHub PR format before processing.

## License

ISC License (see `package.json` for details)