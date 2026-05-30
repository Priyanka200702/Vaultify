const axios = require('axios');

const STREAM_TIMEOUT = 60000;
const DEFAULT_TIMEOUT = 30000;

const proxyClient = axios.create({
  timeout: DEFAULT_TIMEOUT,
  maxRedirects: 0,
  validateStatus: () => true,
});

function getProxyClient(isStreaming = false) {
  return axios.create({
    timeout: isStreaming ? STREAM_TIMEOUT : DEFAULT_TIMEOUT,
    maxRedirects: 0,
    validateStatus: () => true,
  });
}

module.exports = { proxyClient, getProxyClient, STREAM_TIMEOUT, DEFAULT_TIMEOUT };
