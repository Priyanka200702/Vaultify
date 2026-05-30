const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { User, Workspace } = require('@vaultify/db');
const { signToken } = require('@vaultify/auth');
const { env } = require('../../config/env');

function computeBinding(req) {
  const clientIp = (req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim();
  const ua = req.headers['user-agent'] || '';
  return {
    ipHash: crypto.createHash('sha256').update(clientIp).digest('hex').slice(0, 16),
    uaHash: crypto.createHash('sha256').update(ua).digest('hex').slice(0, 16),
  };
}

/**
 * POST /api/auth/register
 * Creates a new user + workspace. Returns JWT pair.
 */
async function register(req, res, next) {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'VALIDATION', message: 'Email, password, and name are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'VALIDATION', message: 'Password must be at least 6 characters' });
    }

    // Check existing user
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ error: 'CONFLICT', message: 'User with this email already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user first (workspaceId will be set after workspace is created)
    const user = await User.create({
      email: email.toLowerCase(),
      password: hashedPassword,
      name,
      role: 'owner',
    });

    // Create workspace with ownerId set to the newly created user
    const workspace = await Workspace.create({
      name: `${name}'s Workspace`,
      ownerId: user._id,
      members: [
        {
          userId: user._id,
          email: user.email,
          name: user.name,
          role: 'owner',
        },
      ],
    });

    // Update user with workspace reference
    user.workspaceId = workspace._id;
    await user.save();

    // Generate tokens with binding
    const binding = computeBinding(req);
    const payload = { userId: user._id, email: user.email, name: user.name, role: user.role, workspaceId: workspace._id };
    const accessToken = signToken(payload, env.JWT_SECRET, '1h', binding);
    const refreshToken = signToken(payload, env.REFRESH_TOKEN_SECRET, '7d', binding);

    // Store refresh token
    user.refreshToken = refreshToken;
    await user.save();

    res.status(201).json({
      message: 'Account created successfully',
      user: { id: user._id, email: user.email, name: user.name, role: user.role },
      workspace: { id: workspace._id, name: workspace.name },
      accessToken,
      refreshToken,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/login
 * Authenticates user, returns JWT pair.
 */
async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'VALIDATION', message: 'Email and password are required' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ error: 'AUTH_FAILED', message: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'AUTH_FAILED', message: 'Invalid email or password' });
    }

    const binding = computeBinding(req);
    const payload = { userId: user._id, email: user.email, name: user.name, role: user.role, workspaceId: user.workspaceId };
    const accessToken = signToken(payload, env.JWT_SECRET, '1h', binding);
    const refreshToken = signToken(payload, env.REFRESH_TOKEN_SECRET, '7d', binding);

    user.refreshToken = refreshToken;
    await user.save();

    res.json({
      message: 'Login successful',
      user: { id: user._id, email: user.email, name: user.name, role: user.role },
      accessToken,
      refreshToken,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/refresh
 * Rotates the refresh token and issues a new access token.
 */
async function refresh(req, res, next) {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ error: 'VALIDATION', message: 'Refresh token is required' });
    }

    const { verifyToken } = require('@vaultify/auth');
    const { valid, decoded, error } = verifyToken(refreshToken, env.REFRESH_TOKEN_SECRET);

    if (!valid) {
      return res.status(401).json({ error: 'TOKEN_INVALID', message: `Refresh failed: ${error}` });
    }

    const user = await User.findById(decoded.userId);
    if (!user || user.refreshToken !== refreshToken) {
      return res.status(401).json({ error: 'TOKEN_INVALID', message: 'Refresh token is invalid or revoked' });
    }

    const binding = computeBinding(req);
    const payload = { userId: user._id, email: user.email, name: user.name, role: user.role, workspaceId: user.workspaceId };
    const newAccessToken = signToken(payload, env.JWT_SECRET, '1h', binding);
    const newRefreshToken = signToken(payload, env.REFRESH_TOKEN_SECRET, '7d', binding);

    user.refreshToken = newRefreshToken;
    await user.save();

    res.json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/logout
 * Invalidates the refresh token.
 */
async function logout(req, res, next) {
  try {
    const user = await User.findById(req.user.userId);
    if (user) {
      user.refreshToken = null;
      await user.save();
    }
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/auth/me
 * Returns the current authenticated user's info.
 */
async function getMe(req, res, next) {
  try {
    const user = await User.findById(req.user.userId).select('-password -refreshToken');
    if (!user) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'User not found' });
    }
    res.json({ user });
  } catch (err) {
    next(err);
  }
}

module.exports = { register, login, refresh, logout, getMe };
