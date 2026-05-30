const mongoose = require('mongoose');

const vaultKeySchema = new mongoose.Schema({
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  provider: {
    type: String,
    required: true,
    enum: [
      'anthropic',
      'openai',
      'gemini',
      'github',
      'gitlab',
      'aws',
      'azure',
      'gcp',
      'supabase',
      'planetscale',
      'mongodb',
      'vercel',
      'cloudflare',
      'railway',
      'custom',
    ],
    index: true,
  },
  environment: {
    type: String,
    required: true,
    enum: ['production', 'preview', 'development'],
    default: 'production',
  },
  // Encrypted key payload — never store plaintext
  encryptedKey: {
    iv: { type: String, required: true },
    authTag: { type: String, required: true },
    ciphertext: { type: String, required: true },
  },
  // Metadata (never contains the real key)
  keyPrefix: {
    type: String, // e.g. "sk-ant-***" — first 8 chars for display
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  lastRotatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Compound index for unique key per workspace+provider+environment
vaultKeySchema.index({ workspaceId: 1, provider: 1, environment: 1 });

module.exports = mongoose.model('VaultKey', vaultKeySchema);
