import { Sep } from './ui/Sep'
import type {
  DistrictOption,
  EpiIndicatorDefinition,
  FilterState,
  LayerState,
} from '../types'
import { SCREEN_INDICATORS, SCREEN_TYPES } from '../utils/dashboard'

interface Props {
  filters: FilterState
  layers: LayerState
  years: number[]
  quarters: number[]
  districts: DistrictOption[]
  epiIndicators: EpiIndicatorDefinition[]
  onFilter: (f: Partial<FilterState>) => void
  onLayer: (l: Partial<LayerState>) => void
}

function BtnRow<T extends string | number>({
  items,
  active,
  color,
  onClick,
  formatLabel,
}: {
  items: T[]
  active: T | null
  color: string
  onClick: (value: T) => void
  formatLabel?: (value: T) => string
}) {
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {items.map(item => (
        <button
          key={String(item)}
          onClick={() => onClick(item)}
          style={{
            padding: '4px 9px',
            borderRadius: 4,
            fontSize: 'var(--fs-sm)',
            fontFamily: 'var(--mono)',
            cursor: 'pointer',
            border: 'none',
            background: active === item ? color : 'var(--bg3)',
            color: active === item ? '#fff' : 'var(--t2)',
            transition: 'background 0.15s',
          }}
        >
          {formatLabel ? formatLabel(item) : item}
        </button>
      ))}
    </div>
  )
}

function ToggleSwitch({ on, onChange, label }: { on: boolean; onChange: (value: boolean) => void; label: string }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer', padding: '4px 0' }}>
      <div
        onClick={() => onChange(!on)}
        style={{
          width: 32,
          height: 17,
          borderRadius: 8,
          position: 'relative',
          background: on ? 'var(--cyan)' : 'var(--bg4)',
          transition: 'background 0.2s',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 2,
            left: on ? 17 : 2,
            width: 13,
            height: 13,
            borderRadius: '50%',
            background: '#fff',
            transition: 'left 0.2s',
            boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
          }}
        />
      </div>
      <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--t2)' }}>{label}</span>
    </label>
  )
}

export function LeftPanel({
  filters,
  layers,
  years,
  quarters,
  districts,
  epiIndicators,
  onFilter,
  onLayer,
}: Props) {
  const districtValue = filters.districtId ?? ''

  return (
    <aside
      style={{
        width: 228,
        flexShrink: 0,
        background: 'var(--bg1)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        padding: '12px 12px 0',
        overflowY: 'auto',
      }}
    >
      <Sep label="Период" />
      <BtnRow items={years} active={filters.year} color="var(--cyan)" onClick={value => onFilter({ year: value })} />
      <div style={{ marginTop: 6 }}>
        <BtnRow
          items={quarters}
          active={filters.quarter}
          color="var(--amber)"
          formatLabel={value => `Q${value}`}
          onClick={value => onFilter({ quarter: value })}
        />
      </div>

      <Sep label="Эпидемиология" />
      <select
        value={filters.epi}
        onChange={event => onFilter({ epi: event.target.value as FilterState['epi'] })}
        style={{
          background: 'var(--bg3)',
          border: '1px solid var(--border)',
          borderRadius: 4,
          color: 'var(--t1)',
          fontSize: 'var(--fs-sm)',
          fontFamily: 'var(--sans)',
          padding: '6px 9px',
          width: '100%',
          cursor: 'pointer',
        }}
      >
        {epiIndicators.map(option => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>

      <Sep label="Скрининги" />
      <div style={{ display: 'flex', gap: 4, marginBottom: 7 }}>
        {SCREEN_TYPES.map(screen => (
          <button
            key={screen}
            onClick={() => onFilter({ screen, screenInd: SCREEN_INDICATORS[screen][0] })}
            style={{
              flex: 1,
              padding: '4px 0',
              borderRadius: 4,
              fontSize: 'var(--fs-sm)',
              fontFamily: 'var(--mono)',
              cursor: 'pointer',
              border: 'none',
              background: filters.screen === screen ? 'var(--teal)' : 'var(--bg3)',
              color: filters.screen === screen ? '#fff' : 'var(--t2)',
              transition: 'background 0.15s',
            }}
          >
            {screen}
          </button>
        ))}
      </div>
      <select
        value={filters.screenInd}
        onChange={event => onFilter({ screenInd: event.target.value })}
        style={{
          background: 'var(--bg3)',
          border: '1px solid var(--border)',
          borderRadius: 4,
          color: 'var(--t1)',
          fontSize: 'var(--fs-sm)',
          fontFamily: 'var(--sans)',
          padding: '6px 9px',
          width: '100%',
          cursor: 'pointer',
        }}
      >
        {SCREEN_INDICATORS[filters.screen].map(option => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>

      <Sep label="Район" />
      <select
        value={districtValue}
        onChange={event => onFilter({ districtId: event.target.value || null })}
        style={{
          background: 'var(--bg3)',
          border: '1px solid var(--border)',
          borderRadius: 4,
          color: 'var(--t1)',
          fontSize: 'var(--fs-sm)',
          fontFamily: 'var(--sans)',
          padding: '6px 9px',
          width: '100%',
          cursor: 'pointer',
        }}
      >
        <option value="">Все районы</option>
        {districts.map(district => (
          <option key={district.id} value={district.id}>
            {district.shortName}
          </option>
        ))}
      </select>

      <Sep label="Слои карты" />
      <ToggleSwitch on={layers.choropleth} onChange={value => onLayer({ choropleth: value })} label="Хороплет" />
      <ToggleSwitch on={layers.mo} onChange={value => onLayer({ mo: value })} label="МО на карте" />
      <ToggleSwitch on={layers.borders} onChange={value => onLayer({ borders: value })} label="Границы" />
      <ToggleSwitch on={layers.labels} onChange={value => onLayer({ labels: value })} label="Подписи" />

      <div style={{ flex: 1 }} />
      <div
        style={{
          padding: '10px 0 12px',
          borderTop: '1px solid var(--border)',
          marginTop: 12,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span style={{ fontSize: 'var(--fs-xs)', fontFamily: 'var(--mono)', color: 'var(--t3)' }}>v2.5.0</span>
        <span
          style={{
            fontSize: 'var(--fs-xs)',
            padding: '2px 6px',
            borderRadius: 3,
            background: 'var(--amber-d)',
            color: 'var(--amber)',
            fontFamily: 'var(--mono)',
            letterSpacing: '0.06em',
          }}
        >
          БЕТА
        </span>
      </div>
    </aside>
  )
}
