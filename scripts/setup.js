const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ENV_EXAMPLE = path.join(ROOT, '.env.example');
const ENV_PATH = path.join(ROOT, '.env');

const REQUIRED_VARS = [
  'MONGO_URI',
  'JWT_SECRET',
  'REFRESH_TOKEN_SECRET',
  'ENCRYPTION_KEY',
  'INTERNAL_API_KEY',
];

function generateHex(bytes) {
  return crypto.randomBytes(bytes).toString('hex');
}

function generateSecret(minBytes = 32) {
  return crypto.randomBytes(minBytes).toString('base64url');
}

async function bootstrap() {
  console.log('🔧 Vaultify Bootstrap\n');

  // Step 1: Create .env if not exists
  if (!fs.existsSync(ENV_PATH)) {
    if (!fs.existsSync(ENV_EXAMPLE)) {
      console.error('❌ .env.example not found. Are you in the project root?');
      process.exit(1);
    }
    console.log('📝 Creating .env from .env.example...');
    let example = fs.readFileSync(ENV_EXAMPLE, 'utf-8');
    example = example
      .replace(/JWT_SECRET=.*/, `JWT_SECRET=${generateSecret(32)}`)
      .replace(/REFRESH_TOKEN_SECRET=.*/, `REFRESH_TOKEN_SECRET=${generateSecret(32)}`)
      .replace(/ENCRYPTION_KEY=.*/, `ENCRYPTION_KEY=${generateHex(32)}`)
      .replace(/INTERNAL_API_KEY=.*/, `INTERNAL_API_KEY=${generateSecret(32)}`);
    // Set deployment defaults for incremental architecture
    if (!example.includes('PROXY_SERVICE_ENABLED=')) {
      example += '\nPROXY_SERVICE_ENABLED=true\n';
    }
    if (!example.includes('AUDIT_SERVICE_URL=')) {
      example += 'AUDIT_SERVICE_URL=http://localhost:3003\n';
    }
    fs.writeFileSync(ENV_PATH, example, { mode: 0o600 });
    console.log('✅ .env created with secure random secrets\n');
  } else {
    console.log('✅ .env already exists\n');
  }

  // Step 2: Validate env
  require('dotenv').config({ path: ENV_PATH });
  const missing = REQUIRED_VARS.filter(v => !process.env[v]);
  if (missing.length > 0) {
    console.error(`❌ Missing required env vars: ${missing.join(', ')}`);
    console.error('   Edit .env and fill in the missing values.');
    process.exit(1);
  }

  // Validate key lengths
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    console.error('❌ JWT_SECRET must be at least 32 characters');
    process.exit(1);
  }
  if (process.env.ENCRYPTION_KEY && (process.env.ENCRYPTION_KEY.length !== 64 || !/^[0-9a-f]{64}$/i.test(process.env.ENCRYPTION_KEY))) {
    console.error('❌ ENCRYPTION_KEY must be a 64-character hex string');
    process.exit(1);
  }

  console.log('✅ Environment variables validated');

  // Step 3: Check MongoDB connection
  const { connectDB } = require('@vaultify/db');
  try {
    console.log('\n🔌 Testing MongoDB connection...');
    await connectDB(process.env.MONGO_URI, 3);
    console.log('✅ MongoDB connected');
  } catch (err) {
    console.error(`❌ MongoDB connection failed: ${err.message}`);
    console.error('   Verify MONGO_URI in .env and ensure MongoDB is running.');
    process.exit(1);
  }

  // Step 4: Check if admin user exists
  const { User } = require('@vaultify/db');
  const adminCount = await User.countDocuments({ role: 'owner' });
  if (adminCount === 0) {
    console.log('\n👤 No admin user found. Create one via:');
    console.log('   npm run setup:admin   (or implement admin creation flow)');
  } else {
    console.log(`\n👤 ${adminCount} admin user(s) found`);
  }

  console.log('\n✅ Bootstrap complete!');
  console.log('   Run the server: npm run dev\n');
}

bootstrap().catch(err => {
  console.error('❌ Bootstrap failed:', err.message);
  process.exit(1);
});
