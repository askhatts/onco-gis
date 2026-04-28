import type { ReactNode } from 'react'

interface Props { children: ReactNode; color?: string }

export function Badge({ children, color = 'var(--t3)' }: Props) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 7px', borderRadius: 3,
      background: 'rgba(255,255,255,0.04)', border: `1px solid ${color}`,
      fontSize: 'var(--fs-sm)', color: 'var(--t2)', fontFamily: 'var(--mono)',
    }}>
      {children}
    </span>
  )
}
