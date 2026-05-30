const SCOPED_MODELS = ['VaultKey', 'ProxyToken', 'AuditLog', 'AccessRequest'];

function isAllowedByRef(filter) {
  if (!filter) return false;
  if (filter._id) return true;
  if (filter.tokenString) return true;
  if (filter.vaultKeyId) return true;
  if (filter.tokenId) return true;
  return false;
}

function workspaceScopedPlugin(schema) {
  const preHooks = ['find', 'findOne', 'countDocuments', 'findOneAndUpdate', 'findOneAndDelete', 'deleteOne'];

  for (const hook of preHooks) {
    schema.pre(hook, function (next) {
      if (!SCOPED_MODELS.includes(this.model.modelName)) return next();
      const filter = this.getFilter();
      if (filter.workspaceId || isAllowedByRef(filter)) return next();
      return next(new Error(
        `${hook} on ${this.model.modelName} requires workspaceId filter. ` +
        `Add { workspaceId: ..., ... } or query by _id/tokenString/vaultKeyId/tokenId`
      ));
    });
  }

  schema.pre('deleteMany', function (next) {
    if (!SCOPED_MODELS.includes(this.model.modelName)) return next();
    const filter = this.getFilter();
    if (filter.workspaceId || filter.vaultKeyId) return next();
    return next(new Error(
      `deleteMany on ${this.model.modelName} requires workspaceId filter`
    ));
  });

  schema.pre('aggregate', function (next) {
    if (!SCOPED_MODELS.includes(this.model.modelName)) return next();
    const pipeline = this.pipeline();
    if (!pipeline.length) return next();
    const firstStage = pipeline[0];
    if (firstStage.$match) {
      if (firstStage.$match.workspaceId || isAllowedByRef(firstStage.$match)) return next();
    }
    return next(new Error(
      `aggregate on ${this.model.modelName} must include $match with workspaceId`
    ));
  });
}

module.exports = { workspaceScopedPlugin, SCOPED_MODELS };
