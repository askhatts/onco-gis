import { useMemo, useState } from 'react'
import { LineChart } from './ui/LineChart'
import type {
  CurrentMoRecord,
  DistrictOption,
  EpiIndicatorDefinition,
  EpiRecord,
  MoRecord,
  ScreenType,
} from '../types'
import {
  averageEpiRecords,
  formatPeriodLabel,
  formatValue,
  getEpiValue,
  getScreenIndicatorValue,
  getShortMoName,
  normalizeDistrictName,
} from '../utils/dashboard'

interface Props {
  year: number | null
  quarter: number | null
  selectedDistrict: DistrictOption | null
  areaEpiRecord: EpiRecord | null
  districtEpiRecord: EpiRecord | null
  selectedEpiIndicator: EpiIndicatorDefinition
  epiIndicators: EpiIndicatorDefinition[]
  epiRows: EpiRecord[]
  epiHistory: EpiRecord[]
  districtOptions: DistrictOption[]
  currentMoData: CurrentMoRecord[]
  screeningHistory: MoRecord[]
  selectedMo: string | null
  selectedIndicator: string
  screenType: ScreenType
  onSelectMo: (name: string | null) => void
}

type ScreeningPanelMode = 'rating' | 'dynamics'
type EpiPanelMode = 'summary' | 'dynamics'

function formatScreenValue(value: number, indicator: string) {
  return indicator === 'Охват' ? `${value.toLocaleString('ru-RU')}%` : value.toLocaleString('ru-RU')
}

function EmptyCard({ text }: { text: string }) {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: '1px dashed rgba(255,255,255,0.08)',
        borderRadius: 8,
        color: 'var(--t3)',
        fontSize: 'var(--fs-sm)',
        padding: 18,
        textAlign: 'center',
      }}
    >
      {text}
    </div>
  )
}

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <div style={{ fontSize: 'var(--fs-md)', fontWeight: 600, color: 'var(--t1)' }}>{title}</div>
      <div style={{ fontSize: 'var(--fs-xs)', fontFamily: 'var(--mono)', color: 'var(--t3)', marginTop: 3 }}>{subtitle}</div>
    </div>
  )
}

function PanelSwitch({
  modes,
  active,
  onChange,
}: {
  modes: Array<{ id: string; label: string }>
  active: string
  onChange: (value: string) => void
}) {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {modes.map(mode => (
        <button
          key={mode.id}
          onClick={() => onChange(mode.id)}
          style={{
            border: '1px solid var(--border)',
            background: active === mode.id ? 'rgba(0,196,206,0.12)' : 'var(--bg3)',
            color: active === mode.id ? 'var(--cyan)' : 'var(--t2)',
            borderRadius: 6,
            padding: '5px 10px',
            fontSize: 'var(--fs-sm)',
            fontFamily: 'var(--mono)',
            cursor: 'pointer',
          }}
        >
          {mode.label}
        </button>
      ))}
    </div>
  )
}

