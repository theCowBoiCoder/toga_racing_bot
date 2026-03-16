const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

/**
 * Format lap time from seconds to m:ss.xxx
 */
function formatLapTime(seconds) {
  if (seconds == null || seconds <= 0) return '—';
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(3);
  const pad = secs < 10 ? '0' : '';
  return `${mins}:${pad}${secs}`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('laptimes')
    .setDescription('Show fastest laps for a series this week (or a past week)')
    .addStringOption((opt) =>
      opt.setName('series').setDescription('Series name to search for').setRequired(true)
    )
    .addIntegerOption((opt) =>
      opt
        .setName('week')
        .setDescription('Week number (1-13). Defaults to current week.')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(13)
    ),

  async execute(interaction) {
    await interaction.deferReply();

    try {
      const api = interaction.client.iracingAPI;
      const query = interaction.options.getString('series');
      const weekOpt = interaction.options.getInteger('week');

      // 1. Find matching season
      const seasons = await api.getFullSchedule();
      const q = query.toLowerCase();
      const matched = seasons.filter((s) => {
        const sName = (s.series_name || '').toLowerCase();
        const sShort = (s.series_short_name || '').toLowerCase();
        return sName.includes(q) || sShort.includes(q);
      });

      if (matched.length === 0) {
        await interaction.editReply({
          content: `❌ No series found matching **"${query}"**.`,
        });
        return;
      }

      // Use the first match
      const season = matched[0];
      const seasonId = season.season_id;
      const weekNum = weekOpt != null ? weekOpt - 1 : (season.race_week_num ?? 0);

      // 2. Get results for that week
      const results = await api.getSeasonResults(seasonId, weekNum);
      const resultsList = results?.results_list || results?.results || results || [];

      if (!Array.isArray(resultsList) || resultsList.length === 0) {
        await interaction.editReply({
          content: `❌ No results found for **${season.series_name}** Week ${weekNum + 1}.`,
        });
        return;
      }

      // 3. Pick the highest SOF subsession
      const sorted = [...resultsList].sort(
        (a, b) => (b.event_strength_of_field || 0) - (a.event_strength_of_field || 0)
      );
      const topSession = sorted[0];
      const subsessionId = topSession.subsession_id;

      // 4. Fetch full subsession result
      const subsession = await api.getSubsessionResult(subsessionId);

      // Extract driver results across all simsessions (race sessions)
      const allDrivers = [];
      const simsessions = subsession?.session_results || [];

      for (const session of simsessions) {
        // Only look at race sessions (simsession_type 6 = race)
        if (session.simsession_type !== 6 && session.simsession_type_name !== 'Race') continue;

        for (const driver of session.results || []) {
          if (driver.best_lap_time > 0) {
            allDrivers.push({
              name: driver.display_name || `Driver ${driver.cust_id}`,
              bestLap: driver.best_lap_time / 10000, // convert to seconds
              avgLap: driver.average_lap > 0 ? driver.average_lap / 10000 : null,
              finishPos: driver.finish_position + 1,
              carName: driver.car_name || '',
              lapsComplete: driver.laps_complete || 0,
              lapsLed: driver.laps_led || 0,
              incidents: driver.incidents ?? 0,
            });
          }
        }
      }

      // Sort by fastest lap
      allDrivers.sort((a, b) => a.bestLap - b.bestLap);
      const top = allDrivers.slice(0, 10);

      // Track name
      const trackName = subsession.track?.track_name
        || topSession.track?.track_name
        || 'Unknown Track';
      const sof = topSession.event_strength_of_field || subsession.event_strength_of_field || '?';

      const embed = new EmbedBuilder()
        .setTitle(`⏱️ Fastest Laps — ${season.series_name}`)
        .setDescription(`📍 **${trackName}** • Week ${weekNum + 1} • SOF ${typeof sof === 'number' ? sof.toLocaleString() : sof}`)
        .setColor(0xe74c3c)
        .setTimestamp()
        .setFooter({ text: `Subsession ${subsessionId} • ${allDrivers.length} drivers in race` });

      if (top.length > 0) {
        for (let i = 0; i < top.length; i++) {
          const d = top[i];
          let posLabel;
          if (i === 0) posLabel = '🥇';
          else if (i === 1) posLabel = '🥈';
          else if (i === 2) posLabel = '🥉';
          else posLabel = `#${i + 1}`;

          const avgStr = d.avgLap ? ` • Avg: ${formatLapTime(d.avgLap)}` : '';

          embed.addFields({
            name: `${posLabel} ${d.name}`,
            value: `**${formatLapTime(d.bestLap)}**${avgStr}\n${d.carName} • Finished P${d.finishPos} • ${d.lapsComplete} laps • ${d.incidents}x`,
            inline: false,
          });
        }
      } else {
        embed.addFields({
          name: 'No lap data',
          value: 'No valid lap times found for this session.',
          inline: false,
        });
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('[/laptimes]', error);
      await interaction.editReply({
        content: '❌ Failed to fetch lap times. The series may not have results yet this week.',
      });
    }
  },
};
