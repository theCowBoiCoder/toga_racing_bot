const https = require('https');
const Cache = require('./cache');

const API_BASE = 'https://members-ng.iracing.com';

class IracingAPI {
  constructor(auth) {
    this.auth = auth;
    this.cache = new Cache(30 * 60 * 1000); // 30 min TTL
  }

  /**
   * Make an authenticated GET request to the iRacing Data API.
   * The /data endpoints return a JSON with a `link` field pointing to the actual data.
   */
  async request(path) {
    const cached = this.cache.get(path);
    if (cached) return cached;

    const token = await this.auth.getToken();

    // Step 1: Hit the /data endpoint to get the signed URL
    const meta = await this._get(`${API_BASE}${path}`, token);

    // Some endpoints return data directly, others return a link
    let data;
    if (meta.link) {
      data = await this._get(meta.link, null);
    } else {
      data = meta;
    }

    this.cache.set(path, data);
    return data;
  }

  /**
   * Raw HTTPS GET returning parsed JSON.
   */
  _get(urlStr, token) {
    return new Promise((resolve, reject) => {
      const url = new URL(urlStr);
      const options = {
        hostname: url.hostname,
        path: url.pathname + url.search,
        method: 'GET',
        headers: {},
      };

      if (token) {
        options.headers['Authorization'] = `Bearer ${token}`;
      }

      const req = https.request(options, (res) => {
        // Follow redirects
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return this._get(res.headers.location, null).then(resolve).catch(reject);
        }

        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            if (res.statusCode === 401) {
              // Token expired, clear it so next call re-auths
              this.auth.accessToken = null;
              this.auth.tokenExpiry = null;
              reject(new Error('iRacing API: Unauthorized (token expired)'));
              return;
            }
            if (res.statusCode !== 200) {
              reject(new Error(`iRacing API error (${res.statusCode}): ${body.substring(0, 200)}`));
              return;
            }
            resolve(JSON.parse(body));
          } catch (e) {
            reject(new Error(`iRacing API parse error: ${e.message}`));
          }
        });
      });

      req.on('error', reject);
      req.end();
    });
  }

  // ─── Data Methods ───────────────────────────────────────────

  /**
   * Get all series for the current season.
   */
  async getSeries() {
    return this.request('/data/series/get');
  }

  /**
   * Get seasons list. Returns all active seasons with series info.
   */
  async getSeasons() {
    return this.request('/data/series/seasons');
  }

  /**
   * Get the race guide — upcoming sessions across all series.
   */
  async getRaceGuide() {
    return this.request('/data/season/race_guide');
  }

  /**
   * Get all tracks.
   */
  async getTracks() {
    return this.request('/data/track/get');
  }

  /**
   * Get car classes.
   */
  async getCarClasses() {
    return this.request('/data/carclass/get');
  }

  /**
   * Get constants/categories.
   */
  async getCategories() {
    return this.request('/data/constants/categories');
  }

  /**
   * Get season schedule for a specific season ID.
   */
  async getSeasonSchedule(seasonId) {
    return this.request(`/data/season/get?season_id=${seasonId}`);
  }

  // ─── Member / Driver Endpoints ──────────────────────────────

  /**
   * Search for members by name.
   */
  async searchDrivers(searchTerm) {
    return this.request(`/data/lookup/drivers?search_term=${encodeURIComponent(searchTerm)}&league_id=0`);
  }

  /**
   * Get member profile info by cust_id.
   */
  async getMemberProfile(custId) {
    return this.request(`/data/member/profile?cust_id=${custId}`);
  }

  /**
   * Get member info (iRating, SR, license, etc.).
   */
  async getMemberInfo(custIds) {
    const ids = Array.isArray(custIds) ? custIds.join(',') : custIds;
    return this.request(`/data/member/get?cust_ids=${ids}`);
  }

  /**
   * Get iRating / SR chart data for a member.
   * category_id: 1=Oval, 2=Road, 3=Dirt Oval, 4=Dirt Road, 5=Sports Car, 6=Formula Car
   * chart_type: 1=iRating, 2=TT Rating, 3=License/SR
   */
  async getMemberChartData(custId, categoryId = 2, chartType = 1) {
    return this.request(`/data/member/chart_data?cust_id=${custId}&category_id=${categoryId}&chart_type=${chartType}`);
  }

  /**
   * Get recent races for a member.
   */
  async getMemberRecentRaces(custId) {
    return this.request(`/data/stats/member_recent_races?cust_id=${custId}`);
  }

  /**
   * Get member career stats.
   */
  async getMemberCareerStats(custId) {
    return this.request(`/data/stats/member_career?cust_id=${custId}`);
  }

  /**
   * Get member yearly stats.
   */
  async getMemberYearlyStats(custId) {
    return this.request(`/data/stats/member_yearly?cust_id=${custId}`);
  }

  // ─── Season / Standings ─────────────────────────────────────

  /**
   * Get season standings.
   */
  async getSeasonStandings(seasonId, carClassId = null) {
    let path = `/data/season/standings?season_id=${seasonId}`;
    if (carClassId) path += `&car_class_id=${carClassId}`;
    return this.request(path);
  }

  /**
   * Get season results (subsession list).
   */
  async getSeasonResults(seasonId, raceWeekNum = null) {
    let path = `/data/season/results?season_id=${seasonId}`;
    if (raceWeekNum != null) path += `&race_week_num=${raceWeekNum}`;
    return this.request(path);
  }

  /**
   * Get subsession result details.
   */
  async getSubsessionResult(subsessionId) {
    return this.request(`/data/results/get?subsession_id=${subsessionId}`);
  }

  /**
   * Get lap data for a subsession.
   */
  async getLapData(subsessionId, custId = null) {
    let path = `/data/results/lap_data?subsession_id=${subsessionId}`;
    if (custId) path += `&cust_id=${custId}`;
    return this.request(path);
  }

  /**
   * Get recent races for a member (uncached for polling).
   */
  async getMemberRecentRacesLive(custId) {
    const token = await this.auth.getToken();
    const meta = await this._get(`${API_BASE}/data/stats/member_recent_races?cust_id=${custId}`, token);
    if (meta.link) return this._get(meta.link, null);
    return meta;
  }

  // ─── Helper Methods ─────────────────────────────────────────

  /**
   * Build a lookup map of tracks by track_id.
   */
  async getTrackMap() {
    const cached = this.cache.get('_trackMap');
    if (cached) return cached;

    const tracks = await this.getTracks();
    const map = new Map();
    if (Array.isArray(tracks)) {
      for (const t of tracks) {
        map.set(t.track_id, t);
      }
    }
    this.cache.set('_trackMap', map);
    return map;
  }

  /**
   * Search series by name (fuzzy, case-insensitive).
   */
  async searchSeries(query) {
    const series = await this.getSeries();
    const q = query.toLowerCase();
    return series.filter(
      (s) =>
        s.series_name?.toLowerCase().includes(q) ||
        s.series_short_name?.toLowerCase().includes(q)
    );
  }

  /**
   * Get all active seasons with their schedules, grouped by category.
   */
  async getFullSchedule() {
    const seasons = await this.getSeasons();
    if (!Array.isArray(seasons)) return [];
    return seasons;
  }

  /**
   * Find seasons matching a series name query.
   */
  async findSeasonsBySeriesName(query) {
    const seasons = await this.getFullSchedule();
    const q = query.toLowerCase();
    return seasons.filter(
      (s) =>
        s.series_name?.toLowerCase().includes(q) ||
        s.series_short_name?.toLowerCase().includes(q)
    );
  }
}

module.exports = IracingAPI;
