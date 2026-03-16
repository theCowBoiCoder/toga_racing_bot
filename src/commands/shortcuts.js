const { SlashCommandBuilder } = require('discord.js');
const { buildScheduleEmbed, buildSeriesEmbed, buildUpcomingEmbed, buildPaginationRow } = require('../utils/embeds');

/**
 * Shortcut definitions: command name -> search terms to match against series names.
 */
const SHORTCUTS = {
  gt3: { name: 'GT3', search: ['gt3'] },
  gt4: { name: 'GT4', search: ['gt4'] },
  gte: { name: 'GTE', search: ['gte'] },
  lmp2: { name: 'LMP2', search: ['lmp2'] },
  lmp3: { name: 'LMP3', search: ['lmp3'] },
  f1: { name: 'Formula 1', search: ['grand prix', 'formula 1', 'f1'] },
  f3: { name: 'Formula 3', search: ['formula 3', 'ir-04', 'f3'] },
  f4: { name: 'Formula 4', search: ['formula 4', 'formula vee', 'f4'] },
  tcr: { name: 'TCR', search: ['tcr', 'touring car'] },
  supercars: { name: 'Supercars', search: ['supercars', 'v8'] },
  skippy: { name: 'Skip Barber', search: ['skip barber', 'skippy'] },
  mx5: { name: 'MX-5', search: ['mx-5', 'mx5', 'mazda'] },
  imsa: { name: 'IMSA', search: ['imsa'] },
  nascar: { name: 'NASCAR', search: ['nascar'] },
  indycar: { name: 'IndyCar', search: ['indycar', 'indy'] },
  porsche: { name: 'Porsche Cup', search: ['porsche cup', 'porsche'] },
  ferrari: { name: 'Ferrari', search: ['ferrari'] },
  lambo: { name: 'Lamborghini', search: ['lamborghini', 'lambo'] },
  pcup: { name: 'Porsche Cup', search: ['porsche cup'] },
  sprint: { name: 'Sprint Car', search: ['sprint car', 'sprint'] },
  trucks: { name: 'Trucks', search: ['truck'] },
  arca: { name: 'ARCA', search: ['arca'] },
};

/**
 * Build all shortcut command modules.
 */
