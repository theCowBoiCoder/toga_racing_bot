const https = require('https');
const { URL } = require('url');

const TOKEN_URL = 'https://oauth.iracing.com/oauth2/token';

class IracingAuth {
  constructor({ username, password, clientId, clientSecret }) {
    this.username = username;
    this.password = password;
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  /**
   * Get a valid access token, refreshing if expired.
   */
  async getToken() {
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }
    return this.requestToken();
  }

  /**
   * Request a new access token via Password Limited grant.
   */
  async requestToken() {
    const params = new URLSearchParams({
      grant_type: 'password',
      username: this.username,
      password: this.password,
      client_id: this.clientId,
      client_secret: this.clientSecret,
      scope: 'iracing.auth',
    });

    const body = params.toString();
    const url = new URL(TOKEN_URL);

    return new Promise((resolve, reject) => {
      const req = https.request(
        {
          hostname: url.hostname,
          path: url.pathname,
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(body),
          },
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            try {
              const json = JSON.parse(data);
              if (res.statusCode !== 200) {
                reject(new Error(`iRacing auth failed (${res.statusCode}): ${json.error_description || json.error || data}`));
                return;
              }
              this.accessToken = json.access_token;
              // Expire 60s early to avoid edge cases
              this.tokenExpiry = Date.now() + (json.expires_in - 60) * 1000;
              console.log('[iRacing Auth] Token acquired, expires in', json.expires_in, 'seconds');
              resolve(this.accessToken);
            } catch (e) {
              reject(new Error(`iRacing auth parse error: ${e.message}`));
            }
          });
        }
      );

      req.on('error', reject);
      req.write(body);
      req.end();
    });
  }
}

module.exports = IracingAuth;
