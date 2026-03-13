const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { licenseEmoji } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('driver')
    .setDescription('Look up an iRacing driver by name')
    .addStringOption((opt) =>
      opt.setName('name').setDescription('Driver name to search for').setRequired(true)
    ),

  async execute(interaction) {
    await interaction.deferReply();

    try {
      const api = interaction.client.iracingAPI;
      const name = interaction.options.getString('name');

      const results = await api.searchDrivers(name);
      const drivers = results?.results || results || [];

      if (!Array.isArray(drivers) || drivers.length === 0) {
        await interaction.editReply({ content: `❌ No drivers found matching **"${name}"**.` });
        return;
      }

      // Use the first match, get their full profile
      const driver = drivers[0];
      const custId = driver.cust_id;

      let profile;
      try {
        profile = await api.getMemberProfile(custId);
      } catch {
        profile = null;
      }

      const embed = new EmbedBuilder()
        .setTitle(`🏎️ ${driver.display_name || driver.name || name}`)
        .setColor(0x1a8cff)
        .setTimestamp();

      if (custId) {
        embed.setURL(`https://members.iracing.com/membersite/member/CareerStats.do?custid=${custId}`);
      }

      const fields = [];

      if (driver.club_name) fields.push({ name: 'Club', value: driver.club_name, inline: true });
      if (custId) fields.push({ name: 'Customer ID', value: `${custId}`, inline: true });

      // License/rating info from profile
      if (profile) {
        const licenses = profile.licenses || profile.license || [];
        if (Array.isArray(licenses)) {
          for (const lic of licenses) {
            const catName = lic.category || lic.cat_name || `Cat ${lic.category_id}`;
            const emoji = licenseEmoji(lic.license_level ? Math.ceil(lic.license_level / 4) : null);
            const sr = lic.safety_rating != null ? (lic.safety_rating / 100).toFixed(2) : '?';
            const ir = lic.irating || '?';
            const licLevel = lic.group_name || lic.license_level || '?';

            fields.push({
              name: `${emoji} ${catName}`,
              value: `**iRating:** ${ir}\n**SR:** ${sr}\n**License:** ${licLevel}`,
              inline: true,
            });
          }
        }

        if (profile.member_since) {
          fields.push({ name: 'Member Since', value: profile.member_since, inline: true });
        }
      }

      if (fields.length === 0) {
        embed.setDescription('Driver found but detailed stats are unavailable.');
      }

      embed.addFields(fields);

      // If multiple results, add a note
      if (drivers.length > 1) {
        embed.setFooter({ text: `Showing top match of ${drivers.length} results` });
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('[/driver]', error);
      await interaction.editReply({ content: '❌ Failed to look up driver.' });
    }
  },
};
