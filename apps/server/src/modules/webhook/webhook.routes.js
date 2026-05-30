const express = require('express');
const { ProxyToken } = require('@vaultify/db');

const router = express.Router();

/**
 * POST /api/webhooks/github-pr-merged
 * GitHub Actions calls this when a PR is merged to revoke preview tokens.
 *
 * Expected body:
 * {
 *   "action": "closed",
 *   "pull_request": {
 *     "merged": true,
 *     "head": { "ref": "feature-branch" }
 *   },
 *   "repository": { "full_name": "owner/repo" }
 * }
 */
router.post('/github-pr-merged', async (req, res, next) => {
  try {
    const { action, pull_request, repository } = req.body;

    // Validate GitHub webhook event
    if (action !== 'closed' || !pull_request?.merged) {
      return res.status(200).json({ message: 'Ignored: PR not merged' });
    }

    const repoName = repository?.full_name || 'unknown';
    console.log(`[Webhook] PR merged in ${repoName}, branch: ${pull_request.head.ref}`);

    // Find and revoke preview tokens for this workspace
    // In a real implementation, you'd map the repo to a workspace
    // For now, revoke all preview tokens that are older than 1 day
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
  } catch (err) {
    next(err);
  }
});

router.post('/vercel-deployment', async (req, res, next) => {
  try {
    const { type, payload } = req.body;

    if (type === 'deployment-ready') {
      const env = payload?.target || 'preview';
      console.log(`[Webhook] Vercel deployment ready: ${payload?.url} (${env})`);
    }

    res.status(200).json({ message: 'Webhook received' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
