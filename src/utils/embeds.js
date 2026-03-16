const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { dateWithCountdown, relativeCountdown, discordTimestamp } = require('./time');

// Category colors
const CATEGORY_COLORS = {
  road: 0x3498db,      // Blue
  oval: 0xe74c3c,      // Red
  dirt_road: 0xe67e22,  // Orange
  dirt_oval: 0x9b59b6,  // Purple
  sports_car: 0x2ecc71, // Green
  formula_car: 0xf1c40f, // Yellow
  default: 0x95a5a6,    // Grey
};

// License class emojis
const LICENSE_EMOJI = {
  R: '🟠',  // Rookie
  D: '🟡',  // D
  C: '🟢',  // C
  B: '🔵',  // B
  A: '🟣',  // A
  P: '⚪',  // Pro
};

/**
 * Pick color based on category name.
 */
function getCategoryColor(categoryName) {
  if (!categoryName) return CATEGORY_COLORS.default;
  const lower = categoryName.toLowerCase();
  if (lower.includes('dirt') && lower.includes('oval')) return CATEGORY_COLORS.dirt_oval;
  if (lower.includes('dirt') && lower.includes('road')) return CATEGORY_COLORS.dirt_road;
  if (lower.includes('oval')) return CATEGORY_COLORS.oval;
  if (lower.includes('formula')) return CATEGORY_COLORS.formula_car;
  if (lower.includes('sports')) return CATEGORY_COLORS.sports_car;
  if (lower.includes('road')) return CATEGORY_COLORS.road;
  return CATEGORY_COLORS.default;
}

/**
 * Get license emoji.
 */
function licenseEmoji(licenseGroup) {
  // License group is usually a number, map to letter
  const map = { 1: 'R', 2: 'D', 3: 'C', 4: 'B', 5: 'A', 6: 'P' };
  const letter = map[licenseGroup] || licenseGroup;
  return LICENSE_EMOJI[letter] || '⚪';
}

/**
 * Build a schedule embed for a list of seasons/series.
 */
function buildScheduleEmbed(seasons, title, page = 0, pageSize = 8) {
  const totalPages = Math.ceil(seasons.length / pageSize);
  const pageSeasons = seasons.slice(page * pageSize, (page + 1) * pageSize);

  const embed = new EmbedBuilder()
    .setTitle(`🏁 ${title}`)
    .setColor(0x1a1a2e)
    .setTimestamp()
    .setFooter({ text: `Page ${page + 1}/${totalPages} • ${seasons.length} series` });

  for (const season of pageSeasons) {
    const sched = season.schedules || season.schedule || [];
    const weekNum = season.race_week_num != null ? season.race_week_num + 1 : '?';
    const weekEntry = sched.find((w) => w.race_week_num === season.race_week_num) || sched[0];
    const trackName = weekEntry?.track?.track_name
      || season.track_name
      || 'TBD';
    const license = licenseEmoji(season.license_group);

    embed.addFields({
      name: `${license} ${season.series_name || 'Unknown Series'}`,
      value: `📍 **${trackName}**\n📅 Week ${weekNum}`,
      inline: true,
    });
  }

  if (pageSeasons.length === 0) {
    embed.setDescription('No series found matching your criteria.');
  }

  return { embed, totalPages };
}

/**
 * Build an upcoming races embed from race guide data.
 */
function buildUpcomingEmbed(sessions, title = 'Upcoming Races', page = 0, pageSize = 8) {
  const totalPages = Math.ceil(sessions.length / pageSize);
  const pageSessions = sessions.slice(page * pageSize, (page + 1) * pageSize);

  const embed = new EmbedBuilder()
    .setTitle(`⏱️ ${title}`)
    .setColor(0x00d4aa)
    .setTimestamp()
    .setFooter({ text: `Page ${page + 1}/${totalPages} • ${sessions.length} upcoming` });

  for (const session of pageSessions) {
    const seriesName = session.series_name || 'Unknown Series';
    const trackName = session.track?.track_name || session.track_name || 'TBD';
    const startTime = session.start_time || session.session_start_time;

    let timeStr = 'Time TBD';
    if (startTime) {
      timeStr = dateWithCountdown(startTime);
    }

    embed.addFields({
      name: `🏎️ ${seriesName}`,
      value: `📍 ${trackName}\n⏰ ${timeStr}`,
      inline: false,
    });
  }

  if (pageSessions.length === 0) {
    embed.setDescription('No upcoming races found.');
  }

  return { embed, totalPages };
}

/**
 * Build a detailed series embed.
 */
function buildSeriesEmbed(season, trackMap) {
  const embed = new EmbedBuilder()
    .setTitle(`🏁 ${season.series_name || 'Unknown Series'}`)
    .setColor(getCategoryColor(season.category))
    .setTimestamp();

  if (season.series_short_name) {
    embed.setDescription(season.series_short_name);
  }

  // Current week info
  const schedule = season.schedules || season.schedule || [];
  const currentWeek = season.race_week_num != null ? season.race_week_num : 0;

  if (schedule.length > 0) {
    // Show current week and next 2 weeks
    const weeksToShow = schedule.slice(currentWeek, currentWeek + 3);

    for (let i = 0; i < weeksToShow.length; i++) {
      const week = weeksToShow[i];
      const weekNum = currentWeek + i + 1;
      const trackName = week.track?.track_name
        || (trackMap && week.track_id ? trackMap.get(week.track_id)?.track_name : null)
        || 'TBD';
      const prefix = i === 0 ? '▶️ Current' : `Week ${weekNum}`;

      embed.addFields({
        name: `${prefix} — Week ${weekNum}`,
        value: `📍 **${trackName}**`,
        inline: true,
      });
    }
  }

  // Add metadata
  const meta = [];
  if (season.license_group) meta.push(`License: ${licenseEmoji(season.license_group)}`);
  if (season.fixed_setup !== undefined) meta.push(season.fixed_setup ? '🔧 Fixed' : '🔧 Open');
  if (season.official !== undefined) meta.push(season.official ? '✅ Official' : '🏠 Unofficial');

  if (meta.length > 0) {
    embed.addFields({ name: 'Info', value: meta.join(' • '), inline: false });
  }

  return embed;
}

/**
 * Build pagination buttons.
 */
function buildPaginationRow(currentPage, totalPages, customIdPrefix) {
  if (totalPages <= 1) return null;

  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${customIdPrefix}_prev_${currentPage}`)
      .setLabel('◀ Previous')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(currentPage === 0),
    new ButtonBuilder()
      .setCustomId(`${customIdPrefix}_page`)
      .setLabel(`${currentPage + 1}/${totalPages}`)
      .setStyle(ButtonStyle.Primary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId(`${customIdPrefix}_next_${currentPage}`)
      .setLabel('Next ▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(currentPage >= totalPages - 1)
  );
}

module.exports = {
  buildScheduleEmbed,
  buildUpcomingEmbed,
  buildSeriesEmbed,
  buildPaginationRow,
  getCategoryColor,
  licenseEmoji,
  CATEGORY_COLORS,
};
