const { SlashCommandBuilder } = require('discord.js');
const { buildSeriesEmbed, buildScheduleEmbed, buildPaginationRow } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('series')
    .setDescription('Search for an iRacing series by name')
    .addStringOption((option) =>
      option
        .setName('name')
        .setDescription('Series name to search for (e.g. "GT3", "Porsche Cup")')
        .setRequired(true)
    ),

  async execute(interaction) {
    await interaction.deferReply();

    try {
      const api = interaction.client.iracingAPI;
      const query = interaction.options.getString('name');

      const results = await api.findSeasonsBySeriesName(query);

      if (results.length === 0) {
        await interaction.editReply({
          content: `❌ No series found matching **"${query}"**. Try a different search term.`,
        });
        return;
      }

      // If exactly one result, show detailed view
      if (results.length === 1) {
        const trackMap = await api.getTrackMap();
        const embed = buildSeriesEmbed(results[0], trackMap);
        await interaction.editReply({ embeds: [embed] });
        return;
      }

      // Multiple results — show list view with pagination
      const title = `Search Results — "${query}"`;
      const { embed, totalPages } = buildScheduleEmbed(results, title, 0);
      const row = buildPaginationRow(0, totalPages, 'series');

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

          const { embed: newEmbed } = buildScheduleEmbed(results, title, page);
          const newRow = buildPaginationRow(page, totalPages, 'series');

          const updateOptions = { embeds: [newEmbed] };
          if (newRow) updateOptions.components = [newRow];
          await i.update(updateOptions);
        });

        collector.on('end', () => {
          interaction.editReply({ components: [] }).catch(() => {});
        });
      }
    } catch (error) {
      console.error('[/series]', error);
      await interaction.editReply({
        content: '❌ Failed to search series. The iRacing API may be unavailable.',
      });
    }
  },
};
