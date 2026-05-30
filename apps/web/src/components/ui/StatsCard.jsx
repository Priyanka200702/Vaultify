export default function StatsCard({ title, value, icon, trend }) {
  return (
    <div className="glass-card p-5 relative overflow-hidden group">
      <div className="flex items-center justify-between mb-3 relative z-10">
        <h4 className="text-xs font-medium text-vault-text-muted uppercase tracking-wider">{title}</h4>
        <div className="text-xl opacity-80 group-hover:opacity-100 transition-opacity group-hover:scale-110 duration-300">
          {icon}
        </div>
      </div>
      <div className="flex items-baseline gap-3 relative z-10">
        <span className="text-3xl font-bold text-vault-text-primary">{value}</span>
        {trend && (
          <span className={`text-xs font-medium ${trend.isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
            {trend.isPositive ? '↑' : '↓'} {trend.value}%
          </span>
        )}
      </div>
      {/* Decorative gradient orb */}
      <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-vault-primary/10 rounded-full blur-2xl group-hover:bg-vault-primary/20 transition-colors duration-500"></div>
    </div>
  );
}
