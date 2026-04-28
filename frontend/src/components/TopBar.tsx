import { Badge } from './ui/Badge'

interface Props {
  year: number | null
  quarter: number | null
  onAdminClick?: () => void
}

export function TopBar({ year, quarter, onAdminClick }: Props) {
  return (
    <header
      style={{
        height: 48,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '0 16px',
        background: 'rgba(5,16,29,0.97)',
        borderBottom: '1px solid var(--border)',
        backdropFilter: 'blur(8px)',
        zIndex: 100,
      }}
    >
      <svg width="24" height="24" viewBox="0 0 22 22" fill="none">
        <rect width="22" height="22" rx="4" fill="var(--cyan-d)" />
        <path d="M11 4v14M4 11h14" stroke="var(--cyan)" strokeWidth="2" strokeLinecap="round" />
        <circle cx="11" cy="11" r="3" fill="var(--cyan)" fillOpacity="0.18" stroke="var(--cyan)" strokeWidth="1.2" />
      </svg>

      <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--fs-lg)', fontWeight: 500, color: 'var(--t1)' }}>
        Онко<span style={{ color: 'var(--cyan)' }}>ГИС</span>
      </div>

      <div style={{ width: 1, height: 22, background: 'var(--border)', marginLeft: 2 }} />

      <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--t2)', fontFamily: 'var(--mono)' }}>Абайская область</span>

      <div style={{ display: 'flex', gap: 6, marginLeft: 4 }}>
        <Badge>{year ? `Скрининг ${year}` : 'Скрининг'}</Badge>
        <Badge color="rgba(0,196,206,0.2)">{quarter ? `Период Q${quarter}` : 'Период не выбран'}</Badge>
      </div>

      <div style={{ flex: 1 }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--ok)', boxShadow: '0 0 6px var(--ok)' }} />
        <span style={{ fontSize: 'var(--fs-sm)', fontFamily: 'var(--mono)', color: 'var(--t2)' }}>Данные актуальны</span>
      </div>

      <button
        onClick={onAdminClick}
        style={{
          marginLeft: 8,
          padding: '5px 12px',
          background: 'var(--bg3)',
          border: '1px solid var(--border)',
          borderRadius: 4,
          color: 'var(--t2)',
          fontSize: 'var(--fs-sm)',
          fontFamily: 'var(--sans)',
          cursor: 'pointer',
          transition: 'border-color 0.15s, color 0.15s',
        }}
        onMouseEnter={event => {
          const button = event.target as HTMLButtonElement
          button.style.borderColor = 'var(--border-hi)'
          button.style.color = 'var(--t1)'
        }}
        onMouseLeave={event => {
          const button = event.target as HTMLButtonElement
          button.style.borderColor = 'var(--border)'
          button.style.color = 'var(--t2)'
        }}
      >
        Администрирование
      </button>
    </header>
  )
}
