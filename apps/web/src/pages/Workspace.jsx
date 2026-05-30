import { useState, useEffect } from 'react';
import useStore from '../store/store';
import { useFetch } from '../hooks/useFetch';
import { getWorkspace, inviteMember, getVaultKeys, storeVaultKey, getActiveTokens, getRecentActivity } from '../services/workspaceService';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import StoreKeyForm from '../components/forms/StoreKeyForm';
import { formatDate, formatLatency, getStatusColor } from '../utils/helpers';

export default function Workspace() {
  const { workspace, vaultKeys, setWorkspace, setVaultKeys } = useStore();
  const [isStoreKeyOpen, setIsStoreKeyOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteError, setInviteError] = useState('');
  const [activeTokens, setActiveTokens] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);

  const workspaceFetch = useFetch(getWorkspace);
  const keysFetch = useFetch(getVaultKeys);
  const inviteFetch = useFetch(inviteMember);
  const storeKeyFetch = useFetch(storeVaultKey);
  const tokensFetch = useFetch(getActiveTokens);
  const activityFetch = useFetch(getRecentActivity);

  const loadData = () => {
    workspaceFetch.execute().then(data => setWorkspace(data.workspace)).catch(console.error);
    keysFetch.execute().then(data => setVaultKeys(data.keys)).catch(console.error);
    tokensFetch.execute().then(data => setActiveTokens(data.tokens || [])).catch(console.error);
    activityFetch.execute().then(data => setRecentActivity(data.logs || [])).catch(console.error);

    // Get pending count
    import('../services/workspaceService').then(module => {
      module.getRequests().then(data => {
        const pending = data.requests?.filter(r => r.status === 'pending') || [];
        setPendingCount(pending.length);
      }).catch(console.error);
    }).catch(console.error);
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleInvite = async (e) => {
    e.preventDefault();
    setInviteError('');
    try {
      await inviteFetch.execute(inviteEmail, 'member');
      setInviteEmail('');
      loadData();
    } catch (err) {
      setInviteError(err.response?.data?.message || err.message);
    }
  };

  const handleStoreKey = async (formData) => {
    await storeKeyFetch.execute(formData);
    setIsStoreKeyOpen(false);
    loadData();
  };

  const metrics = {
    members: workspace?.members?.length || 0,
    tokens: activeTokens.length,
    pending: pendingCount,
    callsToday: 341, // This would come from audit stats API
  };

  const safeVaultKeys = vaultKeys || [];

  const getInitials = (name) => {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';
  };

  const getAvatarColor = (name) => {
    const colors = ['bg-indigo-500/20 text-indigo-400', 'bg-emerald-500/20 text-emerald-400', 'bg-amber-500/20 text-amber-400', 'bg-slate-500/20 text-slate-400'];
    const idx = name ? name.charCodeAt(0) % colors.length : 0;
    return colors[idx];
  };

  return (
    <div className="animate-[fadeIn_0.4s_ease]">
      {/* Top Bar */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-vault-border">
        <div className="text-lg font-semibold text-vault-text-primary">
          vaultify <span className="text-vault-text-muted font-normal">/ team workspace</span>
        </div>
        <div className="flex items-center gap-3 text-sm text-vault-text-secondary">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${getAvatarColor(workspace?.members?.[0]?.name)}`}>
            {getInitials(workspace?.members?.[0]?.name)}
          </div>
          <span>{workspace?.members?.[0]?.name || 'You'}</span>
          <span className="text-vault-border">·</span>
          <span className="bg-indigo-500/20 text-indigo-400 text-xs px-2 py-0.5 rounded font-semibold">Owner</span>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Members', value: metrics.members, sub: `${workspace?.members?.filter(m => m.role === 'owner').length || 0} owner · ${metrics.members - (workspace?.members?.filter(m => m.role === 'owner').length || 0)} members` },
          { label: 'Active Tokens', value: metrics.tokens, sub: `across ${vaultKeys?.length || 0} keys` },
          { label: 'Pending Requests', value: metrics.pending, sub: 'awaiting approval', color: 'text-amber-400' },
          { label: 'Calls Today', value: metrics.callsToday, sub: 'no anomalies' },
        ].map((m, i) => (
          <div key={i} className="glass-card p-4">
            <div className="text-xs text-vault-text-muted mb-1">{m.label}</div>
            <div className={`text-2xl font-semibold text-vault-text-primary ${m.color || ''}`}>{m.value}</div>
            <div className="text-xs text-vault-text-secondary mt-1">{m.sub}</div>
          </div>
        ))}
      </div>

      {/* Pending Requests Banner */}
      {pendingCount > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 mb-6 flex items-center justify-between">
          <div className="text-sm text-amber-400">{pendingCount} access requests need your review</div>
          <Button size="sm" variant="primary" onClick={() => document.getElementById('pending-section')?.scrollIntoView({ behavior: 'smooth' })}>
            Review now
          </Button>
        </div>
      )}

      {/* Members Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-vault-text-primary">Members</h3>
          <Button size="sm" onClick={() => document.getElementById('invite-modal')?.click()}>
            + Invite Member
          </Button>
        </div>

        <div className="glass-card overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr>
                <th className="py-3 px-4 border-b border-vault-border text-xs font-semibold text-vault-text-muted uppercase tracking-wider">Member</th>
                <th className="py-3 px-4 border-b border-vault-border text-xs font-semibold text-vault-text-muted uppercase tracking-wider">Role</th>
                <th className="py-3 px-4 border-b border-vault-border text-xs font-semibold text-vault-text-muted uppercase tracking-wider">Active Tokens</th>
                <th className="py-3 px-4 border-b border-vault-border text-xs font-semibold text-vault-text-muted uppercase tracking-wider">Last Active</th>
                <th className="py-3 px-4 border-b border-vault-border"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-vault-border/50 text-sm">
              {workspace?.members?.map(member => (
                <tr key={member.userId || member.email}>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${getAvatarColor(member.name)}`}>
                        {getInitials(member.name)}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-vault-text-primary">{member.name}</div>
                        <div className="text-xs text-vault-text-muted">{member.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`badge ${member.role === 'owner' ? 'badge-owner' : 'badge-member'}`}>
                      {member.role}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-vault-text-secondary">
                    {activeTokens.filter(t => t.issuedToName === member.name).length || '—'}
                  </td>
                  <td className="py-3 px-4 text-xs text-vault-text-muted">now</td>
                  <td className="py-3 px-4">
                    <div className="flex gap-2 justify-end">
                      <Button size="sm" variant="ghost">Tokens</Button>
                      {member.role !== 'owner' && (
                        <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-300">Remove</Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Invite Form */}
        <div className="mt-4">
          <h4 className="text-sm font-medium text-vault-text-secondary mb-3">Invite Member</h4>
          <form onSubmit={handleInvite} className="flex gap-2">
            <input
              type="email"
              className="vault-input flex-1"
              placeholder="colleague@company.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              required
            />
            <Button type="submit" loading={inviteFetch.loading}>Invite</Button>
          </form>
          {inviteError && <p className="text-red-400 text-xs mt-2">{inviteError}</p>}
        </div>
      </div>

      {/* Vault Keys Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-vault-text-primary">Vault Keys</h3>
            <p className="text-sm text-vault-text-secondary">Store real API keys securely before issuing proxy tokens</p>
          </div>
          <Button size="sm" onClick={() => setIsStoreKeyOpen(true)}>
            + Add API Key
          </Button>
        </div>

        {safeVaultKeys.length === 0 ? (
          <div className="glass-card p-6 text-center text-vault-text-muted">
            No API keys stored yet. Add your first key to enable proxy token issuance.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {safeVaultKeys.map((key) => (
              <div key={key._id} className="glass-card p-5 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-vault-text-primary">{key.name}</div>
                    <div className="text-xs text-vault-text-muted capitalize">
                      {key.provider} · {key.environment}
                    </div>
                  </div>
                  <span className="rounded-full border border-vault-border bg-white/5 px-2 py-1 text-[0.7rem] text-vault-text-secondary">
                    {key.provider}
                  </span>
                </div>

                <div className="rounded-lg border border-vault-border bg-[#0c1019]/70 p-3">
                  <div className="text-[0.7rem] uppercase tracking-wider text-vault-text-muted mb-1">Key Prefix</div>
                  <div className="font-mono text-xs text-vault-text-primary break-all">
                    {key.keyPrefix || 'Hidden'}
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-vault-text-muted">
                  <span>Created</span>
                  <span>{key.createdAt ? formatDate(key.createdAt) : 'Unknown'}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pending Requests Section */}
      <div id="pending-section" className="mb-8">
        <h3 className="text-lg font-semibold text-vault-text-primary mb-4">Pending Requests</h3>
        <div className="glass-card overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr>
                <th className="py-3 px-4 border-b border-vault-border text-xs font-semibold text-vault-text-muted uppercase tracking-wider">From</th>
                <th className="py-3 px-4 border-b border-vault-border text-xs font-semibold text-vault-text-muted uppercase tracking-wider">Key Requested</th>
                <th className="py-3 px-4 border-b border-vault-border text-xs font-semibold text-vault-text-muted uppercase tracking-wider">Scope</th>
                <th className="py-3 px-4 border-b border-vault-border text-xs font-semibold text-vault-text-muted uppercase tracking-wider">Reason</th>
                <th className="py-3 px-4 border-b border-vault-border"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-vault-border/50 text-sm">
              {/* This would be populated from requests API */}
              <tr>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-slate-500/20 text-slate-400 flex items-center justify-center text-[0.6rem] font-bold">SK</div>
                    <span className="text-vault-text-primary">Siddharth K.</span>
                  </div>
                </td>
                <td className="py-3 px-4 text-xs text-vault-text-primary">Anthropic · production</td>
                <td className="py-3 px-4"><span className="scope-pill">/v1/messages only</span></td>
                <td className="py-3 px-4 text-xs text-vault-text-secondary">building chat feature</td>
                <td className="py-3 px-4">
                  <div className="flex gap-2 justify-end">
                    <Button size="sm" className="text-emerald-400 border-emerald-400/30">Approve</Button>
                    <Button size="sm" className="text-red-400 border-red-400/30">Deny</Button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Active Tokens Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-vault-text-primary">Active Tokens</h3>
          <Button size="sm" onClick={() => setIsStoreKeyOpen(true)}>
            + Issue Token
          </Button>
        </div>

        <div className="glass-card overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr>
                <th className="py-3 px-4 border-b border-vault-border text-xs font-semibold text-vault-text-muted uppercase tracking-wider">Token</th>
                <th className="py-3 px-4 border-b border-vault-border text-xs font-semibold text-vault-text-muted uppercase tracking-wider">Member</th>
                <th className="py-3 px-4 border-b border-vault-border text-xs font-semibold text-vault-text-muted uppercase tracking-wider">Key</th>
                <th className="py-3 px-4 border-b border-vault-border text-xs font-semibold text-vault-text-muted uppercase tracking-wider">Scope</th>
                <th className="py-3 px-4 border-b border-vault-border text-xs font-semibold text-vault-text-muted uppercase tracking-wider">Expires</th>
                <th className="py-3 px-4 border-b border-vault-border"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-vault-border/50 font-mono text-xs">
              {activeTokens.map(token => (
                <tr key={token._id}>
                  <td className="py-3 px-4 text-vault-text-secondary">{token.tokenString?.slice(0, 12)}...</td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[0.6rem] font-bold ${getAvatarColor(token.issuedToName)}`}>
                        {getInitials(token.issuedToName)}
                      </div>
                      <span className="text-vault-text-primary">{token.issuedToName}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-vault-text-primary">{token.vaultKeyId?.provider || 'N/A'}</td>
                  <td className="py-3 px-4"><span className="scope-pill">{token.allowedEndpoints?.[0] || '*'}</span></td>
                  <td className="py-3 px-4 text-xs text-vault-text-muted">
                    {token.expiresAt ? new Date(token.expiresAt).toLocaleDateString() : 'Never'}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <Button size="sm" className="text-red-400 border-red-400/30">Revoke</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-vault-text-primary">Recent Activity</h3>
          <Button size="sm" variant="ghost">Full log →</Button>
        </div>

        <div className="space-y-2">
          {recentActivity.slice(0, 5).map((log, i) => (
            <div key={i} className="log-row">
              <span className="log-time">{formatDate(log.timestamp)}</span>
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[0.6rem] font-bold ${getAvatarColor(log.memberName)}`}>
                {getInitials(log.memberName)}
              </div>
              <span className="log-action">
                {log.memberName} called <span className="font-mono text-xs">{log.endpoint}</span>
              </span>
              <span className={`log-endpoint ${getStatusColor(log.statusCode)}`}>
                {log.statusCode} · {formatLatency(log.latencyMs)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Store Key Modal */}
      <Modal
        isOpen={isStoreKeyOpen}
        onClose={() => setIsStoreKeyOpen(false)}
        title="Store API Key in Vault"
        sub="Encrypt a real API key before using it to issue proxy tokens"
      >
        <StoreKeyForm
          onSubmit={handleStoreKey}
          onCancel={() => setIsStoreKeyOpen(false)}
        />
      </Modal>
    </div>
  );
}
