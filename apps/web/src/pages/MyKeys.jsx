import { useEffect, useState } from 'react';
import useStore from '../store/store';
import { useFetch } from '../hooks/useFetch';
import { getVaultKeys, storeVaultKey, deleteVaultKey, getKeyTokenCount } from '../services/workspaceService';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import StoreKeyForm from '../components/forms/StoreKeyForm';
import { formatDate } from '../utils/helpers';
import { LockKeyhole, Trash2 } from 'lucide-react';

export default function MyKeys() {
  const { vaultKeys, setVaultKeys } = useStore();
  const [isStoreKeyOpen, setIsStoreKeyOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null); // { key, activeTokens }
  const [isDeleting, setIsDeleting] = useState(false);

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

  const handleDeleteClick = async (key) => {
    try {
      const data = await getKeyTokenCount(key._id);
      setDeleteTarget({ key, activeTokens: data.activeTokens });
    } catch (err) {
      console.error('Failed to check token count:', err);
      // Fall back — open modal without count
      setDeleteTarget({ key, activeTokens: 0 });
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteVaultKey(deleteTarget.key._id);
      setDeleteTarget(null);
      loadKeys();
    } catch (err) {
      console.error('Delete failed:', err);
    } finally {
      setIsDeleting(false);
    }
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
          <LockKeyhole className="mx-auto mb-3 h-10 w-10 text-vault-primary-hover" />
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

              <div className="pt-1 border-t border-vault-border/50">
                <Button
                  variant="danger"
                  size="sm"
                  className="w-full"
                  onClick={() => handleDeleteClick(key)}
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                  Delete Key
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 text-sm text-vault-text-muted">
        Keys are encrypted with AES-256-GCM before storage and never returned in plaintext.
      </div>

      {/* Add Key Modal */}
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

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => !isDeleting && setDeleteTarget(null)}
        title="Delete API Key"
        sub={deleteTarget?.key?.name}
      >
        <div className="space-y-5">
          {deleteTarget?.activeTokens > 0 ? (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 space-y-2">
              <div className="flex items-center gap-2 text-red-400 font-semibold text-sm">
                <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <span>Active tokens will be permanently deleted</span>
              </div>
              <p className="text-sm text-vault-text-secondary leading-relaxed">
                This key has <strong className="text-red-300">{deleteTarget.activeTokens} active proxy token{deleteTarget.activeTokens !== 1 ? 's' : ''}</strong>.
                Deleting this key will <strong className="text-red-300">immediately and permanently delete</strong> all proxy tokens created for it.
                Any applications using these tokens will stop working.
              </p>
            </div>
          ) : (
            <p className="text-sm text-vault-text-secondary leading-relaxed">
              Are you sure you want to delete this key? This action cannot be undone.
            </p>
          )}

          <div className="rounded-lg border border-vault-border bg-[#0c1019]/70 p-3">
            <div className="grid grid-cols-2 gap-y-2 text-xs">
              <span className="text-vault-text-muted">Name</span>
              <span className="text-vault-text-primary font-medium text-right">{deleteTarget?.key?.name}</span>
              <span className="text-vault-text-muted">Provider</span>
              <span className="text-vault-text-primary capitalize text-right">{deleteTarget?.key?.provider}</span>
              <span className="text-vault-text-muted">Prefix</span>
              <span className="text-vault-text-primary font-mono text-right">{deleteTarget?.key?.keyPrefix}</span>
              {deleteTarget?.activeTokens > 0 && (
                <>
                  <span className="text-vault-text-muted">Active tokens</span>
                  <span className="text-red-400 font-semibold text-right">{deleteTarget.activeTokens}</span>
                </>
              )}
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <Button
              variant="ghost"
              className="flex-1"
              onClick={() => setDeleteTarget(null)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              onClick={handleConfirmDelete}
              loading={isDeleting}
            >
              {deleteTarget?.activeTokens > 0
                ? `Delete Key & ${deleteTarget.activeTokens} Token${deleteTarget.activeTokens !== 1 ? 's' : ''}`
                : 'Delete Key'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}