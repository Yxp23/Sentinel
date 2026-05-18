export const fmt = (n) => {
  if (n == null) return '$0'
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`
  return `$${n.toFixed(0)}`
}

export const RISK_COLORS = {
  HIGH: ['rgba(232,168,56,0.12)', 'var(--amber)'],
  MEDIUM: ['rgba(56,178,172,0.12)', 'var(--teal)'],
  LOW: ['rgba(80,80,100,0.1)', 'var(--dim)'],
}