function RatingTable({
  rows,
  selectedMo,
  selectedIndicator,
  expanded,
  onSelectMo,
}: {
  rows: CurrentMoRecord[]
  selectedMo: string | null
  selectedIndicator: string
  expanded: boolean
  onSelectMo: (name: string | null) => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '44px minmax(0,1fr) 92px',
          gap: 10,
          padding: '0 10px 8px',
          color: 'var(--t3)',
          fontSize: 'var(--fs-xs)',
          fontFamily: 'var(--mono)',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
        }}
      >
        <span>№</span>
        <span>МО</span>
        <span style={{ textAlign: 'right' }}>{selectedIndicator}</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minHeight: 0, overflowY: 'auto', paddingRight: 2 }}>
        {(expanded ? rows : rows.slice(0, 6)).map((row, index) => {
          const isSelected = row.mo_name === selectedMo
          const value = getScreenIndicatorValue(row, selectedIndicator)

          return (
            <button
              key={row.mo_name}
              onClick={() => onSelectMo(isSelected ? null : row.mo_name)}
              style={{
                display: 'grid',
                gridTemplateColumns: '44px minmax(0,1fr) 92px',
                gap: 10,
                alignItems: 'center',
                textAlign: 'left',
                border: isSelected ? '1px solid rgba(0,196,206,0.4)' : '1px solid var(--border)',
                background: isSelected ? 'rgba(0,196,206,0.12)' : 'rgba(255,255,255,0.02)',
                borderRadius: 8,
                padding: '8px 10px',
                cursor: 'pointer',
                color: 'var(--t1)',
              }}
            >
              <span style={{ fontSize: 'var(--fs-sm)', fontFamily: 'var(--mono)', color: isSelected ? 'var(--cyan)' : 'var(--t2)' }}>{index + 1}</span>
              <span style={{ fontSize: 'var(--fs-sm)', color: isSelected ? 'var(--t1)' : 'var(--t2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {getShortMoName(row.mo_name)}
              </span>
              <span style={{ fontSize: 'var(--fs-md)', fontFamily: 'var(--mono)', color: 'var(--cyan)', textAlign: 'right' }}>
                {formatScreenValue(value, selectedIndicator)}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function ScreeningDynamicsView({
  selectedMo,
  historyRows,
  selectedIndicator,
  expanded,
}: {
  selectedMo: string | null
  historyRows: MoRecord[]
  selectedIndicator: string
  expanded: boolean
}) {
  if (!selectedMo) {
    return <EmptyCard text="Выберите МО на карте или в рейтинге, чтобы увидеть динамику." />
  }

  if (!historyRows.length) {
    return <EmptyCard text="Для выбранной МО нет данных динамики." />
  }

  const values = historyRows.map(row => getScreenIndicatorValue(row, selectedIndicator))
  const labels = historyRows.map(row => `Q${row.quarter} ${row.year}`)
  const currentValue = values[values.length - 1]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0, flex: 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
        <div>
          <div style={{ fontSize: 'var(--fs-md)', color: 'var(--t1)', fontWeight: 600 }}>{getShortMoName(selectedMo)}</div>
          <div style={{ fontSize: 'var(--fs-xs)', fontFamily: 'var(--mono)', color: 'var(--t3)', marginTop: 3 }}>{selectedIndicator}</div>
        </div>
        <div style={{ fontSize: 'var(--fs-xl)', fontFamily: 'var(--mono)', color: 'var(--cyan)' }}>{formatScreenValue(currentValue, selectedIndicator)}</div>
      </div>

      <div style={{ flexShrink: 0 }}>
        <LineChart
          series={[{ values, color: '#00c4ce', label: selectedIndicator }]}
          labels={labels}
          width={expanded ? 470 : 340}
          height={expanded ? 164 : 136}
          valueFormatter={value => formatScreenValue(value, selectedIndicator)}
        />
      </div>

      {expanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, overflowY: 'auto', paddingRight: 2 }}>
          {historyRows.map(row => (
            <div
              key={`${row.year}-${row.quarter}`}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 12,
                padding: '8px 10px',
                borderRadius: 8,
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid var(--border)',
              }}
            >
              <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--t2)' }}>{formatPeriodLabel(row.year, row.quarter)}</span>
              <span style={{ fontSize: 'var(--fs-md)', fontFamily: 'var(--mono)', color: 'var(--cyan)' }}>
                {formatScreenValue(getScreenIndicatorValue(row, selectedIndicator), selectedIndicator)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function EpiDynamicsView({
  rows,
  selectedDistrict,
  selectedIndicator,
  expanded,
}: {
  rows: EpiRecord[]
  selectedDistrict: DistrictOption | null
  selectedIndicator: EpiIndicatorDefinition
  expanded: boolean
}) {
  if (!rows.length) {
    return <EmptyCard text="Для выбранного периода нет истории эпидемиологии." />
  }

  const values = rows.map(row => getEpiValue(row, selectedIndicator.id))
  const labels = rows.map(row => `Q${row.quarter} ${row.year}`)
  const currentValue = values[values.length - 1]
  const targetName = selectedDistrict?.shortName ?? 'Область'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0, flex: 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
        <div>
          <div style={{ fontSize: 'var(--fs-md)', color: 'var(--t1)', fontWeight: 600 }}>{targetName}</div>
          <div style={{ fontSize: 'var(--fs-xs)', fontFamily: 'var(--mono)', color: 'var(--t3)', marginTop: 3 }}>
            {selectedIndicator.label} {selectedIndicator.unit ? `• ${selectedIndicator.unit}` : ''}
          </div>
        </div>
        <div style={{ fontSize: 'var(--fs-xl)', fontFamily: 'var(--mono)', color: selectedIndicator.color }}>
          {formatValue(currentValue, selectedIndicator.unit)}
        </div>
      </div>

      <div style={{ flexShrink: 0 }}>
        <LineChart
          series={[{ values, color: selectedIndicator.color, label: selectedIndicator.label }]}
          labels={labels}
          width={expanded ? 470 : 340}
          height={expanded ? 164 : 136}
          valueFormatter={value =>
            value.toLocaleString('ru-RU', {
              minimumFractionDigits: Math.abs(value % 1) > 0.001 ? 1 : 0,
              maximumFractionDigits: Math.abs(value % 1) > 0.001 ? 1 : 0,
            })
          }
        />
      </div>

      {expanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, overflowY: 'auto', paddingRight: 2 }}>
          {rows.map(row => (
            <div
              key={`${row.year}-${row.quarter}`}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 12,
                padding: '8px 10px',
                borderRadius: 8,
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid var(--border)',
              }}
            >
              <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--t2)' }}>{formatPeriodLabel(row.year, row.quarter)}</span>
              <span style={{ fontSize: 'var(--fs-md)', fontFamily: 'var(--mono)', color: selectedIndicator.color }}>
                {formatValue(getEpiValue(row, selectedIndicator.id), selectedIndicator.unit)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function TrendPanel({
  year,
  quarter,
  selectedDistrict,
  areaEpiRecord,
  districtEpiRecord,
  selectedEpiIndicator,
  epiIndicators,
  epiRows,
  epiHistory,
  districtOptions,
  currentMoData,
  screeningHistory,
  selectedMo,
  selectedIndicator,
  screenType,
  onSelectMo,
}: Props) {
  const [expanded, setExpanded] = useState({ epi: false, screenings: false })
  const [screenMode, setScreenMode] = useState<ScreeningPanelMode>('rating')
  const [epiMode, setEpiMode] = useState<EpiPanelMode>('summary')

  const summaryRecord = selectedDistrict ? districtEpiRecord : areaEpiRecord

  const rankedRows = useMemo(() => {
    return [...currentMoData].sort((left, right) => {
      const delta = getScreenIndicatorValue(right, selectedIndicator) - getScreenIndicatorValue(left, selectedIndicator)
      if (delta !== 0) {
        return delta
      }
      return left.mo_name.localeCompare(right.mo_name, 'ru')
    })
  }, [currentMoData, selectedIndicator])

  const historyRows = useMemo(() => {
    if (!selectedMo) {
      return []
    }

    return screeningHistory
      .filter(row => row.mo_name === selectedMo)
      .sort((left, right) => ((left.year ?? 0) * 10 + (left.quarter ?? 0)) - ((right.year ?? 0) * 10 + (right.quarter ?? 0)))
  }, [screeningHistory, selectedMo])

  const epiTableRows = useMemo(() => {
    const nameToDistrict = new Map(districtOptions.map(option => [normalizeDistrictName(option.epiName), option]))

    return [...epiRows]
      .sort((left, right) => left.district_name_ru.localeCompare(right.district_name_ru, 'ru'))
      .map(record => {
        const district = nameToDistrict.get(normalizeDistrictName(record.district_name_ru)) ?? null
        return {
          record,
          districtName: district?.shortName ?? record.district_name_ru,
          districtId: district?.id ?? null,
        }
      })
  }, [districtOptions, epiRows])

  const epiTrendRows = useMemo(() => {
    if (selectedDistrict) {
      return [...epiHistory]
        .filter(row => normalizeDistrictName(row.district_name_ru) === normalizeDistrictName(selectedDistrict.epiName))
        .sort((left, right) => ((left.year ?? 0) * 10 + (left.quarter ?? 0)) - ((right.year ?? 0) * 10 + (right.quarter ?? 0)))
    }

    const grouped = new Map<string, EpiRecord[]>()
    epiHistory.forEach(row => {
      const key = `${row.year}-${row.quarter}`
      const bucket = grouped.get(key) ?? []
      bucket.push(row)
      grouped.set(key, bucket)
    })

    return [...grouped.entries()]
      .map(([, rows]) => {
        const aggregated = averageEpiRecords(rows)
        if (!aggregated) {
          return null
        }
        return aggregated
      })
      .filter((row): row is EpiRecord => row !== null)
      .sort((left, right) => ((left.year ?? 0) * 10 + (left.quarter ?? 0)) - ((right.year ?? 0) * 10 + (right.quarter ?? 0)))
  }, [epiHistory, selectedDistrict])

  const dashboardHeight = expanded.epi || expanded.screenings ? 352 : 220
  const summaryTarget = selectedDistrict?.shortName ?? 'Область'

  return (
    <div
      style={{
        flexShrink: 0,
        display: 'flex',
        background: 'var(--bg1)',
        borderTop: '1px solid var(--border)',
        height: dashboardHeight,
        transition: 'height 0.2s ease',
      }}
    >
      <section
        style={{
          flex: 1,
          minWidth: 0,
          padding: '12px 14px 12px',
          borderRight: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
          <SectionTitle title="Эпид" subtitle={`${summaryTarget} • ${formatPeriodLabel(year, quarter)}`} />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <PanelSwitch
              modes={[
                { id: 'summary', label: 'Сводка' },
                { id: 'dynamics', label: 'Динамика' },
              ]}
              active={epiMode}
              onChange={value => setEpiMode(value as EpiPanelMode)}
            />
            <button
              onClick={() => setExpanded(prev => ({ ...prev, epi: !prev.epi }))}
              style={{
                border: '1px solid var(--border)',
                background: expanded.epi ? 'rgba(0,196,206,0.12)' : 'var(--bg3)',
                color: expanded.epi ? 'var(--cyan)' : 'var(--t2)',
                borderRadius: 6,
                padding: '5px 10px',
                fontSize: 'var(--fs-sm)',
                fontFamily: 'var(--mono)',
                cursor: 'pointer',
              }}
            >
              {expanded.epi ? 'Свернуть' : 'Развернуть'}
            </button>
          </div>
        </div>

        {epiMode === 'summary' ? (
          <>
            {summaryRecord ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 8 }}>
                {epiIndicators.map(indicator => (
                  <div
                    key={indicator.id}
                    style={{
                      borderRadius: 8,
                      border: '1px solid var(--border)',
                      background: 'rgba(255,255,255,0.02)',
                      padding: '10px 11px',
                    }}
                  >
                    <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--t3)', fontFamily: 'var(--mono)', marginBottom: 6 }}>{indicator.label}</div>
                    <div style={{ fontSize: 'var(--fs-md)', color: indicator.color, fontFamily: 'var(--mono)', fontWeight: 600 }}>
                      {formatValue(getEpiValue(summaryRecord, indicator.id), indicator.unit)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyCard text="Нет данных за выбранный период." />
            )}

            {expanded.epi &&
              (epiTableRows.length ? (
                <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(130px, 1.3fr) repeat(5, minmax(70px, 0.8fr))',
                      gap: 10,
                      padding: '0 10px 8px',
                      color: 'var(--t3)',
                      fontSize: 'var(--fs-xs)',
                      fontFamily: 'var(--mono)',
                      letterSpacing: '0.05em',
                      textTransform: 'uppercase',
                    }}
                  >
                    <span>Район</span>
                    {epiIndicators.map(indicator => (
                      <span key={indicator.id} style={{ textAlign: 'right' }}>
                        {indicator.label}
                      </span>
                    ))}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minHeight: 0, overflowY: 'auto', paddingRight: 2 }}>
                    {epiTableRows.map(item => {
                      const isSelected = Boolean(item.districtId && selectedDistrict && item.districtId === selectedDistrict.id)

                      return (
                        <div
                          key={`${item.record.district_name_ru}-${item.record.year}-${item.record.quarter}`}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'minmax(130px, 1.3fr) repeat(5, minmax(70px, 0.8fr))',
                            gap: 10,
                            padding: '8px 10px',
                            borderRadius: 8,
                            border: isSelected ? '1px solid rgba(0,196,206,0.4)' : '1px solid var(--border)',
                            background: isSelected ? 'rgba(0,196,206,0.12)' : 'rgba(255,255,255,0.02)',
                          }}
                        >
                          <span style={{ fontSize: 'var(--fs-sm)', color: isSelected ? 'var(--t1)' : 'var(--t2)' }}>{item.districtName}</span>
                          {epiIndicators.map(indicator => (
                            <span key={indicator.id} style={{ fontSize: 'var(--fs-sm)', textAlign: 'right', color: indicator.color, fontFamily: 'var(--mono)' }}>
                              {formatValue(getEpiValue(item.record, indicator.id), indicator.unit)}
                            </span>
                          ))}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <EmptyCard text="Таблица эпидпоказателей пока пуста." />
              ))}
          </>
        ) : (
          <EpiDynamicsView rows={epiTrendRows} selectedDistrict={selectedDistrict} selectedIndicator={selectedEpiIndicator} expanded={expanded.epi} />
        )}
      </section>

      <section
        style={{
          flex: 1,
          minWidth: 0,
          padding: '12px 14px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
          <SectionTitle title="Скрининги" subtitle={`${screenType} • ${selectedIndicator} • ${formatPeriodLabel(year, quarter)}`} />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <PanelSwitch
              modes={[
                { id: 'rating', label: 'Рейтинг' },
                { id: 'dynamics', label: 'Динамика' },
              ]}
              active={screenMode}
              onChange={value => setScreenMode(value as ScreeningPanelMode)}
            />
            <button
              onClick={() => setExpanded(prev => ({ ...prev, screenings: !prev.screenings }))}
              style={{
                border: '1px solid var(--border)',
                background: expanded.screenings ? 'rgba(0,196,206,0.12)' : 'var(--bg3)',
                color: expanded.screenings ? 'var(--cyan)' : 'var(--t2)',
                borderRadius: 6,
                padding: '5px 10px',
                fontSize: 'var(--fs-sm)',
                fontFamily: 'var(--mono)',
                cursor: 'pointer',
              }}
            >
              {expanded.screenings ? 'Свернуть' : 'Развернуть'}
            </button>
          </div>
        </div>

        {screenMode === 'rating' ? (
          rankedRows.length ? (
            <RatingTable
              rows={rankedRows}
              selectedMo={selectedMo}
              selectedIndicator={selectedIndicator}
              expanded={expanded.screenings}
              onSelectMo={onSelectMo}
            />
          ) : (
            <EmptyCard text="За выбранный период нет записей по скринингу." />
          )
        ) : (
          <ScreeningDynamicsView
            selectedMo={selectedMo}
            historyRows={historyRows}
            selectedIndicator={selectedIndicator}
            expanded={expanded.screenings}
          />
        )}
      </section>
    </div>
  )
}
