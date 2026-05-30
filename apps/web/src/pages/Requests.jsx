import { useEffect, useState } from 'react';
import useStore from '../store/store';
import { useFetch } from '../hooks/useFetch';
import { getRequests, approveRequest, denyRequest, getVaultKeys, submitRequest } from '../services/workspaceService';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import RequestForm from '../components/forms/RequestForm';
import Modal from '../components/ui/Modal';
import { formatDate } from '../utils/helpers';

export default function Requests() {
  const { requests, setRequests, vaultKeys, setVaultKeys } = useStore();
  const fetchReqs = useFetch(getRequests);
  const keysFetch = useFetch(getVaultKeys);
  const submitFetch = useFetch(submitRequest);
  const approveFetch = useFetch(approveRequest);
  const denyFetch = useFetch(denyRequest);
  const [showForm, setShowForm] = useState(false);
  const [overrideScope, setOverrideScope] = useState(null);

  const loadRequests = () => {
    fetchReqs.execute().then(data => setRequests(data.requests)).catch(console.error);
  };

  useEffect(() => {
    loadRequests();
    keysFetch.execute().then(data => setVaultKeys(data.keys)).catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmitRequest = async (data) => {
    await submitFetch.execute(data);
    setShowForm(false);
    loadRequests();
  };

  const handleApprove = async (id, overrides = null) => {
    if (window.confirm('Approve this request? A proxy token will be automatically issued.')) {
      await approveFetch.execute(id, 'Approved via dashboard', overrides);
      setOverrideScope(null);
      loadRequests();
    }
  };

  const handleDeny = async (id) => {
    const reason = window.prompt('Reason for denial (optional):', '');
    if (reason !== null) {
      await denyFetch.execute(id, reason || 'Request denied');
      loadRequests();
    }
  };

  const pendingRequests = requests?.filter(r => r.status === 'pending') || [];
  const resolvedRequests = requests?.filter(r => r.status !== 'pending') || [];

  return (
    <div className="animate-[fadeIn_0.4s_ease]">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-linear-to-r from-vault-text-primary to-vault-primary-hover mb-1">
          Access Requests
        </h1>
        <p className="text-sm text-vault-text-secondary">Submit requests or approve team access</p>
      </div>

      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-vault-text-primary flex items-center gap-2">
            Pending Requests
            {pendingRequests.length > 0 && (
              <span className="bg-amber-500/20 text-amber-400 text-xs px-2 py-0.5 rounded-full font-bold">
                {pendingRequests.length}
              </span>
            )}
          </h3>
          <Button size="sm" onClick={() => setShowForm(!showForm)}>
            + Request Access
          </Button>
        </div>

        {showForm && (
          <div className="mb-6">
            <Modal
              isOpen={showForm}
              onClose={() => setShowForm(false)}
              title="Request API Access"
              sub="Your request will be reviewed by the workspace owner"
            >
              <RequestForm
                vaultKeys={vaultKeys}
                onSubmit={handleSubmitRequest}
                onCancel={() => setShowForm(false)}
              />
            </Modal>
          </div>
        )}

        {pendingRequests.length === 0 ? (
          <div className="glass-card py-10 text-center text-vault-text-muted">
            No pending requests at this time.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {pendingRequests.map(req => (
              <div key={req._id} className="glass-card p-5 border-l-4 border-l-amber-500">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-semibold text-vault-text-primary">{req.requesterName}</span>
                      <span className="text-xs text-vault-text-muted">{req.requesterEmail}</span>
                    </div>
                    <p className="text-sm text-vault-text-secondary mb-3">
                      Requested access to <strong className="text-vault-text-primary">{req.provider}</strong> in <strong className="text-vault-text-primary">{req.environment}</strong>
                    </p>
                    <div className="bg-[#0c1019]/60 p-3 rounded border border-vault-border text-sm mb-4">
                      <div className="text-vault-text-muted text-xs uppercase tracking-wider mb-1">Reason</div>
                      <div className="text-vault-text-primary">"{req.reason}"</div>
                    </div>
                    <div className="flex gap-4 text-xs text-vault-text-muted">
                      <div><span className="font-semibold text-vault-text-secondary">Endpoints:</span> {req.allowedEndpoints?.join(', ') || '*'}</div>
                      <div><span className="font-semibold text-vault-text-secondary">Limit:</span> {req.rateLimitDaily}/day</div>
                      <div><span className="font-semibold text-vault-text-secondary">Expires:</span> {req.expiryDays} days</div>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      variant="ghost"
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      onClick={() => handleDeny(req._id)}
                    >
                      Deny
                    </Button>
                    <Button
                      variant="primary"
                      onClick={() => handleApprove(req._id)}
                    >
                      Approve
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="text-lg font-semibold text-vault-text-primary mb-4">Past Requests</h3>
        {resolvedRequests.length === 0 ? (
          <div className="text-sm text-vault-text-muted">No history.</div>
        ) : (
          <div className="glass-card overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr>
                  <th className="py-3 px-4 border-b border-vault-border text-xs font-semibold text-vault-text-muted uppercase tracking-wider">Requester</th>
                  <th className="py-3 px-4 border-b border-vault-border text-xs font-semibold text-vault-text-muted uppercase tracking-wider">Access</th>
                  <th className="py-3 px-4 border-b border-vault-border text-xs font-semibold text-vault-text-muted uppercase tracking-wider">Status</th>
                  <th className="py-3 px-4 border-b border-vault-border text-xs font-semibold text-vault-text-muted uppercase tracking-wider">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-vault-border/50 text-sm">
                {resolvedRequests.map(req => (
                  <tr key={req._id}>
                    <td className="py-3 px-4">
                      <div className="font-medium text-vault-text-primary">{req.requesterName}</div>
                      <div className="text-xs text-vault-text-muted">{req.requesterEmail}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-vault-text-primary">{req.provider}</div>
                      <div className="text-xs text-vault-text-muted">{req.environment}</div>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={req.status === 'approved' ? 'success' : 'danger'}>
                        {req.status === 'approved' ? 'Approved' : 'Denied'}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-vault-text-secondary">
                      {formatDate(req.resolvedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
