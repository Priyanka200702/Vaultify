const { encrypt } = require('./encrypt');
const { decrypt } = require('./decrypt');
const { generateDek, deriveNonce, wrapDek, unwrapDek, encryptWithDek, decryptWithDek } = require('./envelope');
const { KmsProvider, LocalKmsProvider, AwsKmsProvider, GcpKmsProvider, createKmsProvider } = require('./kms');

module.exports = {
  encrypt,
  decrypt,
  generateDek,
  deriveNonce,
  wrapDek,
  unwrapDek,
  encryptWithDek,
  decryptWithDek,
  KmsProvider,
  LocalKmsProvider,
  AwsKmsProvider,
  GcpKmsProvider,
  createKmsProvider,
};
