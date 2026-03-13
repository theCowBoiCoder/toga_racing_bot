const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { buildPaginationRow } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('standings')
    .setDescription('Show championship standings for a series')
    .addStringOption((opt) =>
      opt.setName('series').setDescription('Series name to search for').setRequired(true)
    ),

  async execute(interaction) {
    await interaction.deferReply();

    try {
      const api = interaction.client.iracingAPI;
      const query = interaction.options.getString('series');

      // Find the season
      const seasons = await api.findSeasonsBySeriesName(query);

      if (seasons.length === 0) {
        await interaction.editReply({ content: `❌ No series found matching **"${query}"**.` });
        return;
      }

      const season = seasons[0];
      const seasonId = season.season_id;

      const standingsData = await api.getSeasonStandings(seasonId);
      const standings = standingsData?.standings || standingsData || [];

      const embed = new EmbedBuilder()
        .setTitle(`🏆 Standings — ${season.series_name}`)
        .setColor(0xffd700)
        .setTimestamp();

      if (Array.isArray(standings) && standings.length > 0) {
        const top = standings.slice(0, 15);

        const lines = top.map((entry, i) => {
          const pos = i + 1;
          const name = entry.display_name || entry.driver_name || 'Unknown';
          const points = entry.points || entry.total_points || 0;
          const starts = entry.starts || entry.race_starts || 0;
          const wins = entry.wins || 0;

          let medal = '';
          if (pos === 1) medal = '🥇';
          else if (pos === 2) medal = '🥈';
          else if (pos === 3) medal = '🥉';
          else medal = `**${pos}.**`;

          return `${medal} ${name} — **${points}pts** (${starts} starts, ${wins} wins)`;
        });

        embed.setDescription(lines.join('\n'));
        embed.setFooter({ text: `Showing top ${top.length} of ${standings.length} drivers` });
      } else {
        embed.setDescription('No standings data available yet.');
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('[/standings]', error);
      await interaction.editReply({ content: '❌ Failed to fetch standings.' });
    }
  },
};
