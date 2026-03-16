require('dotenv').config();

const { REST, Routes } = require('discord.js');

const schedule = require('./commands/schedule');
const series = require('./commands/series');
const upcoming = require('./commands/upcoming');
const driver = require('./commands/driver');
const irating = require('./commands/irating');
const recentraces = require('./commands/recentraces');
const standings = require('./commands/standings');
const sof = require('./commands/sof');
const participation = require('./commands/participation');
const splits = require('./commands/splits');
const license = require('./commands/license');
const incidents = require('./commands/incidents');
const track = require('./commands/track');
const compare = require('./commands/compare');
const randomrace = require('./commands/randomrace');
const streak = require('./commands/streak');
const laptimes = require('./commands/laptimes');
const link = require('./commands/link');
const unlink = require('./commands/unlink');
const buildMyCommands = require('./commands/my');
const buildShortcutCommands = require('./commands/shortcuts');

const { DISCORD_TOKEN, DISCORD_CLIENT_ID, DISCORD_GUILD_ID } = process.env;

if (!DISCORD_TOKEN || !DISCORD_CLIENT_ID) {
  console.error('Missing DISCORD_TOKEN or DISCORD_CLIENT_ID in .env');
  process.exit(1);
}

// Collect all command data
const commands = [
  schedule.data.toJSON(),
  series.data.toJSON(),
  upcoming.data.toJSON(),
  driver.data.toJSON(),
  irating.data.toJSON(),
  recentraces.data.toJSON(),
  standings.data.toJSON(),
  sof.data.toJSON(),
  participation.data.toJSON(),
  splits.data.toJSON(),
  license.data.toJSON(),
  incidents.data.toJSON(),
  track.data.toJSON(),
  compare.data.toJSON(),
  randomrace.data.toJSON(),
  streak.data.toJSON(),
  laptimes.data.toJSON(),
  link.data.toJSON(),
  unlink.data.toJSON(),
  ...buildMyCommands().map((cmd) => cmd.data.toJSON()),
  ...buildShortcutCommands().map((cmd) => cmd.data.toJSON()),
];

const rest = new REST().setToken(DISCORD_TOKEN);

(async () => {
  try {
    console.log(`Registering ${commands.length} slash commands...`);

    if (DISCORD_GUILD_ID) {
      // Guild-specific (instant, good for testing)
      await rest.put(
        Routes.applicationGuildCommands(DISCORD_CLIENT_ID, DISCORD_GUILD_ID),
        { body: commands }
      );
      console.log(`✅ Registered ${commands.length} commands to guild ${DISCORD_GUILD_ID}`);
    } else {
      // Global (takes up to 1 hour to propagate)
      await rest.put(
        Routes.applicationCommands(DISCORD_CLIENT_ID),
        { body: commands }
      );
      console.log(`✅ Registered ${commands.length} global commands (may take up to 1h to propagate)`);
    }

    console.log('\nRegistered commands:');
    commands.forEach((cmd) => console.log(`  /${cmd.name} — ${cmd.description}`));
  } catch (error) {
    console.error('Failed to register commands:', error);
  }
})();
