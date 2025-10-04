## simple-ai-discord-bot

A simple Discord bot with AI Q&A (Gemini), movie/series watchlist (OMDb), and scheduled reminders. Built on `discord.js` v14.

### Features
- **AI Q&A**: `/ask` powered by Google Gemini, optional web grounding.
- **Watchlist**: `/addwatchlist`, `/watchlist`, `/completedwatchlist` using OMDb.
- **Reminders**: `/addreminder` to DM a user or post in a channel; background scheduler.
- **Utilities**: `/ping`, `/echo`, `/whois`.

### Requirements
- **Node.js**: 18+ (global `fetch` is used).
- **Discord**: Bot token and application client ID.
- **Google Gemini**: API key.
- **OMDb**: API key (for watchlist search/details).
- In the Discord Developer Portal, enable the **Server Members Intent** (the bot reads member roles and join dates).

### Setup
1. Install dependencies:

```bash
npm install
```

2. Create a `.env` file in the project root:

```ini
# Discord
DISCORD_TOKEN=your-bot-token
CLIENT_ID=your-application-client-id

# Google Gemini
GEMINI_API_KEY=your-gemini-api-key
# Optional (defaults to gemini-2.5-flash)
GEMINI_MODEL_ID=gemini-2.5-flash

# OMDb (for watchlist)
OMDB_API_KEY=your-omdb-api-key
```

3. Register global slash commands (run once or whenever commands change):

```bash
npm run deploy:cmd
```

4. Start the bot:

```bash
npm start
# or during development
npm run dev
```

### Slash Commands
- **/ask** `prompt` [`system`] [`web`] [`user`]
  - Ask Gemini. Set `web=true` to enable Google Search grounding.
- **/ping**
  - Replies with latency.
- **/echo** `text`
  - Echoes your text.
- **/whois** `user`
  - Shows public info about a tagged user.
- **/addwatchlist** `query` [`type`] [`year`]
  - Search OMDb and add a movie/series. Presents quick-pick and a manual add flow.
- **/watchlist** [`user`] [`status`]
  - View a user’s watchlist. `status` can be `open` or `done`.
- **/completedwatchlist** `id`
  - Mark your watchlist item as completed.
- **/addreminder** `target` `date` `time` `message`
  - Schedule a reminder to a channel `<#id>` or a user `<@id>` using `YYYY-MM-DD` and `HH:mm` (24h).

### Data & Persistence
- JSON files are auto-created under `data/`:
  - `data/contacts.json`
  - `data/reminders.json`
  - `data/watchlist_movies.json`
- Reminders are checked every ~15s by an in-process scheduler.
- Timezone for reminder texts is treated as **WIB (UTC+7)**.

### Deploying
- Includes `discloud.config` for deployment to Discloud; see the Discloud docs: [Discloud configuration guide](https://docs.discloudbot.com/discloud.config).

### Scripts
- **Start**: `npm start`
- **Dev (nodemon)**: `npm run dev`
- **Deploy Slash Commands**: `npm run deploy:cmd`



