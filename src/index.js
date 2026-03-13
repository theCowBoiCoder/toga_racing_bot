require('dotenv').config();

const { Client, Collection, Events, GatewayIntentBits } = require('discord.js');
const IracingAuth = require('./iracing/auth');
const IracingAPI = require('./iracing/api');

// ─── Load Commands ────────────────────────────────────────────
const schedule = require('./commands/schedule');
const series = require('./commands/series');
const upcoming = require('./commands/upcoming');
const buildShortcutCommands = require('./commands/shortcuts');

// ─── Validate Env ─────────────────────────────────────────────
const required = [
  'DISCORD_TOKEN',
  'IRACING_USERNAME',
  'IRACING_PASSWORD',
  'IRACING_CLIENT_ID',
  'IRACING_CLIENT_SECRET',
];

for (const key of required) {
  if (!process.env[key]) {
    console.error(`Missing required env var: ${key}`);
    console.error('Copy .env.example to .env and fill in your credentials.');
    process.exit(1);
  }
}

// ─── Init iRacing API ─────────────────────────────────────────
const iracingAuth = new IracingAuth({
  username: process.env.IRACING_USERNAME,
  password: process.env.IRACING_PASSWORD,
  clientId: process.env.IRACING_CLIENT_ID,
  clientSecret: process.env.IRACING_CLIENT_SECRET,
});

const iracingAPI = new IracingAPI(iracingAuth);

// ─── Init Discord Client ─────────────────────────────────────
const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

// Attach iRacing API to client so commands can access it
client.iracingAPI = iracingAPI;

// ─── Register Commands ────────────────────────────────────────
client.commands = new Collection();

// Core commands
const coreCommands = [schedule, series, upcoming];
for (const cmd of coreCommands) {
  client.commands.set(cmd.data.name, cmd);
}

// Shortcut commands (/gt3, /gt4, /lmp2, etc.)
const shortcuts = buildShortcutCommands();
for (const cmd of shortcuts) {
  client.commands.set(cmd.data.name, cmd);
}

// ─── Events ───────────────────────────────────────────────────
client.once(Events.ClientReady, (readyClient) => {
  console.log(`✅ Bot online as ${readyClient.user.tag}`);
  console.log(`📊 Serving ${readyClient.guilds.cache.size} server(s)`);
  console.log(`🏁 ${client.commands.size} commands loaded`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);

  if (!command) {
    console.warn(`Unknown command: ${interaction.commandName}`);
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`Error executing /${interaction.commandName}:`, error);

    const reply = {
      content: '❌ Something went wrong executing this command.',
      ephemeral: true,
    };

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(reply).catch(() => {});
    } else {
      await interaction.reply(reply).catch(() => {});
    }
  }
});

// ─── Login ────────────────────────────────────────────────────
client.login(process.env.DISCORD_TOKEN);
