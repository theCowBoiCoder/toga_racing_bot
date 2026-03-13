const { SlashCommandBuilder } = require('discord.js');
const { buildScheduleEmbed, buildSeriesEmbed, buildPaginationRow } = require('../utils/embeds');

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

        if (matched.length === 0) {
          await interaction.editReply({
            content: `❌ No **${name}** series found in the current season.`,
          });
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
