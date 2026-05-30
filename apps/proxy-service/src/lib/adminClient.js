const { createInternalClient } = require('@vaultify/utils');
const { env } = require('../config/env');

let adminClient;

function getAdminClient() {
  if (!adminClient) {
    adminClient = createInternalClient(env.ADMIN_SERVICE_URL, {
      apiKey: env.INTERNAL_API_KEY,
      certPath: env.PROXY_TLS_CERT,
      keyPath: env.PROXY_TLS_KEY,
      caPath: env.TLS_CA,
      timeout: 10000,
    });
  }
  return adminClient;
}

async function decryptKey(keyId) {
  const client = getAdminClient();
  const response = await client.post(`/internal/vault/decrypt/${keyId}`);
  return response.data.rawKey;
}

module.exports = { decryptKey };
