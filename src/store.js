const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const LINKS_FILE = path.join(DATA_DIR, 'linked-accounts.json');
const REPORTED_FILE = path.join(DATA_DIR, 'reported-races.json');

class Store {
  constructor() {
    // Ensure data directory exists
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    this.links = this._loadFile(LINKS_FILE);
    this.reportedRaces = this._loadFile(REPORTED_FILE);
  }

  _loadFile(filePath) {
    try {
      if (fs.existsSync(filePath)) {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
      }
    } catch (e) {
      console.error(`[Store] Failed to load ${path.basename(filePath)}:`, e.message);
    }
    return {};
  }

  _saveFile(filePath, data) {
    try {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    } catch (e) {
      console.error(`[Store] Failed to save ${path.basename(filePath)}:`, e.message);
    }
  }

  /**
   * Link a Discord user to an iRacing account.
   */
  link(discordUserId, custId, displayName) {
    this.links[discordUserId] = { cust_id: custId, display_name: displayName };
    this._saveFile(LINKS_FILE, this.links);
  }

  /**
   * Unlink a Discord user.
   */
  unlink(discordUserId) {
    delete this.links[discordUserId];
    this._saveFile(LINKS_FILE, this.links);
  }

  /**
   * Get linked iRacing account for a Discord user.
   * Returns { cust_id, display_name } or null.
   */
  getLink(discordUserId) {
    return this.links[discordUserId] || null;
  }

  /**
   * Get all linked accounts.
   */
  getAllLinks() {
    return this.links;
  }

  // ─── Reported Races ───────────────────────────────────────

  /**
   * Check if a race has already been reported for a member.
   */
  isRaceReported(custId, subsessionId) {
    const key = `${custId}`;
    return this.reportedRaces[key]?.includes(subsessionId) || false;
  }

  /**
   * Mark a race as reported for a member.
   * Keeps last 50 per member to avoid unbounded growth.
   */
  markRaceReported(custId, subsessionId) {
    const key = `${custId}`;
    if (!this.reportedRaces[key]) this.reportedRaces[key] = [];
    this.reportedRaces[key].push(subsessionId);
    // Keep only last 50
    if (this.reportedRaces[key].length > 50) {
      this.reportedRaces[key] = this.reportedRaces[key].slice(-50);
    }
    this._saveFile(REPORTED_FILE, this.reportedRaces);
  }
}

module.exports = new Store();
