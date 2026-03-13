const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const CATEGORIES = {
  road: { id: 2, name: 'Road' },
  oval: { id: 1, name: 'Oval' },
  dirt_road: { id: 4, name: 'Dirt Road' },
  dirt_oval: { id: 3, name: 'Dirt Oval' },
  sports_car: { id: 5, name: 'Sports Car' },
  formula_car: { id: 6, name: 'Formula Car' },
};

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
      const category = interaction.options.getString('category') || 'road';
      const cat = CATEGORIES[category];

      // Find the driver
      const results = await api.searchDrivers(name);
      const drivers = results?.results || results || [];

      if (!Array.isArray(drivers) || drivers.length === 0) {
        await interaction.editReply({ content: `❌ No drivers found matching **"${name}"**.` });
        return;
      }

      const driver = drivers[0];
      const custId = driver.cust_id;

      // Get iRating chart data
      const chartData = await api.getMemberChartData(custId, cat.id, 1);
      const dataPoints = chartData?.data || chartData || [];

      const embed = new EmbedBuilder()
        .setTitle(`📈 iRating History — ${driver.display_name || name}`)
        .setDescription(`**Category:** ${cat.name}`)
        .setColor(0xf39c12)
        .setTimestamp();

      if (Array.isArray(dataPoints) && dataPoints.length > 0) {
        // Show recent data points as a text-based chart
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
          { name: `Recent Change`, value: `${arrow} ${changeStr}`, inline: true },
          { name: 'Range', value: `${min} — ${max}`, inline: true }
        );

        // Text sparkline of last 15 races
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

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('[/irating]', error);
      await interaction.editReply({ content: '❌ Failed to fetch iRating data.' });
    }
  },
};
