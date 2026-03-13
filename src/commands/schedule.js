const { SlashCommandBuilder } = require('discord.js');
const { buildScheduleEmbed, buildPaginationRow } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('schedule')
    .setDescription('Show the current week schedule for all iRacing series')
    .addStringOption((option) =>
      option
        .setName('category')
        .setDescription('Filter by racing category')
        .setRequired(false)
        .addChoices(
          { name: 'Road', value: 'road' },
          { name: 'Oval', value: 'oval' },
          { name: 'Dirt Road', value: 'dirt_road' },
          { name: 'Dirt Oval', value: 'dirt_oval' },
          { name: 'Sports Car', value: 'sports_car' },
          { name: 'Formula Car', value: 'formula_car' }
        )
    ),

  async execute(interaction) {
    await interaction.deferReply();

    try {
      const api = interaction.client.iracingAPI;
      const category = interaction.options.getString('category');

      let seasons = await api.getFullSchedule();

      // Filter by category if specified
      if (category) {
        const categoryMap = {
          road: [1, 2],         // Road category IDs (may include sports car/formula)
          oval: [3, 4],         // Oval category IDs
          dirt_road: [5],       // Dirt road
          dirt_oval: [6],       // Dirt oval
          sports_car: [2],      // Sports car
          formula_car: [1],     // Formula car
        };

        // Also do name-based matching as a fallback
        const nameFilters = {
          road: 'road',
          oval: 'oval',
          dirt_road: 'dirt road',
          dirt_oval: 'dirt oval',
          sports_car: 'sports car',
          formula_car: 'formula',
        };

        seasons = seasons.filter((s) => {
          const catIds = categoryMap[category] || [];
          const nameFilter = nameFilters[category] || '';

          return (
            catIds.includes(s.category_id) ||
            s.category?.toLowerCase().includes(nameFilter) ||
            s.license_category?.toLowerCase().includes(nameFilter)
          );
        });
      }

      // Sort by series name
      seasons.sort((a, b) => (a.series_name || '').localeCompare(b.series_name || ''));

      const categoryLabel = category
        ? category.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())
        : 'All Categories';

      const title = `This Week's Schedule — ${categoryLabel}`;
      const { embed, totalPages } = buildScheduleEmbed(seasons, title, 0);
      const row = buildPaginationRow(0, totalPages, 'schedule');

      const replyOptions = { embeds: [embed] };
      if (row) replyOptions.components = [row];

      const message = await interaction.editReply(replyOptions);

      // Handle pagination
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

          const { embed: newEmbed } = buildScheduleEmbed(seasons, title, page);
          const newRow = buildPaginationRow(page, totalPages, 'schedule');

          const updateOptions = { embeds: [newEmbed] };
          if (newRow) updateOptions.components = [newRow];

          await i.update(updateOptions);
        });

        collector.on('end', () => {
          interaction.editReply({ components: [] }).catch(() => {});
        });
      }
    } catch (error) {
      console.error('[/schedule]', error);
      await interaction.editReply({
        content: '❌ Failed to fetch schedule. The iRacing API may be unavailable.',
      });
    }
  },
};
