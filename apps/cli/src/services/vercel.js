const axios = require('axios');

let vercelToken = process.env.VERCEL_TOKEN;

function getVercelClient() {
  if (!vercelToken) {
    throw new Error('VERCEL_TOKEN not set.');
  }

  return axios.create({
    baseURL: 'https://api.vercel.com/v9',
    headers: {
      Authorization: `Bearer ${vercelToken}`,
      'Content-Type': 'application/json',
    },
  });
}

async function getEnvVars(projectId) {
  const client = getVercelClient();
  const response = await client.get(`/projects/${projectId}/env`);
  return response.data.envs || [];
}

async function setEnvVar(projectId, key, value, targets = ['production', 'preview', 'development']) {
  const client = getVercelClient();
  await client.post(`/projects/${projectId}/env`, {
    key,
    value,
    target: targets,
    type: 'encrypted',
  });
}

async function updateEnvVar(projectId, envId, key, value, targets = ['production', 'preview', 'development']) {
  const client = getVercelClient();
  await client.patch(`/projects/${projectId}/env/${envId}`, {
    key,
    value,
    target: targets,
    type: 'encrypted',
  });
}

async function deleteEnvVar(projectId, envId) {
  const client = getVercelClient();
  await client.delete(`/projects/${projectId}/env/${envId}`);
}

module.exports = { getEnvVars, setEnvVar, updateEnvVar, deleteEnvVar };
