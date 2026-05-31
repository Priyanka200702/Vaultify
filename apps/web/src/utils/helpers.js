import {
  Bot,
  Brain,
  BriefcaseBusiness,
  CalendarDays,
  Cloud,
  CloudCog,
  Copy,
  Database,
  GitBranch,
  GitFork,
  KeyRound,
  Leaf,
  LayoutDashboard,
  LockKeyhole,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Ticket,
  TrainFront,
  Triangle,
  Trash2,
  Wrench,
} from 'lucide-react';

/**
 * Masks a token string for display.
 * "vlt_prod_8x2kqr9m..." → "vlt_prod_8x2k••••••••"
 */
export function maskToken(token) {
  if (!token || token.length < 16) return token;
  return token.substring(0, 14) + '••••••••';
}

/**
 * Formats a date to relative time or short date.
 */
export function formatDate(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Formats latency in ms to a readable string.
 */
export function formatLatency(ms) {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

/**
 * Returns a color class based on HTTP status code.
 */
export function getStatusColor(code) {
  if (code >= 200 && code < 300) return 'var(--accent-emerald)';
  if (code >= 300 && code < 400) return 'var(--accent-cyan)';
  if (code >= 400 && code < 500) return 'var(--accent-amber)';
  return 'var(--accent-red)';
}

/**
 * Returns badge color for token status.
 */
export function getTokenStatus(token) {
  if (token.revokedAt) return { label: 'Revoked', color: 'var(--accent-red)', bg: 'var(--accent-red-glow)' };
  if (token.expiresAt && new Date(token.expiresAt) < new Date()) return { label: 'Expired', color: 'var(--accent-amber)', bg: 'var(--accent-amber-glow)' };
  return { label: 'Active', color: 'var(--accent-emerald)', bg: 'var(--accent-emerald-glow)' };
}

/**
 * Provider display info.
 */
export const PROVIDERS = {
  anthropic: { name: 'Anthropic', icon: Bot, color: '#D4A574' },
  openai: { name: 'OpenAI', icon: Brain, color: '#10A37F' },
  gemini: { name: 'Gemini', icon: Sparkles, color: '#8AB87D' },
  github: { name: 'GitHub', icon: GitFork, color: '#F0F6FC' },
  gitlab: { name: 'GitLab', icon: GitBranch, color: '#FC6D26' },
  aws: { name: 'AWS', icon: Cloud, color: '#FF9900' },
  azure: { name: 'Azure', icon: CloudCog, color: '#0078D4' },
  gcp: { name: 'Google Cloud', icon: Cloud, color: '#4285F4' },
  supabase: { name: 'Supabase', icon: Database, color: '#3ECF8E' },
  planetscale: { name: 'PlanetScale', icon: Database, color: '#000000' },
  mongodb: { name: 'MongoDB Cloud', icon: Leaf, color: '#47A248' },
  vercel: { name: 'Vercel', icon: Triangle, color: '#FFFFFF' },
  cloudflare: { name: 'Cloudflare', icon: Cloud, color: '#F38020' },
  railway: { name: 'Railway', icon: TrainFront, color: '#0B0D0E' },
  stripe: { name: 'Stripe', icon: BriefcaseBusiness, color: '#635BFF' },
  custom: { name: 'Custom', icon: Wrench, color: '#94A3B8' },
};

export function getProviderInfo(provider) {
  return PROVIDERS[provider] || PROVIDERS.custom;
}
