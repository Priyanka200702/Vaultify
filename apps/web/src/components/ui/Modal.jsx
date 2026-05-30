import { useEffect } from 'react';

export default function Modal({ isOpen, onClose, title, sub, children }) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-100 flex items-start justify-center px-4 pt-4 sm:pt-8 pb-4 overflow-y-auto animate-[fadeIn_0.2s_ease]">
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      ></div>
      <div className="relative w-full max-w-2xl max-h-[calc(100vh-2rem)] overflow-hidden flex flex-col rounded-2xl border border-vault-glass-border bg-vault-bg-card backdrop-blur-xl p-6 shadow-2xl animate-[scaleIn_0.3s_ease]">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-lg font-semibold bg-clip-text text-transparent bg-linear-to-r from-white to-vault-text-secondary">
              {title}
            </h3>
            {sub && <p className="mt-1 text-xs text-vault-text-muted">{sub}</p>}
          </div>
          <button 
            onClick={onClose}
            className="text-vault-text-muted hover:text-white transition-colors p-1"
          >
            ✕
          </button>
        </div>
        <div className="text-sm text-vault-text-secondary overflow-y-auto pr-1 flex-1 min-h-0">
          {children}
        </div>
      </div>
    </div>
  );
}
