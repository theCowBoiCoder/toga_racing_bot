const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { licenseEmoji } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('randomrace')
    .setDescription('Pick a random series to race in!'),

  async execute(interaction) {
    await interaction.deferReply();

    try {
      const api = interaction.client.iracingAPI;
      const seasons = await api.getFullSchedule();

      if (!Array.isArray(seasons) || seasons.length === 0) {
        await interaction.editReply({ content: '❌ No active series found.' });
        return;
      }

      // Pick a random season
      const random = seasons[Math.floor(Math.random() * seasons.length)];

      const sched = random.schedules || random.schedule || [];
      const weekEntry = sched.find((w) => w.race_week_num === random.race_week_num) || sched[0];
      const trackName = weekEntry?.track?.track_name
        || random.track_name
        || 'TBD';
      const weekNum = random.race_week_num != null ? random.race_week_num + 1 : '?';
      const license = licenseEmoji(random.license_group);

      const embed = new EmbedBuilder()
        .setTitle('🎲 Random Race Pick!')
        .setColor(0xff6b6b)
        .setDescription('The racing gods have chosen...')
        .setTimestamp()
        .addFields(
          { name: '🏁 Series', value: `${license} **${random.series_name || 'Unknown'}**`, inline: false },
          { name: '📍 Track', value: `**${trackName}**`, inline: true },
          { name: '📅 Week', value: `${weekNum}`, inline: true }
        );

      if (random.fixed_setup !== undefined) {
        embed.addFields({
          name: 'Setup',
          value: random.fixed_setup ? '🔧 Fixed' : '🔧 Open',
          inline: true,
        });
      }

      embed.setFooter({ text: `Picked from ${seasons.length} active series • Don't like it? Run /randomrace again!` });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('[/randomrace]', error);
      await interaction.editReply({ content: '❌ Failed to pick a random race.' });
    }
  },
};