function buildShortcutCommands() {
  return Object.entries(SHORTCUTS).map(([cmd, { name, search }]) => ({
    data: new SlashCommandBuilder()
      .setName(cmd)
      .setDescription(`Show this week's ${name} schedule and upcoming races`),

    async execute(interaction) {
      await interaction.deferReply();

      try {
        const api = interaction.client.iracingAPI;
        const seasons = await api.getFullSchedule();

        // Filter seasons matching any of the search terms
        const matched = seasons.filter((s) => {
          const sName = (s.series_name || '').toLowerCase();
          const sShort = (s.series_short_name || '').toLowerCase();
          return search.some((term) => sName.includes(term) || sShort.includes(term));
        });

        matched.sort((a, b) => (a.series_name || '').localeCompare(b.series_name || ''));

        // Week 13 / off-season fallback: if no season data, check the race guide
        if (matched.length === 0) {
          // Race guide sessions only have series_id, not names.
          // Resolve names from the series list.
          const [raceGuide, seriesMap, seasonMap] = await Promise.all([
            api.getRaceGuide(),
            api.getSeriesMap(),
            api.getSeasonMap(),
          ]);
          let sessions = raceGuide?.sessions || (Array.isArray(raceGuide) ? raceGuide : []);

          const now = new Date();
          sessions = sessions
            .map((s) => {
              // Enrich with series name and track from lookups
              const info = seriesMap.get(s.series_id);
              const season = seasonMap.get(s.season_id);
              const sched = season?.schedules || season?.schedule || [];
              const weekEntry = sched.find((w) => w.race_week_num === s.race_week_num);
              const trackName = weekEntry?.track?.track_name;
              return {
                ...s,
                series_name: s.series_name || info?.series_name || 'Unknown Series',
                series_short_name: s.series_short_name || info?.series_short_name || '',
                track_name: s.track?.track_name || s.track_name || trackName || 'TBD',
              };
            })
            .filter((s) => {
              const startTime = s.start_time || s.session_start_time;
              if (!startTime || new Date(startTime) <= now) return false;
              const sName = (s.series_name || '').toLowerCase();
              const sShort = (s.series_short_name || '').toLowerCase();
              return search.some((term) => sName.includes(term) || sShort.includes(term));
            });

          sessions.sort((a, b) => {
            const timeA = new Date(a.start_time || a.session_start_time);
            const timeB = new Date(b.start_time || b.session_start_time);
            return timeA - timeB;
          });

          sessions = sessions.slice(0, 50);

          if (sessions.length === 0) {
            await interaction.editReply({
              content: `❌ No **${name}** series or upcoming races found. This may be Week 13 (off-season transition).`,
            });
            return;
          }

          // Show upcoming sessions from the race guide
          const title = `${name} — Upcoming Races (Week 13)`;
          const { embed, totalPages } = buildUpcomingEmbed(sessions, title, 0);
          const row = buildPaginationRow(0, totalPages, cmd);

          const replyOptions = { embeds: [embed] };
          if (row) replyOptions.components = [row];

          const message = await interaction.editReply(replyOptions);

          if (totalPages > 1) {
            const collector = message.createMessageComponentCollector({ time: 120_000 });

            collector.on('collect', async (i) => {
              if (i.user.id !== interaction.user.id) {
                await i.reply({ content: 'These buttons are not for you.', ephemeral: true });
                return;
              }

              let page = parseInt(i.customId.split('_').pop());
              if (i.customId.includes('_next_')) page++;
              else if (i.customId.includes('_prev_')) page--;

              const { embed: newEmbed } = buildUpcomingEmbed(sessions, title, page);
              const newRow = buildPaginationRow(page, totalPages, cmd);

              const updateOptions = { embeds: [newEmbed] };
              if (newRow) updateOptions.components = [newRow];
              await i.update(updateOptions);
            });

            collector.on('end', () => {
              interaction.editReply({ components: [] }).catch(() => {});
            });
          }
          return;
        }

        // Single match — show detail
        if (matched.length === 1) {
          const trackMap = await api.getTrackMap();
          const embed = buildSeriesEmbed(matched[0], trackMap);
          await interaction.editReply({ embeds: [embed] });
          return;
        }

        // Multiple matches — paginated list
        const title = `${name} Series — This Week`;
        const { embed, totalPages } = buildScheduleEmbed(matched, title, 0);
        const row = buildPaginationRow(0, totalPages, cmd);

        const replyOptions = { embeds: [embed] };
        if (row) replyOptions.components = [row];

        const message = await interaction.editReply(replyOptions);

        if (totalPages > 1) {
          const collector = message.createMessageComponentCollector({ time: 120_000 });

          collector.on('collect', async (i) => {
            if (i.user.id !== interaction.user.id) {
              await i.reply({ content: 'These buttons are not for you.', ephemeral: true });
              return;
            }

            let page = parseInt(i.customId.split('_').pop());
            if (i.customId.includes('_next_')) page++;
            else if (i.customId.includes('_prev_')) page--;

            const { embed: newEmbed } = buildScheduleEmbed(matched, title, page);
            const newRow = buildPaginationRow(page, totalPages, cmd);

            const updateOptions = { embeds: [newEmbed] };
            if (newRow) updateOptions.components = [newRow];
            await i.update(updateOptions);
          });

          collector.on('end', () => {
            interaction.editReply({ components: [] }).catch(() => {});
          });
        }
      } catch (error) {
        console.error(`[/${cmd}]`, error);
        await interaction.editReply({
          content: `❌ Failed to fetch ${name} schedule. The iRacing API may be unavailable.`,
        });
      }
    },
  }));
}

module.exports = buildShortcutCommands;
