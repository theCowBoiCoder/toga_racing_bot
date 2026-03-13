const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('streak')
    .setDescription('Show a driver\'s current win and podium streaks')
    .addStringOption((opt) =>
      opt.setName('name').setDescription('Driver name').setRequired(true)
    ),

  async execute(interaction) {
    await interaction.deferReply();

    try {
      const api = interaction.client.iracingAPI;
      const name = interaction.options.getString('name');

      // Find the driver
      const results = await api.searchDrivers(name);
      const drivers = results?.results || results || [];

      if (!Array.isArray(drivers) || drivers.length === 0) {
        await interaction.editReply({ content: `❌ No drivers found matching **"${name}"**.` });
        return;
      }

      const driver = drivers[0];
      const custId = driver.cust_id;

      const recentData = await api.getMemberRecentRaces(custId);
      const races = recentData?.races || recentData || [];

      const embed = new EmbedBuilder()
        .setTitle(`🔥 Streaks — ${driver.display_name || name}`)
        .setColor(0xff9500)
        .setTimestamp();

      if (!Array.isArray(races) || races.length === 0) {
        embed.setDescription('No recent races found.');
        await interaction.editReply({ embeds: [embed] });
        return;
      }

      // Calculate streaks (from most recent backwards)
      let currentWinStreak = 0;
      let currentPodiumStreak = 0;
      let currentTopFiveStreak = 0;
      let currentCleanStreak = 0; // 0 incidents
      let longestWinStreak = 0;
      let longestPodiumStreak = 0;
      let totalWins = 0;
      let totalPodiums = 0;
      let totalClean = 0;

      // Track "current" = consecutive from most recent
      let winStreakBroken = false;
      let podiumStreakBroken = false;
      let topFiveStreakBroken = false;
      let cleanStreakBroken = false;

      // Temp for longest
      let tempWinStreak = 0;
      let tempPodiumStreak = 0;

      for (const race of races) {
        const pos = race.finish_position != null ? race.finish_position + 1 : 999;
        const inc = race.incidents ?? 999;

        // Wins
        if (pos === 1) {
          totalWins++;
          tempWinStreak++;
          if (!winStreakBroken) currentWinStreak++;
        } else {
          winStreakBroken = true;
          longestWinStreak = Math.max(longestWinStreak, tempWinStreak);
          tempWinStreak = 0;
        }

        // Podiums (P1-P3)
        if (pos <= 3) {
          totalPodiums++;
          tempPodiumStreak++;
          if (!podiumStreakBroken) currentPodiumStreak++;
        } else {
          podiumStreakBroken = true;
          longestPodiumStreak = Math.max(longestPodiumStreak, tempPodiumStreak);
          tempPodiumStreak = 0;
        }

        // Top 5
        if (pos <= 5 && !topFiveStreakBroken) {
          currentTopFiveStreak++;
        } else {
          topFiveStreakBroken = true;
        }

        // Clean races (0x)
        if (inc === 0) {
          totalClean++;
          if (!cleanStreakBroken) currentCleanStreak++;
        } else {
          cleanStreakBroken = true;
        }
      }

      longestWinStreak = Math.max(longestWinStreak, tempWinStreak);
      longestPodiumStreak = Math.max(longestPodiumStreak, tempPodiumStreak);

      embed.addFields(
        { name: '🏆 Current Win Streak', value: `**${currentWinStreak}**`, inline: true },
        { name: '🥇 Best Win Streak', value: `**${longestWinStreak}**`, inline: true },
        { name: '📊 Total Wins', value: `**${totalWins}** / ${races.length}`, inline: true },
        { name: '🥉 Current Podium Streak', value: `**${currentPodiumStreak}**`, inline: true },
        { name: '🏅 Best Podium Streak', value: `**${longestPodiumStreak}**`, inline: true },
        { name: '📊 Total Podiums', value: `**${totalPodiums}** / ${races.length}`, inline: true },
        { name: '🏎️ Current Top 5 Streak', value: `**${currentTopFiveStreak}**`, inline: true },
        { name: '✨ Current Clean Streak', value: `**${currentCleanStreak}** (0x races)`, inline: true },
        { name: '📊 Total Clean Races', value: `**${totalClean}** / ${races.length}`, inline: true }
      );

      embed.setFooter({ text: `Based on ${races.length} recent races` });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('[/streak]', error);
      await interaction.editReply({ content: '❌ Failed to calculate streaks.' });
    }
  },
};
