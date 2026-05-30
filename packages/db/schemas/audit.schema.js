const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  tokenId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ProxyToken',
    required: true,
    index: true,
  },
  tokenString: {
    type: String,
    required: true,
  },
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true,
  },
  memberId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  memberName: {
    type: String,
    default: null,
  },
  // Request details
  sourceIp: {
    type: String,
    required: true,
  },
  geoLocation: {
    type: String, // e.g. "US, California"
    default: null,
  },
  endpoint: {
    type: String, // e.g. "POST /v1/messages"
    required: true,
  },
  provider: {
    type: String,
    required: true,
  },
  // Response details
  statusCode: {
    type: Number,
    required: true,
  },
  latencyMs: {
    type: Number,
    required: true,
  },
  requestSize: {
    type: Number, // bytes
    default: 0,
  },
  responseSize: {
    type: Number, // bytes
    default: 0,
  },
  environment: {
    type: String,
    enum: ['production', 'preview', 'development'],
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

// TTL index — auto-delete after 90 days
auditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
