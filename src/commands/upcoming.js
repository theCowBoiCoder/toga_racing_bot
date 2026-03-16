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

      const [raceGuide, seriesMap, seasonMap] = await Promise.all([
        api.getRaceGuide(),
        api.getSeriesMap(),
        api.getSeasonMap(),
      ]);

      // The race guide returns sessions — extract, enrich with series names, and sort
      let sessions = [];

      if (raceGuide && raceGuide.sessions) {
        sessions = raceGuide.sessions;
      } else if (Array.isArray(raceGuide)) {
        sessions = raceGuide;
      }

      // Race guide only has series_id — resolve names and tracks
      sessions = sessions.map((s) => {
        const info = seriesMap.get(s.series_id);
        // Resolve track from season schedule
        const season = seasonMap.get(s.season_id);
        const sched = season?.schedules || season?.schedule || [];
        const weekEntry = sched.find((w) => w.race_week_num === s.race_week_num);
        const trackName = weekEntry?.track?.track_name;

        return {
          ...s,
          series_name: s.series_name || info?.series_name || 'Unknown Series',
          series_short_name: s.series_short_name || info?.series_short_name || '',
          track_name: s.track?.track_name || s.track_name || trackName || 'TBD',
        };
      });

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
