# SPDD Analysis: Add `--addChatId` CLI Option

## Original Business Requirement

# Requirements: Add Chat ID Feature

## Feature: `--addChatId` CLI Option

### Overview
Add a CLI option to manually capture and update the Telegram chat ID used for notifications.

### Use Case
When running `node index.js --addChatId`, the app should:
1. Connect to Telegram as a user (using existing tdl/TDLib setup)
2. Listen for incoming messages
3. Capture the chat ID from which a message is received
4. Display the chat ID to user

### User Flow
1. User runs: `node index.js --addChatId`
2. App connects to Telegram and displays "Waiting for message..."
3. User switches to Telegram and sends a message to the logged-in account
4. App detects the incoming message, extracts the chat ID
5. App displays the chat ID

### Technical Requirements

#### CLI Argument Handling
- Parse `--addChatId` flag from `process.argv`
- When flag is present, enter "add chat ID" mode instead of normal PR review

#### Telegram Message Monitoring
- Use existing tdl client setup (reuse from `notify-claw.js`)
- Listen for incoming messages using TDLib's update mechanism
- Extract `chat_id` from incoming message updates

### Files to Modify
1. `index.js` - Add CLI argument parsing for `--addChatId`
2. `notify-claw.js` - Add `addChatIdMode()` function

### No New Dependencies Required
- Reuse existing `tdl` library for receiving messages

### Edge Cases
- Handle case where user sends Ctrl+C to cancel
- Handle case where no message is received within timeout (optional)
- Validate chat ID format

## Domain Concept Identification

#### Existing Concepts (from codebase)

- **Telegram Notification Channel**: The app uses TDLib (via the `tdl` npm package) to send notifications to a Telegram chat. The chat destination is identified by `OPENCLAW_CHAT_ID` from `.env`. This is the core notification mechanism used after PR review processing.
  - Related concepts: `notify-claw.js` (notification sender), `.env` (configuration store), `tdl` (Telegram client library)

- **TDLib Client Setup**: The `notify-claw.js` module already establishes a TDLib client connection using `tdl.createClient()` with API credentials (`TELEGRAM_API_ID`, `TELEGRAM_API_HASH`) and database encryption key from `.env`. It uses `tdl.login()` for authentication and `_td_database/` + `_td_files/` directories for persistent TDLib state.
  - Related concepts: `.env` (credential source), `_td_database/` (TDLib persistent state), `_td_files/` (TDLib file cache)

- **Environment Configuration (`.env`)**: The app stores all sensitive configuration in a `.env` file at the project root. Current keys include `GITHUB_TOKEN`, `OPENCLAW_CHAT_ID`, `TELEGRAM_API_ID`, `TELEGRAM_API_HASH`. The file is read at startup via the `dotenv` package.
  - Related concepts: All modules that consume configuration (index.js, notify-claw.js, get-diff.js)

- **CLI Entry Point (`index.js`)**: The main entry point currently takes a single positional argument (PR URL) and orchestrates the PR review flow: parse URL → fetch diff → AI review → send notification. It does not currently use any named CLI flags/options.
  - Related concepts: `get-diff.js` (diff fetching), `notify-claw.js` (notification)

- **Error Handling (`errors.js`)**: Custom error classes (`ConfigError`, `GitHubError`, `TelegramError`) with consistent `name`/`message` pattern. Used across the codebase for typed error handling.
  - Related concepts: All operational modules

#### New Concepts Required

- **Chat ID Capture Mode**: A new operational mode (distinct from the normal PR review flow) where the app connects to Telegram, listens for an incoming message, extracts the chat ID. This is a setup/configuration utility, not part of the core review workflow.
  - Related to: TDLib client setup (reuses existing connection pattern), `.env` configuration, CLI argument parsing (triggers this mode)

- **Interactive Prompt**: A user-interaction step where the captured chat ID is displayed.
  - Related to: chat ID capture flow


## Strategic Approach

#### Solution Direction

The feature adds a new CLI operational mode to the existing `index.js` entry point. When `--addChatId` is detected in `process.argv`, the app bypasses the normal PR review flow and instead:

1. Initializes a TDLib client (reusing the exact same setup pattern from `notify-claw.js`)
2. Listens for incoming message updates via TDLib's update event mechanism
3. Extracts the `chat_id` from the first received message update
4. Display the `chat_id` to the user *

The implementation follows the existing architectural conventions: same TDLib client initialization pattern, same `.env` consumption pattern, same error class pattern from `errors.js`.

#### Key Design Decisions

- **Reuse TDLib client setup from `notify-claw.js` vs. creating a new setup**: The `notify-claw.js` module already has `createTelegramClient()` and uses `tdl.login()`. The `addChatIdMode()` function should reuse the same client creation pattern. However, since `notify-claw.js` exports `notifyClaw` and `createTelegramClient` is not currently exported, the function should either export `createTelegramClient` or duplicate the minimal setup. → **Recommendation**: Export `createTelegramClient` from `notify-claw.js` and reuse it in the new `addChatIdMode()` function to avoid duplication. This is a minor refactor that improves maintainability.

