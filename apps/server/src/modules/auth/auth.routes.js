const { Router } = require('express');
const { register, login, refresh, logout, getMe } = require('./auth.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');
const { authLimiter } = require('../../middleware/rateLimiter');

const router = Router();

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/refresh', authLimiter, refresh);
router.post('/logout', authMiddleware, logout);
router.get('/me', authMiddleware, getMe);

/**
 * OAuth 2.0 login initiation (GitHub example).
 * GET /api/auth/oauth/github
 */
router.get('/oauth/github', (req, res) => {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const redirectUri = encodeURIComponent(process.env.GITHUB_REDIRECT_URI || 'http://localhost:3001/api/auth/oauth/github/callback');
  const scope = 'read:user user:email';
  
  res.redirect(`https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}`);
});

/**
 * OAuth 2.0 callback handler.
 * GET /api/auth/oauth/github/callback
 */
router.get('/oauth/github/callback', async (req, res, next) => {
  try {
    const { code } = req.query;
    if (!code) return res.status(400).send('Missing authorization code');

    // Exchange code for access token
    const axios = require('axios');
    const tokenResponse = await axios.post('https://github.com/login/oauth/access_token', {
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: process.env.GITHUB_REDIRECT_URI || 'http://localhost:3001/api/auth/oauth/github/callback',
    }, {
      headers: { Accept: 'application/json' },
    });

    const accessToken = tokenResponse.data.access_token;
    if (!accessToken) return res.status(400).send('Failed to get access token');

    // Get user info from GitHub
    const userResponse = await axios.get('https://api.github.com/user', {
      headers: { Authorization: `token ${accessToken}` },
    });

    const githubUser = userResponse.data;
    const emailResponse = await axios.get('https://api.github.com/user/emails', {
      headers: { Authorization: `token ${accessToken}` },
    });
    const primaryEmail = emailResponse.data.find(e => e.primary)?.email || emailResponse.data[0]?.email;

    // Find or create user in our DB
    const { User, Workspace } = require('@vaultify/db');
    const { signToken } = require('@vaultify/auth');
    const { env } = require('../../config/env');

    let user = await User.findOne({ email: primaryEmail });
    if (!user) {
      // Create new user + workspace
      const workspace = await Workspace.create({
        name: `${githubUser.name || githubUser.login}'s Workspace`,
        ownerId: null,
        members: [],
      });

      user = await User.create({
        email: primaryEmail.toLowerCase(),
        password: require('crypto').randomBytes(32).toString('hex'), // Random password
        name: githubUser.name || githubUser.login,
        workspaceId: workspace._id,
        role: 'owner',
      });

      workspace.ownerId = user._id;
      workspace.members.push({
        userId: user._id,
        email: user.email,
        name: user.name,
        role: 'owner',
      });
      await workspace.save();
    }

    // Generate JWT
    const payload = { userId: user._id, email: user.email, name: user.name, role: user.role, workspaceId: user.workspaceId };
    const jwtToken = signToken(payload, env.JWT_SECRET, '1h');

    // Redirect to frontend with token
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/oauth/callback?token=${jwtToken}`);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
