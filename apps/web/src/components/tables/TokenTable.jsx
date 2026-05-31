import { getProviderInfo, maskToken, formatDate, getTokenStatus } from '../../utils/helpers';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import { Copy, KeyRound } from 'lucide-react';

export default function TokenTable({ tokens, onRevoke }) {
  if (!tokens || tokens.length === 0) {
    return (
      <div className="text-center py-12 text-vault-text-muted bg-white/5 rounded-lg border border-vault-border border-dashed">
        <KeyRound className="mx-auto mb-2 h-8 w-8" />
        <h3 className="text-vault-text-primary text-sm font-medium mb-1">No proxy tokens found</h3>
        <p className="text-xs">Issue a proxy token to start replacing your real API keys.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr>
            <th className="py-3 px-4 border-b border-vault-border text-xs font-semibold text-vault-text-muted uppercase tracking-wider">Token</th>
            <th className="py-3 px-4 border-b border-vault-border text-xs font-semibold text-vault-text-muted uppercase tracking-wider">Vault Key</th>
            <th className="py-3 px-4 border-b border-vault-border text-xs font-semibold text-vault-text-muted uppercase tracking-wider">Environment</th>
            <th className="py-3 px-4 border-b border-vault-border text-xs font-semibold text-vault-text-muted uppercase tracking-wider">Status</th>
            <th className="py-3 px-4 border-b border-vault-border text-xs font-semibold text-vault-text-muted uppercase tracking-wider">Created</th>
            <th className="py-3 px-4 border-b border-vault-border text-xs font-semibold text-vault-text-muted uppercase tracking-wider text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {tokens.map((token) => {
            const provider = getProviderInfo(token.vaultKeyId?.provider);
            const status = getTokenStatus(token);
            const isRevoked = !!token.revokedAt;
            const statusVariant = isRevoked ? 'danger' : status.label === 'Expired' ? 'warning' : 'success';

            return (
              <tr key={token._id} className="border-b border-vault-border/50 hover:bg-indigo-500/5 transition-colors">
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <code className="font-mono text-xs text-indigo-300 bg-indigo-500/10 px-1.5 py-0.5 rounded">
                      {maskToken(token.tokenString)}
                    </code>
                    <button 
                      className="text-vault-text-muted hover:text-white transition-colors"
                      onClick={() => navigator.clipboard.writeText(token.tokenString)}
                      title="Copy full token"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <provider.icon title={provider.name} className="h-4 w-4" />
                    <span className="text-sm text-vault-text-primary">{token.vaultKeyId?.name || 'Unknown'}</span>
                  </div>
                </td>
                <td className="py-3 px-4 text-sm text-vault-text-secondary capitalize">{token.environment}</td>
                <td className="py-3 px-4">
                  <Badge variant={statusVariant}>{status.label}</Badge>
                </td>
                <td className="py-3 px-4 text-sm text-vault-text-secondary">{formatDate(token.createdAt)}</td>
                <td className="py-3 px-4 text-right">
                  {!isRevoked && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => onRevoke(token._id)}
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    >
                      Revoke
                    </Button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
