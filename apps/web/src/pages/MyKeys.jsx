import { useEffect, useState } from 'react';
import useStore from '../store/store';
import { useFetch } from '../hooks/useFetch';
import { getVaultKeys, storeVaultKey } from '../services/workspaceService';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import StoreKeyForm from '../components/forms/StoreKeyForm';
import { formatDate } from '../utils/helpers';

export default function MyKeys() {
  const { vaultKeys, setVaultKeys } = useStore();
  const [isStoreKeyOpen, setIsStoreKeyOpen] = useState(false);

  const keysFetch = useFetch(getVaultKeys);
  const storeKeyFetch = useFetch(storeVaultKey);

  const loadKeys = () => {
    keysFetch.execute().then(data => setVaultKeys(data.keys || [])).catch(console.error);
  };

  useEffect(() => {
    loadKeys();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleStoreKey = async (formData) => {
    await storeKeyFetch.execute(formData);
    setIsStoreKeyOpen(false);
    loadKeys();
  };

  const safeVaultKeys = vaultKeys || [];

  return (
    <div className="animate-[fadeIn_0.4s_ease]">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-linear-to-r from-vault-text-primary to-vault-primary-hover mb-1">
            My Keys
          </h1>
          <p className="text-sm text-vault-text-secondary">Store and manage your real API keys before issuing proxy tokens</p>
        </div>
        <Button variant="primary" onClick={() => setIsStoreKeyOpen(true)}>
          + Add API Key
        </Button>
      </div>

      {safeVaultKeys.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <div className="text-4xl mb-3">🔐</div>
          <h3 className="text-lg font-semibold text-vault-text-primary mb-1">No API keys stored yet</h3>
          <p className="text-sm text-vault-text-secondary mb-5">Add your first key here. Vaultify will encrypt it before storage.</p>
          <Button variant="primary" onClick={() => setIsStoreKeyOpen(true)}>
            Add your first key
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {safeVaultKeys.map((key) => (
            <div key={key._id} className="glass-card frost-card p-5 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-vault-text-primary">{key.name}</div>
                  <div className="text-xs text-vault-text-muted capitalize">{key.provider} · {key.environment}</div>
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

      <div className="mt-6 text-sm text-vault-text-muted">
        Keys are encrypted with AES-256-GCM before storage and never returned in plaintext.
      </div>

      <Modal
        isOpen={isStoreKeyOpen}
        onClose={() => setIsStoreKeyOpen(false)}
        title="Add API Key"
        sub="Encrypt a real key first, then use it to issue proxy tokens"
      >
        <StoreKeyForm
          onSubmit={handleStoreKey}
          onCancel={() => setIsStoreKeyOpen(false)}
        />
      </Modal>
    </div>
  );
}