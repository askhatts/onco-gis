import { Spark } from './ui/Spark'
import type { KpiItem } from '../types'

const KPI_DATA: KpiItem[] = [
  {
    label: 'Заболеваемость', val: '58.6', unit: 'на 100 тыс.',
    delta: '+2.1', deltaUp: false, color: '#00c4ce',
    spark: [52, 54, 55, 57, 56, 58, 57, 58.6],
  },
  {
    label: 'Смертность', val: '22.4', unit: 'на 100 тыс.',
    delta: '-1.3', deltaUp: true, color: '#27c97a',
    spark: [26, 25, 24, 23, 24, 23, 22, 22.4],
  },
  {
    label: 'Охват скринингом', val: '71.2', unit: '%',
    delta: '+4.7', deltaUp: true, color: '#00a89e',
    spark: [61, 63, 65, 67, 68, 70, 70, 71.2],
  },
  {
    label: 'МО в системе', val: '32', unit: 'учреждений',
    delta: '+2', deltaUp: true, color: '#3a8ff4',
    spark: [28, 29, 29, 30, 30, 31, 32, 32],
  },
  {
    label: 'I–II стадии', val: '48.3', unit: '%',
    delta: '+3.2', deltaUp: true, color: '#e8a020',
    spark: [41, 43, 44, 44, 45, 46, 47, 48.3],
  },
]

function KpiCard({ item }: { item: KpiItem }) {
  const isUp = item.deltaUp
  return (
    <div style={{
      flex: 1, minWidth: 130,
      background: 'var(--bg2)',
      border: '1px solid var(--border)',
      borderRadius: 6, padding: '10px 12px',
      display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--t2)', fontFamily: 'var(--mono)', letterSpacing: '0.04em' }}>
        {item.label.toUpperCase()}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontSize: 'var(--fs-xl)', fontWeight: 600, color: item.color, fontFamily: 'var(--mono)', lineHeight: 1 }}>
          {item.val}
        </span>
        <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--t3)' }}>{item.unit}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <span style={{
          fontSize: 'var(--fs-sm)', fontFamily: 'var(--mono)',
          color: isUp ? 'var(--ok)' : 'var(--err)',
        }}>
          {item.delta}
        </span>
        <Spark values={item.spark} color={item.color} />
      </div>
    </div>
  )
}

export function KPICards() {
  return (
    <div style={{
      display: 'flex', gap: 8, padding: '8px 12px',
      background: 'var(--bg1)', borderBottom: '1px solid var(--border)',
    }}>
      {KPI_DATA.map(item => <KpiCard key={item.label} item={item} />)}
    </div>
  )
}
