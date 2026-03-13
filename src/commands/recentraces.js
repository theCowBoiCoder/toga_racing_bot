const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { discordTimestamp } = require('../utils/time');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('recentraces')
    .setDescription('Show recent race results for a driver')
    .addStringOption((opt) =>
      opt.setName('name').setDescription('Driver name').setRequired(true)
    ),

  async execute(interaction) {
    await interaction.deferReply();

    try {
      const api = interaction.client.iracingAPI;
      const name = interaction.options.getString('name');

      // Find the driver
      const results = await api.searchDrivers(name);
      const drivers = results?.results || results || [];

      if (!Array.isArray(drivers) || drivers.length === 0) {
        await interaction.editReply({ content: `❌ No drivers found matching **"${name}"**.` });
        return;
      }

      const driver = drivers[0];
      const custId = driver.cust_id;

      const recentData = await api.getMemberRecentRaces(custId);
      const races = recentData?.races || recentData || [];

      const embed = new EmbedBuilder()
        .setTitle(`🏁 Recent Races — ${driver.display_name || name}`)
        .setColor(0x2ecc71)
        .setTimestamp();

      if (Array.isArray(races) && races.length > 0) {
        const recent = races.slice(0, 10);

        for (const race of recent) {
          const pos = race.finish_position != null ? race.finish_position + 1 : '?';
          const startPos = race.start_position != null ? race.start_position + 1 : '?';
          const inc = race.incidents ?? '?';
          const sof = race.strength_of_field ?? '?';
          const seriesName = race.series_name || 'Unknown';
          const trackName = race.track?.track_name || race.track_name || 'Unknown';
          const time = race.session_start_time
            ? discordTimestamp(race.session_start_time, 'd')
            : '?';

          // Position emoji
          let posEmoji = '';
          if (pos === 1) posEmoji = '🥇';
          else if (pos === 2) posEmoji = '🥈';
          else if (pos === 3) posEmoji = '🥉';
          else posEmoji = `P${pos}`;

          const irChange = race.newi_rating != null && race.oldi_rating != null
            ? race.newi_rating - race.oldi_rating
            : null;
          const irStr = irChange != null
            ? (irChange >= 0 ? `+${irChange}` : `${irChange}`)
            : '';

          embed.addFields({
            name: `${posEmoji} ${seriesName}`,
            value: `📍 ${trackName} • ${time}\nStarted P${startPos} • ${inc}x • SOF ${sof}${irStr ? ` • iR ${irStr}` : ''}`,
            inline: false,
          });
        }

        embed.setFooter({ text: `Showing ${recent.length} of ${races.length} recent races` });
      } else {
        embed.setDescription('No recent races found.');
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('[/recentraces]', error);
      await interaction.editReply({ content: '❌ Failed to fetch recent races.' });
    }
  },
};
