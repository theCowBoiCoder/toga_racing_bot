const https = require('https');
const crypto = require('crypto');
const { URL } = require('url');

const TOKEN_URL = 'https://oauth.iracing.com/oauth2/token';

/**
 * Mask a secret with its identifier using SHA-256 + base64.
 * For passwords, id = username (email). For client_secret, id = client_id.
 */
function mask(secret, id) {
  return crypto.createHash('sha256').update(secret + id).digest('base64');
}

class IracingAuth {
  constructor({ username, password, clientId, clientSecret }) {
    this.username = username;
    this.password = password;
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.accessToken = null;
    this.tokenExpiry = null;
    this.refreshToken = null;
    this.refreshTokenExpiry = null;
  }

  /**
   * Get a valid access token, refreshing if expired.
   */
  async getToken() {
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    // Try refresh token first if available
    if (this.refreshToken && this.refreshTokenExpiry && Date.now() < this.refreshTokenExpiry) {
      try {
        return await this._refreshAccessToken();
      } catch (e) {
        console.log('[iRacing Auth] Refresh failed, re-authenticating:', e.message);
      }
    }

    return this.requestToken();
  }

  /**
   * Request a new access token via Password Limited grant.
   */
  async requestToken() {
    const params = new URLSearchParams({
      grant_type: 'password_limited',
      username: this.username,
      password: mask(this.password, this.username),
      client_id: this.clientId,
      client_secret: mask(this.clientSecret, this.clientId),
      scope: 'iracing.auth',
    });

    return this._tokenRequest(params);
  }

  /**
   * Refresh the access token using the refresh token.
   */
  async _refreshAccessToken() {
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: this.clientId,
      client_secret: mask(this.clientSecret, this.clientId),
      refresh_token: this.refreshToken,
    });

    return this._tokenRequest(params);
  }

  /**
   * Make a token request to the iRacing OAuth2 endpoint.
   */
  async _tokenRequest(params) {
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

              if (json.refresh_token) {
                this.refreshToken = json.refresh_token;
                this.refreshTokenExpiry = Date.now() + (json.refresh_token_expires_in - 60) * 1000;
              }

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
