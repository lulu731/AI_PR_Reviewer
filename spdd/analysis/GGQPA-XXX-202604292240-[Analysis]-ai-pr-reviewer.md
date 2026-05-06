# SPDD Analysis: AI PR Reviewer

## Original Business Requirement

# AI PR Reviewer - Requirements

## Architecture Overview

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│   GitHub PR     │ ──▶  │ GitHub Actions  │ ──▶  │ Telegram User   │
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

## Domain Concept Identification

#### Existing Concepts (from codebase)
- **None** - This is a greenfield project with no existing code, models, or database schemas. The current repository contains only documentation files (`requirements.md`, `plan.md`, `session-notes.md`) and an empty `package.json`.

#### New Concepts Required
- **PR (Pull Request)**: The GitHub pull request entity that triggers the workflow. Contains metadata (URL, number, title, author) and a diff (code changes). No existing representation in codebase.
- **Diff**: The code changes extracted from a PR. This is untrusted input that requires sanitization, secret redaction, and size management (trimming to token limits).
- **Telegram User Message**: The notification payload sent to OpenClaw via Telegram user client (tdl). Contains the PR URL and sanitized diff.
- **OpenClaw Agent**: The external LLM-powered agent that receives the Telegram message, fetches PR details, performs code review, and returns structured feedback.
- **GitHub Actions Workflow**: The CI/CD trigger that listens for PR events (open/reopen/update) and orchestrates the diff fetching and notification steps.
- **System Prompt**: The instruction set given to the OpenClaw agent defining how to review code and format feedback.

#### Key Business Rules
- **Diff Sanitization Rule**: All diffs must have secrets and sensitive data redacted before being sent to any external service (OpenClaw/Telegram user client).
- **Token Limit Rule**: Large diffs must be trimmed to fit within token limits before sending to OpenClaw.
- **Safe Failure Rule**: If diff sanitization fails or OpenClaw response validation fails, the system must report an error rather than proceed with corrupted data.
- **Event Trigger Rule**: The workflow must only trigger on PR open, reopen, and update events (not on close, merge, or other events).
- **Environment Configuration Rule**: All sensitive tokens (Telegram API credentials, GitHub token) must be loaded from environment variables, never hardcoded.

## Strategic Approach

#### Solution Direction
- **Architecture Pattern**: Event-driven pipeline using GitHub Actions as the orchestration layer. The flow is: GitHub PR Event → GitHub Actions Workflow → Fetch Diff (Node.js script with Octokit) → Sanitize Diff → Send to OpenClaw via Telegram user client (tdl) → OpenClaw Agent reviews and responds in Telegram.
- **Technology Stack**: Node.js (ESM) with `@octokit/rest` for GitHub API access and `dotenv` for configuration. GitHub Actions for workflow orchestration. `eilvelia/tdl` Telegram user client for OpenClaw integration.
- **General Data Flow**:
  1. PR event triggers GitHub Actions workflow
  2. Workflow runs Node.js script to fetch diff via Octokit
  3. Script sanitizes diff (redact secrets, trim to token limit)
  4. Script sends Telegram message with PR URL to OpenClaw bot
  5. OpenClaw agent picks up message, fetches PR details, reviews code
  6. Review feedback is sent back to user via Telegram

#### Key Design Decisions
- **Diff Sanitization Approach**: Implement regex-based secret redaction (API keys, tokens, passwords) in the Node.js script before sending to OpenClaw → **Recommended**: Centralizes security in the GitHub Actions step, reduces risk of leaking secrets to external services. Trade-off: Sanitization logic must be maintained and updated as new secret patterns emerge.
- **Diff Size Management**: Trim diff to a configured maximum token count (e.g., 8000 tokens) → **Recommended**: Prevents token limit errors and controls costs. Trade-off: May lose context from large PRs, but safer than sending unbounded input.
- **OpenClaw Integration Method**: Use Telegram user client (tdl/eilvelia/tdl) to send message to OpenClaw (rather than direct HTTP API) → **Recommended**: Leverages existing OpenClaw Telegram integration. Trade-off: Indirect integration adds a hop; requires Telegram API ID, API Hash, and chat ID configuration.
- **Workflow Trigger Scope**: Trigger on `pull_request` events with types `[opened, reopened, synchronize]` → **Recommended**: Covers the main review scenarios. Trade-off: May generate duplicate reviews if PR is updated frequently; could add deduplication logic later.
- **Output Validation**: Validate OpenClaw response structure before trusting it → **Recommended**: Ensures safe handling of LLM output. Trade-off: Adds code complexity; validation schema must match OpenClaw's actual output format.

#### Alternatives Considered
- **Direct Anthropic API Integration**: Instead of using OpenClaw, call Anthropic's Claude API directly from GitHub Actions → **Rejected**: User already has OpenClaw running with Telegram integration; adding direct Anthropic API would duplicate LLM infrastructure and require additional API keys.
- **GitHub App vs GitHub Actions**: Build as a GitHub App instead of using Actions → **Rejected**: GitHub Actions is simpler for this use case, requires no App registration, and leverages the user's existing CI/CD setup.
- **Webhook to OpenClaw**: Send diff via HTTP webhook directly to OpenClaw instead of Telegram → **Rejected**: OpenClaw is already configured to receive messages via Telegram; changing this would require OpenClaw reconfiguration.
- **Telegram Bot API**: Use bot token to send messages → **Rejected**: User requested to use tdl (Telegram user client) instead of Bot API, as the bot should execute instructions given by user.

