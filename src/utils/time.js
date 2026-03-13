/**
 * Convert an ISO date string or Date to a Discord timestamp.
 * Discord format: <t:UNIX_SECONDS:STYLE>
 *
 * Styles:
 *   t = short time (16:20)
 *   T = long time (16:20:30)
 *   d = short date (20/04/2021)
 *   D = long date (20 April 2021)
 *   f = short date/time (20 April 2021 16:20)  [default]
 *   F = long date/time (Tuesday, 20 April 2021 16:20)
 *   R = relative (in 3 hours)
 */
function discordTimestamp(dateStr, style = 'f') {
  const unix = Math.floor(new Date(dateStr).getTime() / 1000);
  return `<t:${unix}:${style}>`;
}

/**
 * Relative countdown: <t:unix:R>
 */
function relativeCountdown(dateStr) {
  return discordTimestamp(dateStr, 'R');
}

/**
 * Full date + relative combo, e.g. "20 April 2021 16:20 (in 3 hours)"
 */
function dateWithCountdown(dateStr) {
  return `${discordTimestamp(dateStr, 'f')} (${relativeCountdown(dateStr)})`;
}

/**
 * Get the current iRacing week number (0-indexed) from season start.
 */
function getCurrentWeek(seasonStart, seasonEnd) {
  const now = Date.now();
  const start = new Date(seasonStart).getTime();
  const elapsed = now - start;
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  return Math.floor(elapsed / weekMs);
}

module.exports = {
  discordTimestamp,
  relativeCountdown,
  dateWithCountdown,
  getCurrentWeek,
};
