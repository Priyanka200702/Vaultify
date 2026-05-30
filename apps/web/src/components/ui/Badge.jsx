export default function Badge({ children, variant = 'default', className = '' }) {
  const variants = {
    default: "bg-white/5 text-vault-text-secondary border-vault-border",
    primary: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
    success: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    warning: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    danger: "bg-red-500/10 text-red-400 border-red-500/20",
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[0.7rem] font-medium border ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
}
