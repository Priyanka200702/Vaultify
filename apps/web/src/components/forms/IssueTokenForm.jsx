import { useState } from 'react';
import Button from '../ui/Button';

const RATE_OPTIONS = [
  { value: '', label: 'No limit' },
  { value: '100', label: '100 req / day' },
  { value: '500', label: '500 req / day' },
  { value: '1000', label: '1,000 req / day' },
  { value: '5000', label: '5,000 req / day' },
];

export default function IssueTokenForm({ vaultKeys, onSubmit, onCancel }) {
  const [vaultKeyId, setVaultKeyId] = useState('');
  const [rateLimit, setRateLimit] = useState('500');
  const [expiresInDays, setExpiresInDays] = useState('7');
  const [showPreview, setShowPreview] = useState(true);

  const selectedKey = vaultKeys.find(k => k._id === vaultKeyId);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!vaultKeyId) return;

    onSubmit({
      vaultKeyId,
      environment: selectedKey?.environment,
      rateLimitDaily: rateLimit ? parseInt(rateLimit) : null,
      expiresInDays: expiresInDays ? parseInt(expiresInDays) : null,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-sm text-vault-text-secondary">
      <div>
        <label className="block text-xs font-medium text-vault-text-secondary mb-1.5 uppercase tracking-wide">Vault Key</label>
        <select
          className="w-full bg-vault-bg-input border border-vault-border rounded-lg px-3.5 py-2.5 text-sm text-vault-text-primary transition-colors focus:outline-none focus:border-vault-primary focus:ring-3 focus:ring-indigo-500/25 placeholder:text-vault-text-muted"
          value={vaultKeyId}
          onChange={(e) => setVaultKeyId(e.target.value)}
          required
        >
          <option value="">Select a key...</option>
          {vaultKeys.map(key => (
            <option key={key._id} value={key._id}>
              {key.name} ({key.provider} - {key.environment})
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-medium text-vault-text-secondary mb-1.5 uppercase tracking-wide">Rate Limit</label>
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
          <label className="block text-xs font-medium text-vault-text-secondary mb-1.5 uppercase tracking-wide">Expires In (Days)</label>
          <select
            className="w-full bg-vault-bg-input border border-vault-border rounded-lg px-3.5 py-2.5 text-sm text-vault-text-primary transition-colors focus:outline-none focus:border-vault-primary focus:ring-3 focus:ring-indigo-500/25 placeholder:text-vault-text-muted"
            value={expiresInDays}
            onChange={(e) => setExpiresInDays(e.target.value)}
          >
            <option value="1">1 day</option>
            <option value="7">7 days</option>
            <option value="30">30 days</option>
            <option value="">Never</option>
          </select>
        </div>
      </div>

      {showPreview && selectedKey && (
        <div className="rounded-xl border border-vault-border bg-[rgba(15,20,35,0.6)] p-3">
          <div className="mb-2 text-[0.8rem] uppercase tracking-[0.04em] text-vault-text-secondary">Token Scope Summary</div>
          <div className="flex flex-wrap gap-1.5">
            <span className="inline-flex items-center rounded-full border border-vault-border-hover bg-[rgba(99,102,241,0.14)] px-2 py-1 text-[0.75rem] leading-[1.2] whitespace-nowrap text-[#dbe3ff]">
              {selectedKey.provider.charAt(0).toUpperCase() + selectedKey.provider.slice(1)} · {selectedKey.environment}
            </span>
            {rateLimit && <span className="inline-flex items-center rounded-full border border-vault-border-hover bg-[rgba(99,102,241,0.14)] px-2 py-1 text-[0.75rem] leading-[1.2] whitespace-nowrap text-[#dbe3ff]">{parseInt(rateLimit).toLocaleString()} req/day</span>}
            <span className="inline-flex items-center rounded-full border border-vault-border-hover bg-[rgba(99,102,241,0.14)] px-2 py-1 text-[0.75rem] leading-[1.2] whitespace-nowrap text-[#dbe3ff]">
              {expiresInDays ? `expires in ${expiresInDays} days` : 'never expires'}
            </span>
          </div>
        </div>
      )}

      <div className="flex justify-end gap-3 pt-4 border-t border-vault-border mt-6">
        <Button variant="ghost" type="button" onClick={onCancel}>Cancel</Button>
        <Button variant="primary" type="submit">Issue Proxy Token</Button>
      </div>
    </form>
  );
}