- **Add `addChatIdMode()` to `notify-claw.js` vs. `index.js`**: The requirement specifies adding it to `notify-claw.js`, which is appropriate since it deals with Telegram functionality and keeps `index.js` focused on flow orchestration. → **Recommendation**: Add `addChatIdMode()` to `notify-claw.js` and call it from `index.js` when the flag is detected. This maintains separation of concerns.

#### Alternatives Considered

- **Using `OPENCLAW_BOT_TOKEN` with Bot API instead of TDLib**: The bot token is already in `.env`. The Bot API's `getUpdates` endpoint could capture chat IDs without TDLib. However, the requirement explicitly specifies using the existing tdl/TDLib setup, and using TDLib provides a consistent approach with the existing notification infrastructure. → **Rejected**: Requirement mandates TDLib reuse.

- **Separate script file (e.g., `add-chat-id.js`)**: Could create a standalone script instead of modifying `index.js`. This would avoid modifying the main entry point. → **Rejected**: The requirement specifies modifying `index.js` and `notify-claw.js`, and having a single entry point with mode flags is a common CLI pattern.

- **Using `dotenv` for writing**: The `dotenv` package is already a dependency and can parse `.env` files. However, `dotenv` is designed for reading, not writing. Using `fs` directly gives full control over file format and is simpler for a single-key update. → **Rejected**: `fs` direct manipulation is simpler and more predictable for this use case.

## Risk & Gap Analysis

#### Requirement Ambiguities

- **"Save this chat ID? (y/n)" prompt mechanism**: The requirement shows a confirmation prompt but doesn't specify whether this is a terminal stdin prompt or some other mechanism. The project currently has no interactive input capability. **Needs clarification**: Should this be a synchronous stdin read (blocking) using `readline`? This is the most straightforward approach for a CLI tool.

- **Timeout behavior**: The requirement lists timeout as optional ("Handle case where no message is received within timeout (optional)"). **Needs clarification**: Should there be a timeout? If so, what duration? Recommendation: implement a 60-second timeout as a reasonable default.

- **Multiple messages received**: The requirement says "captures the chat ID from which a message is received" (singular). **Needs clarification**: Should the app capture the first message and stop listening, or should it keep listening if the user wants to pick a different chat? Recommendation: capture the first message, display it, and prompt for confirmation. If declined, exit.

- **`.env` file format edge cases**: The requirement doesn't address how to handle `.env` files with comments, trailing newlines, or missing `OPENCLAW_CHAT_ID` key. **Needs clarification**: Should the implementation handle all these cases robustly? Recommendation: handle all three — use regex replacement that preserves surrounding content, and append the key if it doesn't exist.

#### Edge Cases

- **Ctrl+C during TDLib connection**: If the user cancels while TDLib is connecting or listening, the TDLib client should be properly closed and the process should exit cleanly without partial `.env` writes. This matters because a corrupted `.env` could break the entire application.

- **Ctrl+C during confirmation prompt**: If the user cancels at the y/n prompt, the app should exit without modifying `.env`. This is lower risk but still important for UX.

- **Invalid chat ID values**: Chat IDs from TDLib are typically numeric (integers, possibly negative for groups). The validation should ensure the extracted value is a valid integer before saving.


#### Technical Risks

- **TDLib client lifecycle management**: The existing `notify-claw.js` creates a client, sends a message, and exits. The `addChatIdMode` needs to keep the client alive while listening, then cleanly shut it down. Improper cleanup could leave TDLib database locks or stale connections. **Mitigation**: Ensure `client.close()` is called in all exit paths (success, error, Ctrl+C) using `try/finally` or event handlers on `process`.

- **Stdin blocking in non-TTY environments**: If the app is run in a non-interactive environment (e.g., piped), the confirmation prompt will hang. **Mitigation**: Check `process.stdin.isTTY` before attempting interactive prompt; if not a TTY, either auto-save or exit with an error message.


- **TDLib update event reliability**: TDLib's update mechanism requires the client to be fully connected and authenticated before updates flow. If the login process hasn't completed, the app might listen indefinitely. **Mitigation**: Wait for the `update.authorizationState` event to confirm authentication before displaying "Waiting for message...".

#### Acceptance Criteria Coverage

| AC# | Description | Addressable? | Gaps/Notes |
|-----|-------------|--------------|------------|
| 1 | Parse `--addChatId` flag from `process.argv` | Yes | Straightforward flag detection in `index.js` |
| 2 | Connect to Telegram using existing tdl/TDLib setup | Yes | Reuse `createTelegramClient()` from `notify-claw.js` |
| 3 | Listen for incoming messages | Yes | Use TDLib's `client.on('update', ...)` event mechanism |
| 4 | Extract `chat_id` from incoming message | Yes | TDLib message updates contain `chat_id` field |
| 5 | Display "Waiting for message..." | Yes | Console output after connection established |
| 6 | Display captured chat ID | Yes | Console output after message received |
| 7 | Handle Ctrl+C cancellation | Yes | `process.on('SIGINT', ...)` handler with cleanup |
| 8 | Handle timeout (optional) | Yes | `setTimeout` with cleanup, listed as optional in requirements |