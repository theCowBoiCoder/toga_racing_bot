const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { relativeCountdown } = require('../utils/time');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('participation')
    .setDescription('Show how many drivers are registered for upcoming races')
    .addStringOption((opt) =>
      opt.setName('series').setDescription('Series name').setRequired(true)
    ),

  async execute(interaction) {
    await interaction.deferReply();

    try {
      const api = interaction.client.iracingAPI;
      const query = interaction.options.getString('series');

      const raceGuide = await api.getRaceGuide();
      let sessions = raceGuide?.sessions || raceGuide || [];

      const q = query.toLowerCase();
      sessions = sessions.filter((s) => {
        const name = (s.series_name || '').toLowerCase();
        const short = (s.series_short_name || '').toLowerCase();
        return name.includes(q) || short.includes(q);
      });

      const now = new Date();
      sessions = sessions.filter((s) => {
        const t = s.start_time || s.session_start_time;
        return t && new Date(t) > now;
      });

      sessions.sort((a, b) =>
        new Date(a.start_time || a.session_start_time) - new Date(b.start_time || b.session_start_time)
      );

      const embed = new EmbedBuilder()
        .setTitle(`👥 Participation — "${query}"`)
        .setColor(0x3498db)
        .setTimestamp();

      if (sessions.length > 0) {
        const show = sessions.slice(0, 10);

        for (const s of show) {
          const startTime = s.start_time || s.session_start_time;
          const registered = s.entry_count || s.registered || 0;
          const countdown = startTime ? relativeCountdown(startTime) : '?';

          // Estimate splits (iRacing usually splits at ~30-40 drivers)
          const estSplits = registered > 0 ? Math.max(1, Math.ceil(registered / 35)) : '?';

          const bar = registered > 0
            ? '█'.repeat(Math.min(20, Math.ceil(registered / 5))) + ` ${registered}`
            : 'No registrations';

          embed.addFields({
            name: `⏰ ${countdown}`,
            value: `👥 **${registered}** registered • ~${estSplits} split(s)\n\`${bar}\``,
            inline: false,
          });
        }

        embed.setFooter({ text: `${sessions.length} upcoming sessions for ${query}` });
      } else {
        embed.setDescription(`No upcoming races found for **"${query}"**.`);
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('[/participation]', error);
      await interaction.editReply({ content: '❌ Failed to fetch participation data.' });
    }
  },
};
