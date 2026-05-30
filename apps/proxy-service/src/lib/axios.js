const axios = require('axios');

const STREAM_TIMEOUT = 60000;
const DEFAULT_TIMEOUT = 30000;

const proxyClient = axios.create({
  timeout: DEFAULT_TIMEOUT,
  maxRedirects: 0,
  validateStatus: () => true,
});

module.exports = { proxyClient, STREAM_TIMEOUT, DEFAULT_TIMEOUT };
