const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { relativeCountdown } = require('../utils/time');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('splits')
    .setDescription('Show expected split info for upcoming races')
    .addStringOption((opt) =>
      opt.setName('series').setDescription('Series name').setRequired(true)
    ),

  async execute(interaction) {
    await interaction.deferReply();

    try {
      const api = interaction.client.iracingAPI;
      const query = interaction.options.getString('series');

      let sessions = await api.getEnrichedRaceGuide();

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
        .setTitle(`📊 Split Estimate — "${query}"`)
        .setColor(0x9b59b6)
        .setTimestamp()
        .setDescription('Split estimates based on registration count (~35 drivers per split)');

      if (sessions.length > 0) {
        const nextSession = sessions[0];
        const startTime = nextSession.start_time || nextSession.session_start_time;
        const registered = nextSession.entry_count || nextSession.registered || 0;
        const sof = nextSession.strength_of_field || nextSession.sof || null;
        const countdown = startTime ? relativeCountdown(startTime) : '?';

        const numSplits = registered > 0 ? Math.max(1, Math.ceil(registered / 35)) : 0;

        embed.addFields(
          { name: 'Next Race', value: countdown, inline: true },
          { name: 'Registered', value: `${registered}`, inline: true },
          { name: 'Est. Splits', value: `${numSplits}`, inline: true }
        );

        if (numSplits > 1 && sof) {
          // Rough SOF distribution estimate
          const splitLines = [];
          for (let i = 0; i < Math.min(numSplits, 8); i++) {
            const estSof = Math.round(sof * (1 - (i * 0.15)));
            const label = i === 0 ? '🔝 Top Split' : `Split ${i + 1}`;
            splitLines.push(`${label}: ~**${Math.max(estSof, 800)}** SOF`);
          }

          embed.addFields({
            name: 'Estimated SOF by Split',
            value: splitLines.join('\n'),
            inline: false,
          });
        }

        // Show next few sessions too
        if (sessions.length > 1) {
          const upcoming = sessions.slice(1, 4).map((s) => {
            const t = s.start_time || s.session_start_time;
            const reg = s.entry_count || s.registered || 0;
            return `${relativeCountdown(t)} — ${reg} registered`;
          });

          embed.addFields({
            name: 'Upcoming Sessions',
            value: upcoming.join('\n'),
            inline: false,
          });
        }
      } else {
        embed.setDescription(`No upcoming races found for **"${query}"**.`);
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('[/splits]', error);
      await interaction.editReply({ content: '❌ Failed to fetch split data.' });
    }
  },
};
