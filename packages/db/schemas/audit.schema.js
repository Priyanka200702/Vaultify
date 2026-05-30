const mongoose = require('mongoose');
const { workspaceScopedPlugin } = require('../plugins/workspaceScoped');

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
    type: String,
    default: null,
  },
  endpoint: {
    type: String,
    required: true,
  },
  provider: {
    type: String,
    required: true,
  },
  // Body inspection fields
  requestBodySnippet: {
    type: String,
    default: null,
    maxlength: 4096,
  },
  requestBodyFormat: {
    type: String,
    enum: ['json', 'text', 'binary', null],
    default: null,
  },
  injectionPatterns: {
    type: [String],
    default: [],
  },
  responseHeaders: {
    type: Map,
    of: String,
    default: null,
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
    type: Number,
    default: 0,
  },
  responseSize: {
    type: Number,
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
  // Hash chain integrity fields
  prevEntryHash: {
    type: String,
    default: null,
  },
  entryHash: {
    type: String,
    default: null,
    index: true,
  },
});

// Compound index for query performance + TTL
auditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });
auditLogSchema.index({ workspaceId: 1, timestamp: -1 });

auditLogSchema.plugin(workspaceScopedPlugin);

module.exports = mongoose.model('AuditLog', auditLogSchema);
