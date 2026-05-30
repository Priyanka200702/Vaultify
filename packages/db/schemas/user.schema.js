const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: {
    type: String,
    required: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
  },
  role: {
    type: String,
    enum: ['owner', 'member', 'viewer'],
    default: 'owner',
  },
  refreshToken: {
    type: String,
    default: null,
  },
  mfa: {
    enabled: { type: Boolean, default: false },
    secret: { type: String, default: null },
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('User', userSchema);
