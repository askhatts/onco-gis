import type {
  CurrentMoRecord,
  DistrictOption,
  EpiIndicatorDefinition,
  EpiRecord,
  ScreenType,
} from '../types'
import { formatPeriodLabel, formatValue, getEpiValue, getMoContextStats, getShortMoName } from '../utils/dashboard'

interface Props {
  selectedDistrict: DistrictOption | null
  selectedMoRecord: CurrentMoRecord | null
  screenType: ScreenType
  districtEpiRecord: EpiRecord | null
  epiIndicators: EpiIndicatorDefinition[]
  year: number | null
  quarter: number | null
}

function Stat({ label, value, color = 'var(--t1)' }: { label: string; value: string | number; color?: string }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        gap: 12,
        padding: '7px 0',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--t2)' }}>{label}</span>
      <span style={{ fontSize: 'var(--fs-md)', fontFamily: 'var(--mono)', fontWeight: 500, color }}>{value}</span>
    </div>
  )
}

function EmptyState() {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        padding: 24,
      }}
    >
      <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
        <circle cx="28" cy="28" r="27" stroke="rgba(0,196,206,0.15)" strokeWidth="1" strokeDasharray="4 4" />
        <circle cx="28" cy="28" r="18" stroke="rgba(0,196,206,0.1)" strokeWidth="1" strokeDasharray="3 3" />
        <circle cx="28" cy="28" r="4" fill="rgba(0,196,206,0.2)" />
      </svg>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 'var(--fs-md)', color: 'var(--t2)', marginBottom: 4 }}>Выберите район или МО</div>
        <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--t3)' }}>Нажмите на объект на карте или выберите его в таблице</div>
      </div>
    </div>
  )
}

function NoDataState({ districtName }: { districtName: string }) {
  return (
    <div style={{ padding: '16px 16px 18px' }}>
      <div style={{ fontSize: 'var(--fs-xs)', fontFamily: 'var(--mono)', color: 'var(--teal)', marginBottom: 6, letterSpacing: '0.08em' }}>
        РАЙОН
      </div>
      <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 600, color: 'var(--t1)', marginBottom: 10 }}>{districtName}</div>
      <div
        style={{
          padding: 12,
          borderRadius: 8,
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid var(--border)',
          color: 'var(--t2)',
          fontSize: 'var(--fs-sm)',
          lineHeight: 1.5,
        }}
      >
        Нет данных за выбранный период.
      </div>
    </div>
  )
}

function MoContext({
  mo,
  screenType,
  year,
  quarter,
}: {
  mo: CurrentMoRecord
  screenType: ScreenType
  year: number | null
  quarter: number | null
}) {
  const stats = getMoContextStats(screenType, mo)

  return (
    <div style={{ padding: '14px 16px', overflowY: 'auto' }}>
      <div style={{ fontSize: 'var(--fs-xs)', fontFamily: 'var(--mono)', color: 'var(--cyan)', marginBottom: 4, letterSpacing: '0.08em' }}>
        МО
      </div>
      <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 600, color: 'var(--t1)', marginBottom: 6, lineHeight: 1.35 }}>
        {getShortMoName(mo.mo_name)}
      </div>
      <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--t3)', marginBottom: 12 }}>
        {screenType} • {formatPeriodLabel(year, quarter)}
      </div>
      {stats.map(item => (
        <Stat key={item.label} label={item.label} value={item.value} color={item.tone} />
      ))}
      {mo.lat !== null && mo.lon !== null && (
        <div style={{ marginTop: 12, fontSize: 'var(--fs-xs)', fontFamily: 'var(--mono)', color: 'var(--t3)' }}>
          {mo.lat.toFixed(4)}, {mo.lon.toFixed(4)}
        </div>
      )}
    </div>
  )
}

function DistrictContext({
  district,
  districtEpiRecord,
  epiIndicators,
  year,
  quarter,
}: {
  district: DistrictOption
  districtEpiRecord: EpiRecord | null
  epiIndicators: EpiIndicatorDefinition[]
  year: number | null
  quarter: number | null
}) {
  if (!districtEpiRecord) {
    return <NoDataState districtName={district.shortName} />
  }

  return (
    <div style={{ padding: '14px 16px', overflowY: 'auto' }}>
      <div style={{ fontSize: 'var(--fs-xs)', fontFamily: 'var(--mono)', color: 'var(--teal)', marginBottom: 4, letterSpacing: '0.08em' }}>
        РАЙОН
      </div>
      <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 600, color: 'var(--t1)', marginBottom: 6 }}>{district.shortName}</div>
      <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--t3)', marginBottom: 12 }}>{formatPeriodLabel(year, quarter)}</div>
      {epiIndicators.map(indicator => (
        <Stat
          key={indicator.id}
          label={indicator.label}
          value={formatValue(getEpiValue(districtEpiRecord, indicator.id), indicator.unit)}
          color={indicator.color}
        />
      ))}
    </div>
  )
}

export function ContextPanel({
  selectedDistrict,
  selectedMoRecord,
  screenType,
  districtEpiRecord,
  epiIndicators,
  year,
  quarter,
}: Props) {
  return (
    <aside
      style={{
        width: 300,
        flexShrink: 0,
        background: 'var(--bg1)',
        borderLeft: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
      }}
    >
      <div
        style={{
          padding: '12px 16px 10px',
          borderBottom: '1px solid var(--border)',
          fontSize: 'var(--fs-xs)',
          fontFamily: 'var(--mono)',
          color: 'var(--t3)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}
      >
        {selectedMoRecord ? 'Организация ПМСП' : selectedDistrict ? 'Район' : 'Контекст'}
      </div>

      {selectedMoRecord ? (
        <MoContext mo={selectedMoRecord} screenType={screenType} year={year} quarter={quarter} />
      ) : selectedDistrict ? (
        <DistrictContext
          district={selectedDistrict}
          districtEpiRecord={districtEpiRecord}
          epiIndicators={epiIndicators}
          year={year}
          quarter={quarter}
        />
      ) : (
        <EmptyState />
      )}
    </aside>
  )
}
