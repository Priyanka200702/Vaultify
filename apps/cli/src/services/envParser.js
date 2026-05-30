const fs = require('fs');
const path = require('path');

function parseVaultifyFile(filePath = path.join(process.cwd(), '.env.vaultify')) {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const tokens = [];

  lines.forEach((line) => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (!match) return;

    const [, key, value] = match;
    const trimmedKey = key.trim();
    const trimmedValue = value.trim().replace(/^["']|["']$/g, '');

    if (trimmedValue.startsWith('vlt_') && trimmedValue.length > 10) {
      tokens.push({
        envKey: trimmedKey,
        token: trimmedValue,
      });
    }
  });

  return tokens;
}

module.exports = { parseVaultifyFile };
