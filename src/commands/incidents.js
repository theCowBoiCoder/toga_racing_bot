const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('incidents')
    .setDescription('Calculate how many incidents you can afford')
    .addNumberOption((opt) =>
      opt.setName('current_sr').setDescription('Your current Safety Rating (e.g. 2.45)').setRequired(true)
    )
    .addNumberOption((opt) =>
      opt.setName('target_sr').setDescription('Your target Safety Rating (e.g. 3.00)').setRequired(true)
    )
    .addIntegerOption((opt) =>
      opt.setName('corners').setDescription('Corners per lap at your track (check track info)').setRequired(true)
    )
    .addIntegerOption((opt) =>
      opt.setName('laps').setDescription('Number of race laps').setRequired(true)
    ),

  async execute(interaction) {
    const currentSR = interaction.options.getNumber('current_sr');
    const targetSR = interaction.options.getNumber('target_sr');
    const corners = interaction.options.getInteger('corners');
    const laps = interaction.options.getInteger('laps');

    // iRacing SR formula (simplified):
    // SR change ≈ (corners_clean - corners_incident * weight) / total_corners * factor
    // Simplified: each incident costs roughly (1 / total_corners_in_race) * some weight
    // A 0x race at a track with X corners over Y laps gives a small SR boost
    // Each 1x costs approximately: 1 / (corners * laps) * ~35 (rough factor)

    const totalCorners = corners * laps;

    // Approximate: SR change ≈ (totalCorners - incidents * incidentWeight) / totalCorners * baseGain
    // For a clean race, SR gain ≈ 0.04 (rough average)
    // Each incident roughly costs: 0.04 * (incidentWeight / totalCorners)
    // incidentWeight for 1x = ~7 corners worth

    const incidentCostPer1x = 7 / totalCorners; // SR cost per 1x incident (approximate)
    const cleanRaceGain = Math.min(0.06, 35 / totalCorners); // SR gain for 0x race

    const srDiff = targetSR - currentSR;

    const embed = new EmbedBuilder()
      .setTitle('🔢 Incident Calculator')
      .setColor(0xe74c3c)
      .setTimestamp();

    embed.addFields(
      { name: 'Current SR', value: `**${currentSR.toFixed(2)}**`, inline: true },
      { name: 'Target SR', value: `**${targetSR.toFixed(2)}**`, inline: true },
      { name: 'Track', value: `${corners} corners × ${laps} laps = ${totalCorners} total`, inline: true }
    );

    // Max incidents for this race to still gain SR
    const maxIncForGain = Math.floor(cleanRaceGain / incidentCostPer1x);

    embed.addFields(
      { name: '\u200B', value: '\u200B', inline: false },
      {
        name: '🟢 Max incidents to still GAIN SR',
        value: `~**${Math.max(0, maxIncForGain)}x** incidents`,
        inline: true,
      },
      {
        name: '🟡 Breakeven (no SR change)',
        value: `~**${Math.max(0, maxIncForGain + 1)}x** incidents`,
        inline: true,
      }
    );

    // Incidents allowed per race to reach target in N races
    if (srDiff > 0) {
      const racesAt0x = Math.ceil(srDiff / cleanRaceGain);
      embed.addFields({
        name: '🏁 Races needed (0x each)',
        value: `~**${racesAt0x}** clean races to reach ${targetSR.toFixed(2)} SR`,
        inline: false,
      });
    } else {
      embed.addFields({
        name: '✅ Already at or above target!',
        value: `You have **${currentSR.toFixed(2)}** SR, target is **${targetSR.toFixed(2)}**`,
        inline: false,
      });
    }

    embed.setFooter({ text: 'Estimates only — actual SR changes depend on many factors' });

    await interaction.reply({ embeds: [embed] });
  },
};