## Risk & Gap Analysis

#### Requirement Ambiguities
- **OpenClaw Agent Prompt Details**: The requirement mentions "define the system prompt for the PR reviewer agent" but does not specify what review criteria the AI should check (e.g., code style, security vulnerabilities, performance, best practices). → **Needs clarification**: What specific review criteria should the agent follow?
- **OpenClaw API Contract**: The requirement assumes OpenClaw will fetch PR details and return structured feedback, but the exact message format, API endpoint (if any), and response structure are not specified. → **Needs clarification**: What is the expected message format to send to OpenClaw via Telegram? What does the response look like?
- **Diff Sanitization Scope**: "Sanitize/redact secrets" is mentioned but the specific patterns (e.g., AWS keys, private keys, generic "password" strings) are not defined. → **Needs clarification**: What secret patterns should be redacted?
- **Token Limit Threshold**: "Trim to token limits" is mentioned but no specific token count or model context window is provided. → **Needs clarification**: What is the target token limit for the diff?
- **Telegram User Client Credentials**: `TELEGRAM_API_ID`, `TELEGRAM_API_HASH`, and `OPENCLAW_CHAT_ID` are required. API ID and Hash are obtained from my.telegram.org. → **Note**: User must create a Telegram application to obtain these credentials.

#### Edge Cases
- **Very Large PRs**: If a PR diff exceeds even the trimmed size, the review may lack critical context → **Mitigation**: Consider summarizing very large diffs or notifying user that full review is not possible.
- **Frequent PR Updates**: If a PR is updated rapidly (multiple pushes in quick succession), multiple workflow runs may overlap → **Mitigation**: GitHub Actions has built-in concurrency controls; consider adding `concurrency` group to workflow.
- **OpenClaw Unavailability**: If OpenClaw is down or unreachable, the Telegram message may fail silently → **Mitigation**: Add error handling and retry logic in the notification script.
- **Empty Diffs**: If a PR has no diff (e.g., only documentation changes or empty commit), the workflow should handle this gracefully → **Mitigation**: Check diff content before sending to OpenClaw.
- **Private Repositories**: The requirement does not specify if this should work with private repos (which may have stricter token permissions) → **Note**: `GITHUB_TOKEN` in Actions should have appropriate permissions.

#### Technical Risks
- **Prompt Injection via Diff**: Since diffs are untrusted input, a malicious PR could contain prompt injection attempts targeting OpenClaw → **Mitigation**: Sanitize diff thoroughly, consider wrapping diff in `<diff>...</diff>` tags or using OpenClaw's prompt injection protections.
- **Secret Leakage**: If sanitization fails or misses a secret pattern, sensitive data could be sent to OpenClaw/Telegram → **Mitigation**: Use comprehensive regex patterns, consider using a library like `detect-secrets` or similar; fail-safe if sanitization is uncertain.
- **Token Limit Exceeded**: Even after trimming, the diff might exceed OpenClaw's context window → **Mitigation**: Implement conservative trimming with a safety margin; validate token count before sending.
- **GitHub API Rate Limits**: Frequent PR events could hit GitHub API rate limits for Octokit → **Mitigation**: GitHub Actions `GITHUB_TOKEN` has generous limits for PR events; monitor if issues arise.
- **OpenClaw Response Validation Failure**: If OpenClaw changes its output format, validation may fail → **Mitigation**: Make validation flexible; log raw response for debugging; fail with informative error message.

#### Acceptance Criteria Coverage

| AC# | Description | Addressable? | Gaps/Notes |
|-----|-------------|--------------|------------|
| 1 | Fetch PR diff using GitHub's Octokit | Yes | Covered by `get-diff.js` script with `@octokit/rest` |
| 2 | Sanitize/redact secrets from the diff | Yes | Requires defining secret patterns to redact; pattern list not specified in requirements |
| 3 | Handle large diffs (trim to token limits) | Yes | Token limit threshold not specified; needs to be defined |
| 4 | Send message to OpenClaw via Telegram user client (tdl) | Yes | Message format and OpenClaw chat ID need clarification |
| 5 | Include PR URL in the message | Yes | Straightforward implementation |
| 6 | Trigger on PR open/reopen/update | Yes | Covered by GitHub Actions `pull_request` event with types |
| 7 | Define system prompt for PR reviewer agent | Partial | Prompt content/criteria not specified; only high-level requirement given |
| 8 | Agent fetches PR details, reviews code, returns structured feedback | Partial | Assumes OpenClaw will do this; exact contract/format not specified |
| 9 | LLM output validation | Yes | Needs validation schema definition based on OpenClaw's actual output |
| 10 | Fail safely on validation/error | Yes | Implement try-catch and error reporting in all scripts |