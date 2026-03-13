const { SlashCommandBuilder } = require('discord.js');
const { buildUpcomingEmbed, buildPaginationRow } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('upcoming')
    .setDescription('Show upcoming iRacing races with countdown timers')
    .addStringOption((option) =>
      option
        .setName('series')
        .setDescription('Filter by series name (optional)')
        .setRequired(false)
    ),

  async execute(interaction) {
    await interaction.deferReply();

    try {
      const api = interaction.client.iracingAPI;
      const seriesFilter = interaction.options.getString('series');

      const raceGuide = await api.getRaceGuide();

      // The race guide returns sessions — extract and sort by start time
      let sessions = [];

      if (raceGuide && raceGuide.sessions) {
        sessions = raceGuide.sessions;
      } else if (Array.isArray(raceGuide)) {
        sessions = raceGuide;
      }

      // Filter to only future sessions
      const now = new Date();
      sessions = sessions.filter((s) => {
        const startTime = s.start_time || s.session_start_time;
        return startTime && new Date(startTime) > now;
      });

      // Filter by series name if specified
      if (seriesFilter) {
        const q = seriesFilter.toLowerCase();
        sessions = sessions.filter(
          (s) =>
            s.series_name?.toLowerCase().includes(q) ||
            s.series_short_name?.toLowerCase().includes(q)
        );
      }

      // Sort by start time (soonest first)
      sessions.sort((a, b) => {
        const timeA = new Date(a.start_time || a.session_start_time);
        const timeB = new Date(b.start_time || b.session_start_time);
        return timeA - timeB;
      });

      // Limit to reasonable amount
      sessions = sessions.slice(0, 50);

      const title = seriesFilter
        ? `Upcoming Races — "${seriesFilter}"`
        : 'Upcoming Races';

      const { embed, totalPages } = buildUpcomingEmbed(sessions, title, 0);
      const row = buildPaginationRow(0, totalPages, 'upcoming');

      const replyOptions = { embeds: [embed] };
      if (row) replyOptions.components = [row];

      const message = await interaction.editReply(replyOptions);

      if (totalPages > 1) {
        const collector = message.createMessageComponentCollector({ time: 120_000 });

        collector.on('collect', async (i) => {
          if (i.user.id !== interaction.user.id) {
            await i.reply({ content: 'These buttons are not for you.', ephemeral: true });
            return;
          }

          let page = parseInt(i.customId.split('_').pop());
          if (i.customId.includes('_next_')) page++;
          else if (i.customId.includes('_prev_')) page--;

          const { embed: newEmbed } = buildUpcomingEmbed(sessions, title, page);
          const newRow = buildPaginationRow(page, totalPages, 'upcoming');

          const updateOptions = { embeds: [newEmbed] };
          if (newRow) updateOptions.components = [newRow];
          await i.update(updateOptions);
        });

        collector.on('end', () => {
          interaction.editReply({ components: [] }).catch(() => {});
        });
      }
    } catch (error) {
      console.error('[/upcoming]', error);
      await interaction.editReply({
        content: '❌ Failed to fetch upcoming races. The iRacing API may be unavailable.',
      });
    }
  },
};
