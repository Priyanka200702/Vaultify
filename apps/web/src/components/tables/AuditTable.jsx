import { formatDate, formatLatency, getStatusColor, getProviderInfo, maskToken } from '../../utils/helpers';
import Badge from '../ui/Badge';

export default function AuditTable({ logs }) {
  if (!logs || logs.length === 0) {
    return (
      <div className="text-center py-12 text-vault-text-muted bg-white/5 rounded-lg border border-vault-border border-dashed">
        <div className="text-3xl mb-2">📋</div>
        <h3 className="text-vault-text-primary text-sm font-medium mb-1">No audit logs found</h3>
        <p className="text-xs">Proxy token usage will appear here in real-time.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr>
            <th className="py-3 px-4 border-b border-vault-border text-xs font-semibold text-vault-text-muted uppercase tracking-wider">Time</th>
            <th className="py-3 px-4 border-b border-vault-border text-xs font-semibold text-vault-text-muted uppercase tracking-wider">Status</th>
            <th className="py-3 px-4 border-b border-vault-border text-xs font-semibold text-vault-text-muted uppercase tracking-wider">Endpoint</th>
            <th className="py-3 px-4 border-b border-vault-border text-xs font-semibold text-vault-text-muted uppercase tracking-wider">Token / Caller IP</th>
            <th className="py-3 px-4 border-b border-vault-border text-xs font-semibold text-vault-text-muted uppercase tracking-wider">Latency</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-vault-border/50">
          {logs.map((log) => {
            const provider = getProviderInfo(log.provider);
            const isError = log.statusCode >= 400;

            return (
              <tr key={log._id} className="hover:bg-indigo-500/5 transition-colors group">
                <td className="py-3 px-4 text-sm text-vault-text-secondary whitespace-nowrap">
                  {formatDate(log.timestamp)}
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <span 
                      className="w-2 h-2 rounded-full shadow-sm" 
                      style={{ backgroundColor: getStatusColor(log.statusCode), boxShadow: `0 0 8px ${getStatusColor(log.statusCode)}40` }}
                    ></span>
                    <span className={`text-sm font-mono ${isError ? 'text-red-400' : 'text-vault-text-primary'}`}>
                      {log.statusCode}
                    </span>
                  </div>
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <span title={provider.name}>{provider.icon}</span>
                    <span className="text-sm font-mono text-vault-text-primary truncate max-w-[200px]" title={log.endpoint}>
                      {log.endpoint}
                    </span>
                  </div>
                </td>
                <td className="py-3 px-4">
                  <div className="flex flex-col">
                    <code className="text-[0.7rem] text-indigo-300 font-mono mb-0.5">{maskToken(log.tokenString)}</code>
                    <span className="text-[0.7rem] text-vault-text-muted">{log.sourceIp}</span>
                  </div>
                </td>
                <td className="py-3 px-4 text-sm text-vault-text-secondary font-mono">
                  {formatLatency(log.latencyMs)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
