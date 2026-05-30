const { wrapDek: localWrap, unwrapDek: localUnwrap } = require('./envelope');

class KmsProvider {
  async wrapDek(dekHex) {
    throw new Error('Not implemented: wrapDek');
  }

  async unwrapDek(wrappedDek) {
    throw new Error('Not implemented: unwrapDek');
  }

  get type() {
    return 'abstract';
  }
}

class LocalKmsProvider extends KmsProvider {
  constructor(masterKeyHex) {
    super();
    this.masterKey = masterKeyHex;
  }

  async wrapDek(dekHex) {
    return localWrap(dekHex, this.masterKey);
  }

  async unwrapDek(wrappedDek) {
    return localUnwrap(wrappedDek, this.masterKey);
  }

  get type() {
    return 'local';
  }
}

class AwsKmsProvider extends KmsProvider {
  constructor({ keyId, region, accessKeyId, secretAccessKey } = {}) {
    super();
    this.keyId = keyId || process.env.AWS_KMS_KEY_ID;
    this.region = region || process.env.AWS_REGION || 'us-east-1';
    this.accessKeyId = accessKeyId || process.env.AWS_ACCESS_KEY_ID;
    this.secretAccessKey = secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY;
  }

  async wrapDek(dekHex) {
    const { KMS } = require('aws-sdk');
    const kms = new KMS({ region: this.region, accessKeyId: this.accessKeyId, secretAccessKey: this.secretAccessKey });
    const result = await kms.encrypt({ KeyId: this.keyId, Plaintext: Buffer.from(dekHex, 'utf-8') }).promise();
    return { ciphertext: result.CiphertextBlob.toString('base64') };
  }

  async unwrapDek(wrappedDek) {
    const { KMS } = require('aws-sdk');
    const kms = new KMS({ region: this.region, accessKeyId: this.accessKeyId, secretAccessKey: this.secretAccessKey });
    const result = await kms.decrypt({ CiphertextBlob: Buffer.from(wrappedDek.ciphertext, 'base64') }).promise();
    return result.Plaintext.toString('utf-8');
  }

  get type() {
    return 'aws';
  }
}

class GcpKmsProvider extends KmsProvider {
  constructor({ keyName, projectId, location, keyRing } = {}) {
    super();
    this.keyName = keyName || process.env.GCP_KMS_KEY_NAME;
    this.projectId = projectId || process.env.GCP_PROJECT_ID;
    this.location = location || process.env.GCP_LOCATION || 'global';
    this.keyRing = keyRing || process.env.GCP_KEY_RING || 'vaultify';
  }

  get type() {
    return 'gcp';
  }
}

function createKmsProvider(type = 'local', options = {}) {
  switch (type) {
    case 'local':
      return new LocalKmsProvider(options.masterKey);
    case 'aws':
      return new AwsKmsProvider(options);
    case 'gcp':
      return new GcpKmsProvider(options);
    default:
      throw new Error(`Unknown KMS provider type: ${type}`);
  }
}

module.exports = { KmsProvider, LocalKmsProvider, AwsKmsProvider, GcpKmsProvider, createKmsProvider };
