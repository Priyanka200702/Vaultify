const express = require('express');
const { asyncHandler } = require('@vaultify/utils');
const { ProxyToken } = require('@vaultify/db');

const router = express.Router();

router.post('/github-pr-merged', asyncHandler(async (req, res) => {
  const { action, pull_request, repository } = req.body;

  if (action !== 'closed' || !pull_request?.merged) {
    return res.status(200).json({ message: 'Ignored: PR not merged' });
  }

  const repoName = repository?.full_name || 'unknown';
  console.log(`[Webhook] PR merged in ${repoName}, branch: ${pull_request.head.ref}`);

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const result = await ProxyToken.updateMany(
    {
      environment: 'preview',
      revokedAt: null,
      createdAt: { $lt: oneDayAgo },
    },
    {
      $set: { revokedAt: new Date() },
    }
  );

  console.log(`[Webhook] Revoked ${result.modifiedCount} preview tokens`);

  res.status(200).json({
    message: `Revoked ${result.modifiedCount} preview tokens`,
    repo: repoName,
  });
}));

router.post('/vercel-deployment', asyncHandler(async (req, res) => {
  const { type, payload } = req.body;

  if (type === 'deployment-ready') {
    const env = payload?.target || 'preview';
    console.log(`[Webhook] Vercel deployment ready: ${payload?.url} (${env})`);
  }

  res.status(200).json({ message: 'Webhook received' });
}));

module.exports = router;
