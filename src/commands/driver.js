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

      // Fetch profile, member info, and career stats in parallel
      const [profile, memberInfo, careerStats] = await Promise.all([
        api.getMemberProfile(custId).catch(() => null),
        api.getMemberInfo(custId).catch(() => null),
        api.getMemberCareerStats(custId).catch(() => null),
      ]);

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

      // Member since from profile
      if (profile?.member_since) {
        fields.push({ name: 'Member Since', value: profile.member_since, inline: true });
      }

      // License/rating info — prefer member/get data, fall back to profile
      const members = memberInfo?.members || (Array.isArray(memberInfo) ? memberInfo : [memberInfo]);
      const member = members?.find?.((m) => m?.cust_id === custId) || members?.[0];
      const licenses = member?.licenses || profile?.licenses || profile?.license || [];

      if (Array.isArray(licenses) && licenses.length > 0) {
        for (const lic of licenses) {
          const catName = lic.category || lic.cat_name || `Cat ${lic.category_id}`;
          const emoji = licenseEmoji(lic.group_id || (lic.license_level ? Math.ceil(lic.license_level / 4) : null));
          const sr = lic.safety_rating != null ? (lic.safety_rating / 100).toFixed(2) : '?';
          const ir = lic.irating != null ? lic.irating.toLocaleString() : '—';
          const licLevel = lic.group_name || lic.license_level || '?';

          fields.push({
            name: `${emoji} ${catName}`,
            value: `**iRating:** ${ir}\n**SR:** ${sr}\n**License:** ${licLevel}`,
            inline: true,
          });
        }
      }

      // Career stats summary
      const stats = Array.isArray(careerStats) ? careerStats : [];
      if (stats.length > 0) {
        let totalStarts = 0, totalWins = 0, totalTop5 = 0, totalPodiums = 0, totalLaps = 0;

        for (const cat of stats) {
          totalStarts += cat.starts || 0;
          totalWins += cat.wins || 0;
          totalTop5 += cat.top5 || 0;
          totalPodiums += cat.top3 || 0;
          totalLaps += cat.laps_complete || cat.laps || 0;
        }

        const winRate = totalStarts > 0 ? ((totalWins / totalStarts) * 100).toFixed(1) : '0.0';
        const top5Rate = totalStarts > 0 ? ((totalTop5 / totalStarts) * 100).toFixed(1) : '0.0';

        fields.push({
          name: '📊 Career Overview',
          value: [
            `**Starts:** ${totalStarts.toLocaleString()}`,
            `**Wins:** ${totalWins.toLocaleString()} (${winRate}%)`,
            `**Podiums:** ${totalPodiums.toLocaleString()}`,
            `**Top 5:** ${totalTop5.toLocaleString()} (${top5Rate}%)`,
            `**Laps:** ${totalLaps.toLocaleString()}`,
          ].join('\n'),
          inline: false,
        });

        // Per-category breakdown (only categories with starts)
        const activeCats = stats.filter((c) => c.starts > 0);
        if (activeCats.length > 0 && activeCats.length <= 6) {
          for (const cat of activeCats) {
            const catName = cat.category || `Category ${cat.category_id}`;
            fields.push({
              name: `🏁 ${catName}`,
              value: [
                `Starts: ${cat.starts}`,
                `Wins: ${cat.wins || 0}`,
                `Avg Inc: ${cat.avg_incidents != null ? cat.avg_incidents.toFixed(1) : '—'}`,
                `Avg Finish: ${cat.avg_finish != null ? cat.avg_finish.toFixed(1) : '—'}`,
              ].join(' • '),
              inline: true,
            });
          }
        }
      }

      if (fields.length <= 2) {
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
