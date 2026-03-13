# iRacing Discord Bot

Discord bot that shows iRacing schedules, series info, and upcoming race countdowns.

## Commands

| Command | Description |
|---------|-------------|
| `/schedule [category]` | This week's schedule (filter: Road, Oval, Dirt Road, etc.) |
| `/series <name>` | Search for a series by name |
| `/upcoming [series]` | Next races with countdown timers |
| `/gt3` | GT3 series schedule |
| `/gt4` | GT4 series schedule |
| `/lmp2` | LMP2 series schedule |
| `/f1` | Formula 1 / Grand Prix schedule |
| `/imsa` | IMSA series schedule |
| `/nascar` | NASCAR series schedule |
| `/porsche` | Porsche Cup schedule |
| `/mx5` | MX-5 Cup schedule |
| `/skippy` | Skip Barber schedule |
| ...and more | `/gte`, `/lmp3`, `/f3`, `/f4`, `/tcr`, `/supercars`, `/indycar`, `/ferrari`, `/lambo`, `/pcup`, `/sprint`, `/trucks`, `/arca` |

## Setup

### 1. Discord Bot

1. Go to https://discord.com/developers/applications
2. Create a **New Application**
3. Go to **Bot** tab → **Reset Token** → copy the token
4. Go to **OAuth2** tab → copy the **Application ID**
5. Use **OAuth2 URL Generator** → select scopes `bot` + `applications.commands` → invite to your server
6. Copy your server's ID (right-click server → Copy Server ID) for guild-specific command registration

### 2. iRacing API Credentials

iRacing now requires OAuth2 (legacy auth was removed Dec 2025).

1. Go to https://oauth.iracing.com/oauth2/book/client_registration.html
2. Request a **Password Limited** client
3. iRacing will email you a `client_id` and `client_secret`

### 3. Configure

```bash
cp .env.example .env
```

Fill in your `.env`:

```
DISCORD_TOKEN=your_discord_bot_token
DISCORD_CLIENT_ID=your_discord_application_id
DISCORD_GUILD_ID=your_server_id

IRACING_USERNAME=your_iracing_email
IRACING_PASSWORD=your_iracing_password
IRACING_CLIENT_ID=your_iracing_oauth_client_id
IRACING_CLIENT_SECRET=your_iracing_oauth_client_secret
```

### 4. Install & Run

**Local:**

```bash
npm install
npm run deploy   # Register slash commands with Discord
npm start        # Start the bot
```

**Docker:**

```bash
# Register commands first (run locally or in container)
npm install
npm run deploy

# Then run with Docker
docker compose up -d
```

### 5. Register Commands

You only need to do this once (or when adding new commands):

```bash
npm run deploy
```

If `DISCORD_GUILD_ID` is set, commands register instantly to that server.
If not set, commands register globally (takes up to 1 hour).

## Development

```bash
npm run dev   # Starts with --watch for auto-restart on changes
```

## Architecture

- `src/iracing/auth.js` — OAuth2 Password Limited flow token management
- `src/iracing/api.js` — iRacing Data API client with caching
- `src/iracing/cache.js` — Simple TTL cache (30 min default)
- `src/commands/` — Slash command handlers
- `src/utils/embeds.js` — Discord embed builders with pagination
- `src/utils/time.js` — Discord timestamp formatting helpers
