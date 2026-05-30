import { useState } from 'react';
import Button from '../ui/Button';

const ENDPOINTS = [
  { method: 'POST', path: '/v1/messages', desc: 'Send messages, chat completions', provider: 'anthropic' },
  { method: 'GET', path: '/v1/models', desc: 'List available models', provider: 'anthropic' },
  { method: 'POST', path: '/v1/complete', desc: 'Legacy text completions', provider: 'anthropic' },
  { method: 'POST', path: '/v1/chat/completions', desc: 'Chat completions', provider: 'openai' },
  { method: 'POST', path: '/v1/embeddings', desc: 'Create embeddings', provider: 'openai' },
];

const RATE_OPTIONS = [
  { value: '', label: 'No limit' },
  { value: '100', label: '100 req / day' },
  { value: '500', label: '500 req / day' },
  { value: '1000', label: '1,000 req / day' },
  { value: '5000', label: '5,000 req / day' },
];

const EXPIRY_OPTIONS = [
  { value: '1d', label: '1 day' },
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: 'never', label: 'No expiry' },
];

export default function RequestForm({ vaultKeys, onSubmit, onCancel }) {
  const [providerKey, setProviderKey] = useState('');
  const [selectedEndpoints, setSelectedEndpoints] = useState(new Set(['POST /v1/messages']));
  const [rateLimit, setRateLimit] = useState('500');
  const [expiry, setExpiry] = useState('7d');
  const [reason, setReason] = useState('');
  const [showPreview, setShowPreview] = useState(true);

  const selectedKey = vaultKeys.find(k => `${k.provider}-${k.environment}` === providerKey);

  const toggleEndpoint = (endpoint, checked) => {
    const newSet = new Set(selectedEndpoints);
    if (checked) {
      newSet.add(endpoint);
    } else {
      newSet.delete(endpoint);
    }
    setSelectedEndpoints(newSet);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!providerKey || selectedEndpoints.size === 0 || !reason.trim()) return;

    onSubmit({
      vaultKeyId: selectedKey?._id,
      provider: selectedKey?.provider,
      environment: selectedKey?.environment,
      allowedEndpoints: Array.from(selectedEndpoints),
      rateLimitDaily: rateLimit ? parseInt(rateLimit) : null,
      expiryDays: expiry === 'never' ? null : parseInt(expiry),
      reason: reason.trim(),
    });
  };

  const isValid = providerKey && selectedEndpoints.size > 0 && reason.trim().length > 0;

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-sm text-vault-text-secondary">
      <div>
        <label className="block text-xs font-medium text-vault-text-secondary mb-1.5 uppercase tracking-wide">Provider &amp; environment <span className="text-red-400">*</span></label>
        <select
          className="w-full bg-vault-bg-input border border-vault-border rounded-lg px-3.5 py-2.5 text-sm text-vault-text-primary transition-colors focus:outline-none focus:border-vault-primary focus:ring-3 focus:ring-indigo-500/25 placeholder:text-vault-text-muted"
          value={providerKey}
          onChange={(e) => setProviderKey(e.target.value)}
          required
        >
          <option value="">Select a key...</option>
          {vaultKeys.map(key => (
            <option key={key._id} value={`${key.provider}-${key.environment}`}>
              {key.provider.charAt(0).toUpperCase() + key.provider.slice(1)} — {key.environment}
            </option>
          ))}
        </select>
        <p className="mt-1.5 text-[0.7rem] text-vault-text-muted">
          Only keys the owner has added are shown here
        </p>
      </div>

      <div>
        <label className="block text-xs font-medium text-vault-text-secondary mb-1.5 uppercase tracking-wide">Allowed endpoints <span className="text-red-400">*</span></label>
        <div className="max-h-60 overflow-auto rounded-xl border border-vault-border bg-[rgba(10,14,26,0.55)]">
          {ENDPOINTS.map(ep => {
            const checked = selectedEndpoints.has(`${ep.method} ${ep.path}`);
            return (
              <div
                key={ep.path}
                className="flex items-start gap-3 px-3 py-2.5 cursor-pointer border-b border-white/5 transition-colors hover:bg-vault-primary/10 last:border-b-0"
                onClick={() => toggleEndpoint(`${ep.method} ${ep.path}`, !checked)}
              >
                <div className={`mt-0.5 flex h-4 w-4 flex-none items-center justify-center rounded-[0.3rem] border ${checked ? 'border-vault-primary bg-vault-primary/20' : 'border-white/20 bg-vault-bg-input'}`}>
                  <span className={`text-[0.72rem] leading-none text-[#c7d2fe] ${checked ? 'opacity-100' : 'opacity-0'}`}>✓</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-[0.93rem] leading-[1.3] text-vault-text-primary">
                    <span className={`inline-flex items-center rounded-full border px-[0.42rem] py-[0.14rem] text-[0.67rem] font-semibold uppercase tracking-[0.02em] leading-none ${ep.method === 'POST' ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300' : 'border-blue-500/25 bg-blue-500/10 text-blue-300'}`}>
                      {ep.method}
                    </span>
                    {ep.path}
                  </div>
                  <div className="mt-0.5 text-[0.83rem] text-vault-text-secondary">{ep.desc}</div>
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-1.5 text-[0.7rem] text-vault-text-muted">Select only what you need — narrower scope = faster approval</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-medium text-vault-text-secondary mb-1.5 uppercase tracking-wide">Rate limit</label>
          <select
            className="w-full bg-vault-bg-input border border-vault-border rounded-lg px-3.5 py-2.5 text-sm text-vault-text-primary transition-colors focus:outline-none focus:border-vault-primary focus:ring-3 focus:ring-indigo-500/25 placeholder:text-vault-text-muted"
            value={rateLimit}
            onChange={(e) => setRateLimit(e.target.value)}
          >
            {RATE_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-vault-text-secondary mb-1.5 uppercase tracking-wide">Token expiry</label>
          <select
            className="w-full bg-vault-bg-input border border-vault-border rounded-lg px-3.5 py-2.5 text-sm text-vault-text-primary transition-colors focus:outline-none focus:border-vault-primary focus:ring-3 focus:ring-indigo-500/25 placeholder:text-vault-text-muted"
            value={expiry}
            onChange={(e) => setExpiry(e.target.value)}
          >
            {EXPIRY_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-vault-text-secondary mb-1.5 uppercase tracking-wide">Reason for access <span className="text-red-400">*</span></label>
        <textarea
          rows="4"
          className="w-full bg-vault-bg-input border border-vault-border rounded-lg px-3.5 py-2.5 text-sm text-vault-text-primary transition-colors focus:outline-none focus:border-vault-primary focus:ring-3 focus:ring-indigo-500/25 placeholder:text-vault-text-muted font-mono min-h-28"
          placeholder="e.g. building the chat feature for the dashboard, need to call /v1/messages from the preview branch"
          value={reason}
          onChange={(e) => setReason(e.target.value.slice(0, 200))}
          required
        />
        <div className="mt-1 text-xs text-vault-text-muted">{reason.length} / 200</div>
      </div>

      {showPreview && selectedKey && (
        <div className="rounded-xl border border-vault-border bg-[rgba(15,20,35,0.6)] p-3">
          <div className="mb-2 text-[0.8rem] uppercase tracking-[0.04em] text-vault-text-secondary">Token scope summary</div>
          <div className="flex flex-wrap gap-1.5">
            <span className="inline-flex items-center rounded-full border border-[rgba(99,102,241,0.3)] bg-[rgba(99,102,241,0.14)] px-2 py-1 text-[0.75rem] leading-[1.2] whitespace-nowrap text-[#dbe3ff]">{selectedKey.provider.charAt(0).toUpperCase() + selectedKey.provider.slice(1)} · {selectedKey.environment}</span>
            {Array.from(selectedEndpoints).map(ep => (
              <span key={ep} className="inline-flex items-center rounded-full border border-[rgba(99,102,241,0.3)] bg-[rgba(99,102,241,0.14)] px-2 py-1 text-[0.75rem] leading-[1.2] whitespace-nowrap text-[#dbe3ff]">{ep}</span>
            ))}
            {rateLimit && <span className="inline-flex items-center rounded-full border border-[rgba(99,102,241,0.3)] bg-[rgba(99,102,241,0.14)] px-2 py-1 text-[0.75rem] leading-[1.2] whitespace-nowrap text-[#dbe3ff]">{parseInt(rateLimit).toLocaleString()} req/day</span>}
            <span className="inline-flex items-center rounded-full border border-[rgba(99,102,241,0.3)] bg-[rgba(99,102,241,0.14)] px-2 py-1 text-[0.75rem] leading-[1.2] whitespace-nowrap text-[#dbe3ff]">
              {expiry === 'never' ? 'no expiry' : `expires in ${parseInt(expiry)} days`}
            </span>
          </div>
        </div>
      )}

      <div className="flex justify-end gap-3 pt-4 border-t border-vault-border mt-6">
        <Button variant="ghost" type="button" onClick={onCancel}>Cancel</Button>
        <Button variant="primary" type="submit" disabled={!isValid}>Submit request</Button>
      </div>
    </form>
  );
}
