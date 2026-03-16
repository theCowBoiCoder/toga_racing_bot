const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { relativeCountdown } = require('../utils/time');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('sof')
    .setDescription('Show strength of field for upcoming races in a series')
    .addStringOption((opt) =>
      opt.setName('series').setDescription('Series name').setRequired(true)
    ),

  async execute(interaction) {
    await interaction.deferReply();

    try {
      const api = interaction.client.iracingAPI;
      const query = interaction.options.getString('series');

      let sessions = await api.getEnrichedRaceGuide();

      // Filter by series name
      const q = query.toLowerCase();
      sessions = sessions.filter((s) => {
        const name = (s.series_name || '').toLowerCase();
        const short = (s.series_short_name || '').toLowerCase();
        return name.includes(q) || short.includes(q);
      });

      // Only future sessions
      const now = new Date();
      sessions = sessions.filter((s) => {
        const t = s.start_time || s.session_start_time;
        return t && new Date(t) > now;
      });

      sessions.sort((a, b) => {
        return new Date(a.start_time || a.session_start_time) - new Date(b.start_time || b.session_start_time);
      });

      const embed = new EmbedBuilder()
        .setTitle(`💪 Strength of Field — "${query}"`)
        .setColor(0xe74c3c)
        .setTimestamp();

      if (sessions.length > 0) {
        const show = sessions.slice(0, 8);

        for (const s of show) {
          const startTime = s.start_time || s.session_start_time;
          const sof = s.strength_of_field || s.sof || 'TBD';
          const registered = s.entry_count || s.registered || '?';
          const countdown = startTime ? relativeCountdown(startTime) : '?';

          embed.addFields({
            name: `${s.series_name || query}`,
            value: `⏰ ${countdown}\n👥 ${registered} registered • 💪 SOF: **${sof}**`,
            inline: false,
          });
        }

        embed.setFooter({ text: `${sessions.length} upcoming sessions found` });
      } else {
        embed.setDescription(`No upcoming races found for **"${query}"**.`);
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('[/sof]', error);
      await interaction.editReply({ content: '❌ Failed to fetch SOF data.' });
    }
  },
};
