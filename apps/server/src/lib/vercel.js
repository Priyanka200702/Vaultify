const axios = require('axios');
const { env } = require('../config/env');

const VERCEL_API_BASE = 'https://api.vercel.com';

/**
 * Creates a Vercel API client using the configured token.
 */
function getVercelClient() {
  if (!env.VERCEL_API_TOKEN) {
    throw new Error('VERCEL_API_TOKEN is not set. Required for Vercel integration.');
  }

  return axios.create({
    baseURL: VERCEL_API_BASE,
    headers: {
      Authorization: `Bearer ${env.VERCEL_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Gets environment variables for a Vercel project.
 */
async function getEnvVars(projectId) {
  const client = getVercelClient();
  const response = await client.get(`/v9/projects/${projectId}/env`);
  return response.data.envs;
}

/**
 * Sets an environment variable in a Vercel project.
 */
async function setEnvVar(projectId, key, value, targets = ['production', 'preview', 'development']) {
  const client = getVercelClient();
  const response = await client.post(`/v10/projects/${projectId}/env`, {
    type: 'encrypted',
    key,
    value,
    target: targets,
  });
  return response.data;
}

/**
 * Deletes an environment variable from a Vercel project.
 */
async function deleteEnvVar(projectId, envId) {
  const client = getVercelClient();
  await client.delete(`/v9/projects/${projectId}/env/${envId}`);
}

module.exports = { getVercelClient, getEnvVars, setEnvVar, deleteEnvVar };
