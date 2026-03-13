const { EmbedBuilder } = require('discord.js');
const { dateWithCountdown, relativeCountdown } = require('./utils/time');
const { buildScheduleEmbed } = require('./utils/embeds');

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
}

module.exports = Automation;
