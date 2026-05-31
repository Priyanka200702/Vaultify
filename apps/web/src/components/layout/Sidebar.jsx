import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { ArrowUpRight, ClipboardList, KeyRound, LayoutDashboard, LockKeyhole } from 'lucide-react';

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/tokens', label: 'Proxy Tokens', icon: KeyRound },
  { path: '/my-keys', label: 'My Keys', icon: LockKeyhole },
  { path: '/audit', label: 'Audit Logs', icon: ClipboardList },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside className="fixed left-0 top-0 z-50 flex h-screen w-65 p-3 animate-[slideInLeft_0.4s_ease]">
      <div className="flex h-full w-full flex-col overflow-hidden rounded-[2rem] border border-white/20 bg-white/10 backdrop-blur-2xl shadow-[0_24px_60px_rgba(15,23,42,0.35)]">
        {/* Logo */}
        <div className="flex items-center gap-3 border-b border-white/10 px-5 py-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-linear-to-br from-vault-primary to-vault-primary-hover shadow-[0_18px_40px_rgba(99,102,241,0.28)]">
            <LockKeyhole className="h-5 w-5 text-white" />
          </div>
          <span className="bg-clip-text text-[1.2rem] font-bold tracking-tight text-transparent bg-linear-to-br from-vault-text-primary to-vault-primary-hover">
            Vaultify
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex flex-1 flex-col gap-2 px-4 py-5">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => {
                const base =
                  'relative flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all duration-300 ';
                const active =
                  'border border-white/20 bg-vault-primary/10 text-vault-text-primary shadow-[0_10px_30px_rgba(99,102,241,0.16)]';
                const inactive = 'text-vault-text-secondary hover:border-white/10 hover:bg-white/5 hover:text-vault-text-primary';
                return base + (isActive ? active : inactive);
              }}
            >
              <item.icon className="h-4.5 w-4.5" />
              <span className="flex-1">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* User section */}
        <div className="flex items-center gap-3 border-t border-white/10 p-4">
          <div className="flex flex-1 items-center gap-2.5 overflow-hidden">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-vault-primary to-emerald-500 text-xs font-bold text-white shadow-[0_10px_25px_rgba(99,102,241,0.22)]">
              {user?.name?.charAt(0)?.toUpperCase() || 'V'}
            </div>
            <div className="flex flex-col overflow-hidden">
              <span className="truncate text-xs font-semibold text-vault-text-primary">{user?.name || 'User'}</span>
              <span className="truncate text-[0.7rem] text-vault-text-muted">{user?.email || ''}</span>
            </div>
          </div>
          <button 
            onClick={handleLogout} 
            title="Logout"
            className="cursor-pointer rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-vault-text-muted transition-all duration-300 hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-300"
          >
            <ArrowUpRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
