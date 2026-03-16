const { EmbedBuilder } = require('discord.js');
const { dateWithCountdown, relativeCountdown, discordTimestamp } = require('./utils/time');
const { buildScheduleEmbed } = require('./utils/embeds');
const store = require('./store');

// Special events to watch for (can be extended)
const SPECIAL_EVENTS = [
  'daytona 24',
  'spa 24',
  'bathurst',
  'le mans',
  'nurburgring 24',
  'petit le mans',
  'sebring 12',
  'suzuka 10',
  'road america',
];

class Automation {
  constructor(client) {
    this.client = client;
    this.alertChannelId = process.env.ALERT_CHANNEL_ID || null;
    this.scheduleChannelId = process.env.SCHEDULE_CHANNEL_ID || null;
    this.reportChannelId = process.env.RACE_REPORT_CHANNEL_ID || this.alertChannelId;
    this.intervals = [];
  }

  /**
   * Start all automation tasks.
   */
  start() {
    if (!this.alertChannelId && !this.scheduleChannelId) {
      console.log('[Automation] No channel IDs configured, skipping automation.');
      console.log('[Automation] Set ALERT_CHANNEL_ID and/or SCHEDULE_CHANNEL_ID in .env to enable.');
      return;
    }

    console.log('[Automation] Starting background tasks...');

    // Check for race alerts every 5 minutes
    if (this.alertChannelId) {
      this.intervals.push(
        setInterval(() => this.checkRaceAlerts(), 5 * 60 * 1000)
      );
      console.log(`[Automation] Race alerts enabled → channel ${this.alertChannelId}`);
    }

    // Check for weekly schedule change every hour
    if (this.scheduleChannelId) {
      this.intervals.push(
        setInterval(() => this.checkWeeklySchedule(), 60 * 60 * 1000)
      );
      console.log(`[Automation] Weekly schedule posts enabled → channel ${this.scheduleChannelId}`);
    }

    // Check for special events daily
    if (this.alertChannelId) {
      this.intervals.push(
        setInterval(() => this.checkSpecialEvents(), 24 * 60 * 60 * 1000)
      );
      // Also run once on startup after a delay
      setTimeout(() => this.checkSpecialEvents(), 30 * 1000);
      console.log(`[Automation] Special event alerts enabled`);
    }

    // Auto race reports for linked members every 3 minutes
    if (this.reportChannelId) {
      this.intervals.push(
        setInterval(() => this.checkRaceReports(), 3 * 60 * 1000)
      );
      // Initial check after 60s to let things settle
      setTimeout(() => this.checkRaceReports(), 60 * 1000);
      console.log(`[Automation] Auto race reports enabled → channel ${this.reportChannelId}`);
    }
  }

  /**
   * Stop all automation tasks.
   */
  stop() {
    for (const interval of this.intervals) {
      clearInterval(interval);
    }
    this.intervals = [];
  }

  /**
   * Send race alerts 15 minutes before popular races start.
   */
  async checkRaceAlerts() {
    try {
      const api = this.client.iracingAPI;
      const raceGuide = await api.getRaceGuide();
      let sessions = raceGuide?.sessions || raceGuide || [];

      const now = Date.now();
      const fifteenMin = 15 * 60 * 1000;

      // Find sessions starting in the next 15-20 minutes
      const upcoming = sessions.filter((s) => {
        const startTime = s.start_time || s.session_start_time;
        if (!startTime) return false;
        const diff = new Date(startTime).getTime() - now;
        return diff > 0 && diff <= fifteenMin && diff > (fifteenMin - 5 * 60 * 1000);
      });

      if (upcoming.length === 0) return;

      const channel = await this.client.channels.fetch(this.alertChannelId).catch(() => null);
      if (!channel) return;

      for (const session of upcoming) {
        const registered = session.entry_count || session.registered || 0;
        // Only alert for races with decent participation
        if (registered < 15) continue;

        const embed = new EmbedBuilder()
          .setTitle('🏁 Race Starting Soon!')
          .setColor(0xff4444)
          .setTimestamp()
          .addFields(
            { name: 'Series', value: session.series_name || 'Unknown', inline: true },
            { name: 'Track', value: session.track?.track_name || 'TBD', inline: true },
            { name: 'Starts', value: relativeCountdown(session.start_time || session.session_start_time), inline: true },
            { name: 'Registered', value: `${registered} drivers`, inline: true }
          );

        await channel.send({ embeds: [embed] });
      }
    } catch (error) {
      console.error('[Automation] Race alert error:', error.message);
    }
  }

