const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

// License thresholds: to promote, you need >= X.XX SR at the end of the season
// Fast-track: >= 4.00 SR with minimum MPR races
const LICENSE_LEVELS = [
  { name: 'Rookie', letter: 'R', min: 1.00, promote: 3.00, fastTrack: 4.00, color: 0xe67e22 },
  { name: 'D Class', letter: 'D', min: 1.00, promote: 3.00, fastTrack: 4.00, color: 0xf1c40f },
  { name: 'C Class', letter: 'C', min: 1.00, promote: 3.00, fastTrack: 4.00, color: 0x2ecc71 },
  { name: 'B Class', letter: 'B', min: 1.00, promote: 3.00, fastTrack: 4.00, color: 0x3498db },
  { name: 'A Class', letter: 'A', min: 1.00, promote: null, fastTrack: null, color: 0x9b59b6 },
  { name: 'Pro', letter: 'P', min: 1.00, promote: null, fastTrack: null, color: 0xecf0f1 },
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('license')
    .setDescription('Calculate what you need for license promotion')
    .addNumberOption((opt) =>
      opt.setName('current_sr').setDescription('Your current Safety Rating (e.g. 2.45)').setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName('current_license')
        .setDescription('Your current license class')
        .setRequired(true)
        .addChoices(
          { name: 'Rookie', value: 'R' },
          { name: 'D Class', value: 'D' },
          { name: 'C Class', value: 'C' },
          { name: 'B Class', value: 'B' },
          { name: 'A Class', value: 'A' }
        )
    ),

  async execute(interaction) {
    const currentSR = interaction.options.getNumber('current_sr');
    const currentLicense = interaction.options.getString('current_license');

    const level = LICENSE_LEVELS.find((l) => l.letter === currentLicense);
    if (!level) {
      await interaction.reply({ content: '❌ Invalid license class.', ephemeral: true });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle(`📋 License Calculator — ${level.name}`)
      .setColor(level.color)
      .setTimestamp();

    embed.addFields(
      { name: 'Current SR', value: `**${currentSR.toFixed(2)}**`, inline: true },
      { name: 'Current License', value: level.name, inline: true }
    );

    if (level.promote) {
      const srNeeded = Math.max(0, level.promote - currentSR).toFixed(2);
      const fastTrackNeeded = Math.max(0, level.fastTrack - currentSR).toFixed(2);

      const nextLevel = LICENSE_LEVELS[LICENSE_LEVELS.findIndex((l) => l.letter === currentLicense) + 1];
      const nextName = nextLevel ? nextLevel.name : 'Next Class';

      embed.addFields({ name: '\u200B', value: '\u200B', inline: false }); // spacer

      if (currentSR >= level.fastTrack) {
        embed.addFields({
          name: '🚀 Fast Track Eligible!',
          value: `You have **${currentSR.toFixed(2)}** SR (≥ ${level.fastTrack.toFixed(2)})\nYou can fast-track to **${nextName}** once you complete MPR!`,
          inline: false,
        });
      } else if (currentSR >= level.promote) {
        embed.addFields({
          name: '✅ Promotion Ready!',
          value: `You have **${currentSR.toFixed(2)}** SR (≥ ${level.promote.toFixed(2)})\nYou'll be promoted to **${nextName}** at season end!`,
          inline: false,
        });
        embed.addFields({
          name: '🚀 Fast Track',
          value: `Need **+${fastTrackNeeded}** more SR (${level.fastTrack.toFixed(2)}) to fast-track mid-season`,
          inline: false,
        });
      } else {
        embed.addFields({
          name: '📈 Season Promotion',
          value: `Need **+${srNeeded}** more SR to reach **${level.promote.toFixed(2)}** for ${nextName} promotion`,
          inline: false,
        });
        embed.addFields({
          name: '🚀 Fast Track',
          value: `Need **+${fastTrackNeeded}** more SR to reach **${level.fastTrack.toFixed(2)}** for mid-season fast-track`,
          inline: false,
        });
      }

      // Rough estimate of races needed
      // Average SR gain per clean race is roughly +0.03 to +0.05
      const racesForPromo = Math.ceil(Math.max(0, level.promote - currentSR) / 0.04);
      const racesForFT = Math.ceil(Math.max(0, level.fastTrack - currentSR) / 0.04);

      if (currentSR < level.promote) {
        embed.addFields({
          name: '🏁 Estimated Clean Races Needed',
          value: `~**${racesForPromo}** clean races for promotion\n~**${racesForFT}** clean races for fast-track\n*(assumes ~0.04 SR gain per clean race)*`,
          inline: false,
        });
      }
    } else {
      embed.addFields({
        name: '🏆 Top License',
        value: `You're already at **${level.name}** — the highest license class!\nFocus on maintaining your SR and improving your iRating.`,
        inline: false,
      });
    }

    await interaction.reply({ embeds: [embed] });
  },
};
