const fs = require('fs');

const VALIDATORS = {
  string: (v) => typeof v === 'string' && v.length > 0,
  number: (v) => {
    const n = Number(v);
    return !Number.isNaN(n) && String(n) === String(v);
  },
  port: (v) => {
    const n = Number(v);
    return !Number.isNaN(n) && Number.isInteger(n) && n >= 1024 && n <= 65535;
  },
  hex: (v, len) => {
    if (typeof v !== 'string') return false;
    if (len && v.length !== len) return false;
    return /^[0-9a-fA-F]+$/.test(v);
  },
  url: (v) => {
    try { new URL(v); return true; }
    catch { return false; }
  },
  mongoUri: (v) => {
    if (typeof v !== 'string') return false;
    return v.startsWith('mongodb://') || v.startsWith('mongodb+srv://');
  },
  boolean: (v) => ['true', 'false', '1', '0'].includes(String(v).toLowerCase()),
  oneOf: (allowed) => (v) => allowed.includes(v),
  minLength: (min) => (v) => typeof v === 'string' && v.length >= min,
  file: (v) => {
    if (typeof v !== 'string' || !v) return true;
    try { fs.accessSync(v, fs.constants.R_OK); return true; }
    catch { return false; }
  },
};

function coerce(type, value) {
  if (type === 'number' || type === 'port') return Number(value);
  if (type === 'boolean') return ['true', '1'].includes(String(value).toLowerCase());
  return value;
}

function createConfig(name, schema) {
  const config = {};
  const errors = [];

  for (const [key, def] of Object.entries(schema)) {
    const envKey = def.envVar || key;
    const raw = process.env[envKey] !== undefined ? process.env[envKey] : def.default;
    const value = coerce(def.type, raw);

    if (raw === undefined || raw === null || raw === '') {
      if (def.required) {
        errors.push(`${key}: required but not set`);
      } else {
        config[key] = def.default !== undefined ? coerce(def.type, def.default) : undefined;
      }
      continue;
    }

    if (def.validate) {
      const valid = Array.isArray(def.validate)
        ? def.validate.every(fn => fn(value, def))
        : def.validate(value, def);
      if (!valid) {
        errors.push(`${key}: validation failed (value=${raw}, type=${def.type})`);
        continue;
      }
    }

    config[key] = value;
  }

  if (errors.length > 0) {
    throw new Error(`[${name}] Config validation failed:\n  - ${errors.join('\n  - ')}`);
  }

  return Object.freeze(config);
}

module.exports = { createConfig, VALIDATORS };
