# Requirements: Add Chat ID Feature

## Feature: `--addChatId` CLI Option

### Overview
Add a CLI option to manually capture and update the Telegram chat ID used for notifications.

### Use Case
When running `node index.js --addChatId`, the app should:
1. Connect to Telegram as a user (using existing tdl/TDLib setup)
2. Listen for incoming messages
3. Capture the chat ID from which a message is received
4. Save the chat ID to `.env` as `OPENCLAW_CHAT_ID`

### User Flow
1. User runs: `node index.js --addChatId`
2. App connects to Telegram and displays "Waiting for message..."
3. User switches to Telegram and sends a message to the logged-in account
4. App detects the incoming message, extracts the chat ID
5. App displays the chat ID and prompts: "Save this chat ID? (y/n)"
6. If user confirms, `.env` is updated with the new `OPENCLAW_CHAT_ID`

### Technical Requirements

#### CLI Argument Handling
- Parse `--addChatId` flag from `process.argv`
- When flag is present, enter "add chat ID" mode instead of normal PR review

#### Telegram Message Monitoring
- Use existing tdl client setup (reuse from `notify-claw.js`)
- Listen for incoming messages using TDLib's update mechanism
- Extract `chat_id` from incoming message updates

#### .env File Update
- Read current `.env` file
- Update or add `OPENCLAW_CHAT_ID` with the new value
- Write back to `.env` file

### Files to Modify
1. `index.js` - Add CLI argument parsing for `--addChatId`
2. `notify-claw.js` - Add `addChatIdMode()` function

### No New Dependencies Required
- Reuse existing `tdl` library for receiving messages
- Use Node.js built-in `fs` module for .env file manipulation

### Edge Cases
- Handle case where user sends Ctrl+C to cancel
- Handle case where no message is received within timeout (optional)
- Validate chat ID format before saving