  /**
   * Post the new weekly schedule every Tuesday (when iRacing rotates).
   */
  async checkWeeklySchedule() {
    try {
      const now = new Date();
      // iRacing week changes Tuesday at ~00:00 UTC
      // Only post if it's Tuesday and between 00:00-01:00 UTC
      if (now.getUTCDay() !== 2 || now.getUTCHours() !== 0) return;

      // Check if we already posted this week
      const weekKey = `_schedule_posted_${now.toISOString().slice(0, 10)}`;
      const api = this.client.iracingAPI;
      if (api.cache.get(weekKey)) return;

      const channel = await this.client.channels.fetch(this.scheduleChannelId).catch(() => null);
      if (!channel) return;

      const seasons = await api.getFullSchedule();
      if (!Array.isArray(seasons) || seasons.length === 0) return;

      // Sort by series name
      seasons.sort((a, b) => (a.series_name || '').localeCompare(b.series_name || ''));

      const { embed } = buildScheduleEmbed(seasons, '📅 New Week Schedule!', 0, 15);
      embed.setDescription('The weekly track rotation has changed! Here\'s what\'s on this week:');

      await channel.send({ embeds: [embed] });

      // Mark as posted
      api.cache.set(weekKey, true);
    } catch (error) {
      console.error('[Automation] Weekly schedule error:', error.message);
    }
  }

  /**
   * Alert about upcoming special events.
   */
  async checkSpecialEvents() {
    try {
      const api = this.client.iracingAPI;
      const seasons = await api.getFullSchedule();

      const specials = seasons.filter((s) => {
        const name = (s.series_name || '').toLowerCase();
        return SPECIAL_EVENTS.some((ev) => name.includes(ev));
      });

      if (specials.length === 0) return;

      const channel = await this.client.channels.fetch(this.alertChannelId).catch(() => null);
      if (!channel) return;

      // Only alert once per event
      for (const event of specials) {
        const alertKey = `_special_alerted_${event.season_id}`;
        if (api.cache.get(alertKey)) continue;

        const embed = new EmbedBuilder()
          .setTitle('🌟 Special Event Alert!')
          .setColor(0xffd700)
          .setTimestamp()
          .addFields(
            { name: 'Event', value: event.series_name || 'Special Event', inline: false },
            {
              name: 'Track',
              value: event.schedule?.[0]?.track?.track_name || 'TBD',
              inline: true,
            }
          );

        await channel.send({ embeds: [embed] });
        api.cache.set(alertKey, true);
      }
    } catch (error) {
      console.error('[Automation] Special events error:', error.message);
    }
  }
  /**
   * Poll linked members for new race results and auto-post reports.
   */
  async checkRaceReports() {
    try {
      const allLinks = store.getAllLinks();
      const entries = Object.entries(allLinks);
      if (entries.length === 0) return;

      const api = this.client.iracingAPI;
      const channel = await this.client.channels.fetch(this.reportChannelId).catch(() => null);
      if (!channel) return;

      for (const [discordUserId, { cust_id: custId, display_name: displayName }] of entries) {
        try {
          const recentData = await api.getMemberRecentRacesLive(custId);
          const races = recentData?.races || recentData || [];
          if (!Array.isArray(races) || races.length === 0) continue;

          // Check the most recent race
          const latest = races[0];
          const subsessionId = latest.subsession_id;
          if (!subsessionId) continue;

          // Already reported?
          if (store.isRaceReported(custId, subsessionId)) continue;

          // Mark immediately to avoid duplicates
          store.markRaceReported(custId, subsessionId);

          // Build the report
          const embed = this.buildRaceReportEmbed(latest, displayName, discordUserId);
          await channel.send({ embeds: [embed] });

          console.log(`[Automation] Posted race report for ${displayName} (subsession ${subsessionId})`);
        } catch (err) {
          console.error(`[Automation] Race report error for ${displayName}:`, err.message);
        }
      }
    } catch (error) {
      console.error('[Automation] Race reports poll error:', error.message);
    }
  }

