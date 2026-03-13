const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const LINKS_FILE = path.join(DATA_DIR, 'linked-accounts.json');

class Store {
  constructor() {
    // Ensure data directory exists
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    this.links = this._load();
  }

  _load() {
    try {
      if (fs.existsSync(LINKS_FILE)) {
        return JSON.parse(fs.readFileSync(LINKS_FILE, 'utf8'));
      }
    } catch (e) {
      console.error('[Store] Failed to load linked accounts:', e.message);
    }
    return {};
  }

  _save() {
    try {
      fs.writeFileSync(LINKS_FILE, JSON.stringify(this.links, null, 2));
    } catch (e) {
      console.error('[Store] Failed to save linked accounts:', e.message);
    }
  }

  /**
   * Link a Discord user to an iRacing account.
   */
  link(discordUserId, custId, displayName) {
    this.links[discordUserId] = { cust_id: custId, display_name: displayName };
    this._save();
  }

  /**
   * Unlink a Discord user.
   */
  unlink(discordUserId) {
    delete this.links[discordUserId];
    this._save();
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
}

module.exports = new Store();
