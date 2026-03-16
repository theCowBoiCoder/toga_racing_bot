/**
 * Quick test to verify iRacing OAuth2 authentication.
 * Run: node test-auth.js
 */
require('dotenv').config();

const IracingAuth = require('./src/iracing/auth');
const IracingAPI = require('./src/iracing/api');

async function main() {
  console.log('Testing iRacing OAuth2 authentication...\n');

  const auth = new IracingAuth({
    username: process.env.IRACING_USERNAME,
    password: process.env.IRACING_PASSWORD,
    clientId: process.env.IRACING_CLIENT_ID,
    clientSecret: process.env.IRACING_CLIENT_SECRET,
  });

  try {
    const token = await auth.getToken();
    console.log('✅ Auth success! Got access token (first 20 chars):', token.substring(0, 20) + '...');

    // Quick API test — fetch series list
    const api = new IracingAPI(auth);
    console.log('\nFetching series list to verify API access...');
    const series = await api.getSeries();

    if (Array.isArray(series)) {
      console.log(`✅ API works! Got ${series.length} series.`);
      console.log('First series:', series[0]?.series_name || '(unknown)');
    } else {
      console.log('⚠️  Unexpected response format:', JSON.stringify(series).substring(0, 200));
    }
  } catch (err) {
    console.error('❌ Failed:', err.message);
  }
}

main();
