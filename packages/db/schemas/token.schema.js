const mongoose = require('mongoose');

const proxyTokenSchema = new mongoose.Schema({
  // The actual token string: vlt_prod_xxxx...
  tokenString: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  // Which vault key this token proxies for
  vaultKeyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'VaultKey',
    required: true,
    index: true,
  },
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true,
  },
  // Scope constraints
  allowedEndpoints: {
    type: [String], // e.g. ["POST /v1/messages", "GET /v1/models"]
    default: [],
  },
  rateLimitDaily: {
    type: Number, // null = unlimited
    default: null,
  },
  allowedIps: {
    type: [String], // CIDR ranges, e.g. ["76.0.0.0/8"]
    default: [],
  },
  // Lifecycle
  environment: {
    type: String,
    enum: ['production', 'preview', 'development'],
    required: true,
  },
  expiresAt: {
    type: Date, // null = no expiry
    default: null,
  },
  issuedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  issuedToName: {
    type: String,
    default: null,
  },
  revokedAt: {
    type: Date,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('ProxyToken', proxyTokenSchema);
