# iRacing Discord Bot

Discord bot for iRacing — schedules, driver stats, lap times, and automatic race reports.

## Commands

### Schedules & Races

- `/schedule [category]` — This week's full schedule. Filter by Road, Oval, Dirt Road, Dirt Oval, etc.
- `/series <name>` — Search for a series by name and show its current week details.
- `/upcoming [series]` — Upcoming race sessions with countdown timers. Optionally filter by series name.
- `/laptimes <series> [week]` — Top 10 fastest laps from the highest SOF split for a series. Defaults to current week.

### Series Shortcuts

Quick access to popular series schedules. During Week 13 (off-season), these automatically fall back to showing upcoming race sessions from the race guide.

- `/gt3` `/gt4` `/gte` — GT class series
- `/lmp2` `/lmp3` — Prototype series
- `/f1` `/f3` `/f4` — Open wheel / formula series
- `/imsa` — IMSA multi-class
- `/nascar` `/trucks` `/arca` — Oval stock car series
- `/indycar` — IndyCar series
- `/porsche` `/pcup` — Porsche Cup
- `/ferrari` `/lambo` — Brand-specific GT series
- `/mx5` — MX-5 Cup (great for beginners)
- `/skippy` — Skip Barber
- `/tcr` — Touring cars
- `/supercars` — V8 Supercars
- `/sprint` — Sprint cars (dirt)

### Driver Stats

- `/driver <name>` — Look up any iRacing driver. Shows all license categories (iRating, SR, license class), career stats (starts, wins, podiums, top 5s, laps), and per-category breakdown.
- `/irating <name> [category]` — iRating history. Shows all 6 categories at once with trends and sparklines, or pick a specific category for a detailed view.
- `/recentraces <name>` — Last 10 races with finish position, iR change, incidents, and SOF.
- `/streak <name>` — Current win and podium streaks.
- `/compare <name1> <name2>` — Side-by-side driver comparison.

### Account Linking

Link your Discord account to your iRacing profile for quick personal commands:

- `/link <name>` — Link your iRacing account (uses your display name).
- `/unlink` — Remove your linked account.
- `/mystats` — Your full driver profile (same as `/driver` but auto-fills your name).
- `/myirating [category]` — Your iRating across all categories.
- `/myrecent` — Your recent races.
- `/mystreak` — Your win/podium streaks.

### Season & Results

- `/standings <series>` — Season standings for a series.
- `/sof <series>` — Strength of field stats for recent sessions.
- `/participation <series>` — Participation numbers and trends.
- `/splits <series>` — Split information for recent sessions.

### Other

- `/track <name>` — Look up track info.
- `/license <current_sr> <current_license>` — Calculate what you need for license promotion (SR needed, estimated clean races, fast-track eligibility).
- `/incidents` — Incident stats.
- `/randomrace` — Pick a random series to race.

## Automation

The bot runs background tasks automatically (configure via `.env`):

- **Race Alerts** — Posts to a channel 15 minutes before popular races start (requires `ALERT_CHANNEL_ID`).
- **Weekly Schedule** — Auto-posts the new track rotation every Tuesday (requires `SCHEDULE_CHANNEL_ID`).
- **Special Event Alerts** — Alerts for major endurance events like Daytona 24, Spa 24, Le Mans, etc.
- **Auto Race Reports** — When a linked member finishes a race, auto-posts a detailed report with finish position, iR/SR change, incidents, SOF, laps, and position movement (requires `RACE_REPORT_CHANNEL_ID` or falls back to `ALERT_CHANNEL_ID`).

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
# Discord
DISCORD_TOKEN=your_discord_bot_token
DISCORD_CLIENT_ID=your_discord_application_id
DISCORD_GUILD_ID=your_server_id

# iRacing OAuth2
IRACING_USERNAME=your_iracing_email
IRACING_PASSWORD=your_iracing_password
IRACING_CLIENT_ID=your_iracing_oauth_client_id
IRACING_CLIENT_SECRET=your_iracing_oauth_client_secret

# Automation channels (optional — leave blank to disable)
ALERT_CHANNEL_ID=channel_id_for_race_alerts
SCHEDULE_CHANNEL_ID=channel_id_for_weekly_schedule_posts
RACE_REPORT_CHANNEL_ID=channel_id_for_auto_race_reports
```

### 4. Install & Run

```bash
npm install
npm run deploy   # Register slash commands with Discord (one-time)
npm start        # Start the bot
```

For development with auto-reload:

```bash
npm run dev
```

### 5. Deploy with PM2

```bash
npm install
npm run deploy          # Register slash commands (one-time)
pm2 start ecosystem.config.js
pm2 save                # Save process list for auto-restart on reboot
pm2 startup             # Enable PM2 to start on boot
```

Useful PM2 commands:

```bash
pm2 logs iracing-bot    # View logs
pm2 restart iracing-bot # Restart
pm2 stop iracing-bot    # Stop
pm2 status              # Check status
```

### 6. Register Commands

Run this once after setup, and again whenever new commands are added:

```bash
npm run deploy
```

If `DISCORD_GUILD_ID` is set, commands register instantly to that server.
If not set, commands register globally (takes up to 1 hour).

### Updating

```bash
git pull
npm install
npm run deploy          # Only needed if new commands were added
pm2 restart iracing-bot
```

## Architecture

- `src/index.js` — Bot entry point, command registration, Discord event handling
- `src/iracing/auth.js` — OAuth2 Password Limited flow with SHA-256 credential masking and refresh tokens
- `src/iracing/api.js` — iRacing Data API client with 30-minute TTL cache
- `src/iracing/cache.js` — Simple TTL cache
- `src/commands/` — Slash command handlers
- `src/automation.js` — Background tasks: race alerts, weekly posts, special events, auto race reports
- `src/store.js` — Persistent storage for linked accounts and reported races
- `src/utils/embeds.js` — Discord embed builders with pagination
- `src/utils/time.js` — Discord timestamp formatting helpers
- `data/` — Runtime data (linked accounts, reported races) — auto-created, gitignored

## Requirements

- Node.js 18+
- An active iRacing subscription
- iRacing OAuth2 client credentials (Password Limited type)