  /**
   * Build a race report embed from recent race data.
   */
  buildRaceReportEmbed(race, displayName, discordUserId) {
    const finishPos = race.finish_position != null ? race.finish_position + 1 : '?';
    const startPos = race.start_position != null ? race.start_position + 1 : '?';
    const incidents = race.incidents ?? '?';
    const sof = race.strength_of_field ?? '?';
    const seriesName = race.series_name || 'Unknown Series';
    const trackName = race.track?.track_name || race.track_name || 'Unknown Track';
    const lapsComplete = race.laps_complete || 0;
    const lapsLed = race.laps_led || 0;

    // Position emoji
    let posEmoji;
    if (finishPos === 1) posEmoji = '🥇';
    else if (finishPos === 2) posEmoji = '🥈';
    else if (finishPos === 3) posEmoji = '🥉';
    else posEmoji = `P${finishPos}`;

    // iRating change
    let irChange = '';
    let irEmoji = '';
    if (race.newi_rating != null && race.oldi_rating != null) {
      const diff = race.newi_rating - race.oldi_rating;
      irChange = diff >= 0 ? `+${diff}` : `${diff}`;
      irEmoji = diff >= 0 ? '📈' : '📉';
    }

    // SR change
    let srChange = '';
    if (race.new_sub_level != null && race.old_sub_level != null) {
      const oldSR = (race.old_sub_level / 100).toFixed(2);
      const newSR = (race.new_sub_level / 100).toFixed(2);
      const diff = (race.new_sub_level - race.old_sub_level) / 100;
      const diffStr = diff >= 0 ? `+${diff.toFixed(2)}` : diff.toFixed(2);
      srChange = `${oldSR} → ${newSR} (${diffStr})`;
    }

    // Positions gained/lost
    let posChange = '';
    if (typeof startPos === 'number' && typeof finishPos === 'number') {
      const diff = startPos - finishPos;
      if (diff > 0) posChange = `⬆️ Gained ${diff} position${diff > 1 ? 's' : ''}`;
      else if (diff < 0) posChange = `⬇️ Lost ${Math.abs(diff)} position${Math.abs(diff) > 1 ? 's' : ''}`;
      else posChange = '➡️ Held position';
    }

    // Color based on result
    let color = 0x95a5a6; // grey
    if (finishPos === 1) color = 0xffd700; // gold
    else if (finishPos <= 3) color = 0x2ecc71; // green
    else if (finishPos <= 5) color = 0x3498db; // blue
    else if (finishPos <= 10) color = 0xf39c12; // orange

    const embed = new EmbedBuilder()
      .setTitle(`🏁 Race Report — ${displayName}`)
      .setColor(color)
      .setTimestamp();

    // Tag the user
    embed.setDescription(`<@${discordUserId}> just finished a race!`);

    embed.addFields(
      { name: 'Series', value: seriesName, inline: true },
      { name: 'Track', value: trackName, inline: true },
      { name: '\u200B', value: '\u200B', inline: true }, // spacer
    );

    embed.addFields(
      { name: 'Finish', value: `${posEmoji}`, inline: true },
      { name: 'Started', value: `P${startPos}`, inline: true },
      { name: 'Movement', value: posChange || '—', inline: true },
    );

    if (irChange) {
      embed.addFields(
        { name: `iRating ${irEmoji}`, value: `**${race.newi_rating}** (${irChange})`, inline: true },
      );
    }

    if (srChange) {
      embed.addFields(
        { name: 'Safety Rating', value: srChange, inline: true },
      );
    }

    embed.addFields(
      { name: 'Incidents', value: `${incidents}x`, inline: true },
    );

    embed.addFields(
      { name: 'SOF', value: typeof sof === 'number' ? sof.toLocaleString() : `${sof}`, inline: true },
      { name: 'Laps', value: `${lapsComplete} completed${lapsLed > 0 ? ` • ${lapsLed} led` : ''}`, inline: true },
    );

    if (race.session_start_time) {
      embed.addFields(
        { name: 'Race Time', value: discordTimestamp(race.session_start_time, 'f'), inline: true },
      );
    }

    return embed;
  }
}

module.exports = Automation;
