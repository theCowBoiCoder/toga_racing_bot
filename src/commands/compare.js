const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { licenseEmoji } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('compare')
    .setDescription('Compare two iRacing drivers head-to-head')
    .addStringOption((opt) =>
      opt.setName('driver1').setDescription('First driver name').setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName('driver2').setDescription('Second driver name').setRequired(true)
    ),

  async execute(interaction) {
    await interaction.deferReply();

    try {
      const api = interaction.client.iracingAPI;
      const name1 = interaction.options.getString('driver1');
      const name2 = interaction.options.getString('driver2');

      // Search both drivers
      const [results1, results2] = await Promise.all([
        api.searchDrivers(name1),
        api.searchDrivers(name2),
      ]);

      const drivers1 = results1?.results || results1 || [];
      const drivers2 = results2?.results || results2 || [];

      if (!Array.isArray(drivers1) || drivers1.length === 0) {
        await interaction.editReply({ content: `❌ Driver **"${name1}"** not found.` });
        return;
      }
      if (!Array.isArray(drivers2) || drivers2.length === 0) {
        await interaction.editReply({ content: `❌ Driver **"${name2}"** not found.` });
        return;
      }

      const d1 = drivers1[0];
      const d2 = drivers2[0];

      // Get both profiles
      const [profile1, profile2] = await Promise.all([
        api.getMemberProfile(d1.cust_id).catch(() => null),
        api.getMemberProfile(d2.cust_id).catch(() => null),
      ]);

      const embed = new EmbedBuilder()
        .setTitle(`⚔️ ${d1.display_name || name1} vs ${d2.display_name || name2}`)
        .setColor(0xe74c3c)
        .setTimestamp();

      // Compare licenses across categories
      const lics1 = profile1?.licenses || profile1?.license || [];
      const lics2 = profile2?.licenses || profile2?.license || [];

      if (Array.isArray(lics1) && Array.isArray(lics2)) {
        // Match by category
        for (const l1 of lics1) {
          const catId = l1.category_id;
          const l2 = lics2.find((l) => l.category_id === catId);
          if (!l2) continue;

          const catName = l1.category || l1.cat_name || `Category ${catId}`;
          const ir1 = l1.irating || 0;
          const ir2 = l2.irating || 0;
          const sr1 = l1.safety_rating != null ? (l1.safety_rating / 100).toFixed(2) : '?';
          const sr2 = l2.safety_rating != null ? (l2.safety_rating / 100).toFixed(2) : '?';
          const lic1 = l1.group_name || '?';
          const lic2 = l2.group_name || '?';

          const irWinner = ir1 > ir2 ? '◀' : ir1 < ir2 ? '▶' : '=';

          embed.addFields({
            name: `📊 ${catName}`,
            value: [
              `**iRating:** ${ir1} ${irWinner} ${ir2}`,
              `**SR:** ${sr1} vs ${sr2}`,
              `**License:** ${lic1} vs ${lic2}`,
            ].join('\n'),
            inline: true,
          });
        }
      }

      if (embed.data.fields?.length === 0) {
        embed.setDescription('Both drivers found but detailed comparison data is unavailable.');
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('[/compare]', error);
      await interaction.editReply({ content: '❌ Failed to compare drivers.' });
    }
  },
};
