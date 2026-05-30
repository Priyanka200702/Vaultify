const mongoose = require('mongoose');

const accessRequestSchema = new mongoose.Schema({
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true,
  },
  requesterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  requesterName: {
    type: String,
    required: true,
  },
  requesterEmail: {
    type: String,
    required: true,
  },
  // What they're requesting
  vaultKeyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'VaultKey',
    required: true,
  },
  provider: {
    type: String,
    required: true,
  },
  environment: {
    type: String,
    enum: ['production', 'preview', 'development'],
    required: true,
  },
  // Requested scope
  allowedEndpoints: {
    type: [String],
    default: [],
  },
  rateLimitDaily: {
    type: Number,
    default: 500,
  },
  expiryDays: {
    type: Number, // 1, 7, 30, or null for no expiry
    default: 7,
  },
  reason: {
    type: String,
    required: true,
    maxlength: 200,
  },
  // Approval flow
  status: {
    type: String,
    enum: ['pending', 'approved', 'denied'],
    default: 'pending',
    index: true,
  },
  ownerNote: {
    type: String, // Reason for denial or override note
    default: null,
  },
  // If approved, the token that was auto-issued
  issuedTokenId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ProxyToken',
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  resolvedAt: {
    type: Date,
    default: null,
  },
});

module.exports = mongoose.model('AccessRequest', accessRequestSchema);
