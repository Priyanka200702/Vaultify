require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

// Import from packages
const { encrypt } = require(path.join(__dirname, '../../packages/crypto'));
const { generateProxyToken } = require(path.join(__dirname, '../../packages/utils'));
const db = require(path.join(__dirname, '../../packages/db'));

const MONGO_URI = process.env.MONGO_URI || 'mongodb://admin:password@localhost:27017/vaultify?authSource=admin';
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'demo-encryption-key-32-bytes!';

async function seed() {
  try {
    console.log('Connecting to MongoDB...');
    await db.connectDB(MONGO_URI);

    const { User, Workspace, VaultKey, ProxyToken, AuditLog } = db;

    // Clear existing demo data
    await User.deleteMany({ email: 'demo@vaultify.dev' });
    await Workspace.deleteMany({ name: 'Demo Workspace' });
    console.log('Cleared existing demo data');

    // 1. Create demo user
    const hashedPassword = await bcrypt.hash('Demo@1234', 10);
    const user = await User.create({
      email: 'demo@vaultify.dev',
      password: hashedPassword,
      name: 'Demo User',
      role: 'owner',
    });
    console.log('✓ Created demo user:', user.email);

    // 2. Create demo workspace
    const workspace = await Workspace.create({
      name: 'Demo Workspace',
      ownerId: user._id,
      members: [{
        userId: user._id,
        email: user.email,
        name: user.name,
        role: 'owner',
      }],
    });
    console.log('✓ Created demo workspace:', workspace.name);

    // 3. Store demo API key (encrypted)
    const demoKey = 'sk-ant-demo-xxxxxxxxxxxxxxxx';
    const encrypted = encrypt(demoKey, ENCRYPTION_KEY);
    const vaultKey = await VaultKey.create({
      workspaceId: workspace._id,
      name: 'ANTHROPIC_API_KEY',
      provider: 'anthropic',
      environment: 'production',
      encryptedKey: encrypted,
      keyPrefix: 'sk-ant-demo-***',
    });
    console.log('✓ Stored demo API key');

    // Update user with workspaceId
    user.workspaceId = workspace._id;
    await user.save();

    // 4. Issue proxy token
    const proxyToken = generateProxyToken('prod');
    await ProxyToken.create({
      tokenString: proxyToken,
      vaultKeyId: vaultKey._id,
      workspaceId: workspace._id,
      allowedEndpoints: ['POST /v1/messages'],
      rateLimitDaily: 500,
      environment: 'production',
      issuedTo: user._id,
      issuedToName: user.name,
      expiresAt: null,
    });
    console.log('✓ Issued proxy token:', proxyToken.substring(0, 20) + '...');

    // 5. Create 10 fake audit log entries
    const fakeIps = ['192.168.1.1', '10.0.0.1', '172.16.0.1', '203.0.113.45'];
    const endpoints = ['POST /v1/messages', 'GET /v1/models'];
    const statuses = [200, 200, 200, 429, 200, 500];

    for (let i = 0; i < 10; i++) {
      await AuditLog.create({
        tokenId: null,
        memberId: user._id,
        workspaceId: workspace._id,
        sourceIp: fakeIps[Math.floor(Math.random() * fakeIps.length)],
        endpoint: endpoints[Math.floor(Math.random() * endpoints.length)],
        statusCode: statuses[Math.floor(Math.random() * statuses.length)],
        latencyMs: Math.floor(Math.random() * 1000) + 100,
        environment: 'production',
        timestamp: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
      });
    }
    console.log('✓ Created 10 fake audit log entries');

    console.log('\n✅ Seed completed successfully!');
    console.log('\nDemo credentials:');
    console.log('  Email: demo@vaultify.dev');
    console.log('  Password: Demo@1234');
    console.log('  Test API Key: sk-ant-demo-xxxxxxxxxxxxxxxx');

  } catch (err) {
    console.error('✗ Seed failed:', err.message);
    console.error(err.stack);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

seed();
