const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const CATEGORIES = {
  road: { id: 2, name: 'Road', emoji: '🛣️' },
  oval: { id: 1, name: 'Oval', emoji: '🏟️' },
  dirt_road: { id: 4, name: 'Dirt Road', emoji: '🌾' },
  dirt_oval: { id: 3, name: 'Dirt Oval', emoji: '🎪' },
  sports_car: { id: 5, name: 'Sports Car', emoji: '🏁' },
  formula_car: { id: 6, name: 'Formula Car', emoji: '🏎️' },
};

/**
 * Build a detailed iRating embed for a single category.
 */
async function buildSingleCategoryEmbed(api, custId, displayName, cat) {
  const chartData = await api.getMemberChartData(custId, cat.id, 1);
  const dataPoints = chartData?.data || chartData || [];

  const embed = new EmbedBuilder()
    .setTitle(`📈 iRating History — ${displayName}`)
    .setDescription(`**Category:** ${cat.emoji} ${cat.name}`)
    .setColor(0xf39c12)
    .setTimestamp();

  if (Array.isArray(dataPoints) && dataPoints.length > 0) {
    const recent = dataPoints.slice(-15);
    const max = Math.max(...recent.map((d) => d.value || d[1] || 0));
    const min = Math.min(...recent.map((d) => d.value || d[1] || 0));
    const current = recent[recent.length - 1];
    const currentIR = current.value || current[1] || 0;
    const first = recent[0];
    const firstIR = first.value || first[1] || 0;
    const change = currentIR - firstIR;
    const changeStr = change >= 0 ? `+${change}` : `${change}`;
    const arrow = change >= 0 ? '📈' : '📉';

    embed.addFields(
      { name: 'Current iRating', value: `**${currentIR}**`, inline: true },
      { name: 'Recent Change', value: `${arrow} ${changeStr}`, inline: true },
      { name: 'Range', value: `${min} — ${max}`, inline: true }
    );

    const range = max - min || 1;
    const bars = recent.map((d) => {
      const val = d.value || d[1] || 0;
      const level = Math.round(((val - min) / range) * 7);
      return ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'][level] || '▁';
    });

    embed.addFields({
      name: `Last ${recent.length} data points`,
      value: `\`${bars.join('')}\`\n${min} ← → ${max}`,
      inline: false,
    });
  } else {
    embed.setDescription(`No iRating data found for **${cat.name}** category.`);
  }

  return embed;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('irating')
    .setDescription('Show iRating history for a driver')
    .addStringOption((opt) =>
      opt.setName('name').setDescription('Driver name').setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName('category')
        .setDescription('Racing category')
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
      const name = interaction.options.getString('name');
      const category = interaction.options.getString('category');

      // Find the driver
      const results = await api.searchDrivers(name);
      const drivers = results?.results || results || [];

      if (!Array.isArray(drivers) || drivers.length === 0) {
        await interaction.editReply({ content: `❌ No drivers found matching **"${name}"**.` });
        return;
      }

      const driver = drivers[0];
      const custId = driver.cust_id;

      // If a specific category was chosen, show detailed view for that one
      if (category) {
        const cat = CATEGORIES[category];
        const embed = await buildSingleCategoryEmbed(api, custId, driver.display_name || name, cat);
        await interaction.editReply({ embeds: [embed] });
        return;
      }

      // No category specified — show all categories
      const catEntries = Object.values(CATEGORIES);
      const chartResults = await Promise.all(
        catEntries.map((cat) =>
          api.getMemberChartData(custId, cat.id, 1).catch(() => null)
        )
      );

      const embed = new EmbedBuilder()
        .setTitle(`📈 iRating Overview — ${driver.display_name || name}`)
        .setColor(0xf39c12)
        .setTimestamp();

      let hasData = false;

      for (let i = 0; i < catEntries.length; i++) {
        const cat = catEntries[i];
        const chartData = chartResults[i];
        const dataPoints = chartData?.data || chartData || [];

        if (!Array.isArray(dataPoints) || dataPoints.length === 0) continue;

        hasData = true;
        const recent = dataPoints.slice(-15);
        const max = Math.max(...recent.map((d) => d.value || d[1] || 0));
        const min = Math.min(...recent.map((d) => d.value || d[1] || 0));
        const current = recent[recent.length - 1];
        const currentIR = current.value || current[1] || 0;
        const first = recent[0];
        const firstIR = first.value || first[1] || 0;
        const change = currentIR - firstIR;
        const changeStr = change >= 0 ? `+${change}` : `${change}`;
        const arrow = change >= 0 ? '📈' : '📉';

        // Text sparkline
        const range = max - min || 1;
        const bars = recent.map((d) => {
          const val = d.value || d[1] || 0;
          const level = Math.round(((val - min) / range) * 7);
          return ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'][level] || '▁';
        });

        embed.addFields({
          name: `${cat.emoji} ${cat.name}`,
          value: `**${currentIR}** iR  ${arrow} ${changeStr}\n\`${bars.join('')}\`  (${min} — ${max})`,
          inline: false,
        });
      }

      if (!hasData) {
        embed.setDescription('No iRating data found for any category.');
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('[/irating]', error);
      await interaction.editReply({ content: '❌ Failed to fetch iRating data.' });
    }
  },
};
