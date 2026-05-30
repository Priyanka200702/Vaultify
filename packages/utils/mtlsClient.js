const fs = require('fs');
const https = require('https');
const axios = require('axios');

function createMTlsClient(baseURL, { certPath, keyPath, caPath, timeout = 10000 }) {
  const httpsAgent = new https.Agent({
    cert: fs.readFileSync(certPath),
    key: fs.readFileSync(keyPath),
    ca: caPath ? fs.readFileSync(caPath) : undefined,
    rejectUnauthorized: true,
  });

  return axios.create({
    baseURL,
    timeout,
    httpsAgent,
    headers: { 'Content-Type': 'application/json' },
  });
}

function createInternalClient(baseURL, { apiKey, certPath, keyPath, caPath, timeout = 10000 }) {
  if (certPath && keyPath) {
    return createMTlsClient(baseURL, { certPath, keyPath, caPath, timeout });
  }

  return axios.create({
    baseURL,
    timeout,
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Api-Key': apiKey || '',
    },
  });
}

module.exports = { createMTlsClient, createInternalClient };
