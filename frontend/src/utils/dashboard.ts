import type {
  CurrentMoRecord,
  DistrictFeatureCollection,
  DistrictOption,
  EpiIndicatorDefinition,
  EpiIndicatorId,
  EpiRecord,
  MetaData,
  MoRecord,
  ScreenType,
} from '../types'
import { pointInGeometry } from './geo'

export const SCREEN_TYPES: ScreenType[] = ['РМЖ', 'КРР', 'РШМ']

export const SCREEN_INDICATORS: Record<ScreenType, string[]> = {
  РМЖ: ['Охват', 'Предраки', 'ЗНО', 'Биопсия', 'Отказы'],
  КРР: ['Охват', 'Гемокульт+', 'Колоноскопия', 'Предраки', 'Биопсия', 'ЗНО'],
  РШМ: ['Охват', 'Предраки', 'ЗНО', 'Отказы'],
}

export const FALLBACK_EPI_INDICATORS: EpiIndicatorDefinition[] = [
  { id: 'incidence_rate', label: 'Заболеваемость', unit: 'на 100 тыс.', color: '#00c4ce', polarity: 'negative' },
  { id: 'mortality_rate', label: 'Смертность', unit: 'на 100 тыс.', color: '#27c97a', polarity: 'negative' },
  { id: 'early_stage_percent', label: 'Ранняя диагностика', unit: '%', color: '#00a89e', polarity: 'positive' },
  { id: 'advanced_stage_percent', label: 'Запущенность', unit: '%', color: '#e85050', polarity: 'negative' },
  { id: 'five_year_survival_percent', label: '5-лет. выживаемость', unit: '%', color: '#e8a020', polarity: 'positive' },
]

export const FALLBACK_META: MetaData = { years: [], quarters: [1, 2, 3, 4] }

function stripDistrictSuffix(value: string): string {
  return value.replace(/\s+район$/i, '').trim()
}

export function normalizeDistrictName(value: string): string {
  return stripDistrictSuffix(value)
    .toLowerCase()
    .replace(/[.\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function buildDistrictOptions(geoData: DistrictFeatureCollection | null): DistrictOption[] {
  if (!geoData) {
    return []
  }

  return geoData.features.map(feature => {
    const mapName = feature.properties.name_ru
    const shortName = stripDistrictSuffix(mapName)
    return {
      id: feature.properties.district_id,
      mapName,
      shortName,
      epiName: shortName,
    }
  })
}

export function getLatestPeriod(meta: MetaData): { year: number | null; quarter: number | null } {
  const year = meta.years.length ? meta.years[meta.years.length - 1] : null
  const quarter = meta.quarters.length ? meta.quarters[meta.quarters.length - 1] : null
  return { year, quarter }
}

export function getScreenIndicatorValue(mo: MoRecord | CurrentMoRecord, indicator: string): number {
  switch (indicator) {
    case 'Охват':
      return mo.coverage_pct
    case 'Предраки':
      return mo.precancers
    case 'ЗНО':
      return mo.zno
    case 'Биопсия':
      return mo.biopsy
    case 'Отказы':
      return mo.refusals
    case 'Гемокульт+':
      return mo.pos
    case 'Колоноскопия':
      return mo.colonoscopy
    default:
      return mo.coverage_pct
  }
}

export function getEpiValue(record: EpiRecord, indicator: EpiIndicatorId): number | null {
  return record[indicator]
}

export function formatValue(value: number | null, unit = ''): string {
  if (value === null || Number.isNaN(value)) {
    return '—'
  }

  if (unit === '%') {
    return `${value.toLocaleString('ru-RU', { maximumFractionDigits: 1 })}%`
  }

  return unit
    ? `${value.toLocaleString('ru-RU', { maximumFractionDigits: 1 })} ${unit}`
    : value.toLocaleString('ru-RU')
}

export function formatPeriodLabel(year: number | null, quarter: number | null): string {
  if (!year || !quarter) {
    return 'Нет периода'
  }

  return `${year} / Q${quarter}`
}

export function getShortMoName(value: string): string {
  const match = value.match(/"(.+?)"/)
  return match?.[1]?.trim() || value
}

export function getMoContextStats(screen: ScreenType, mo: MoRecord | CurrentMoRecord) {
  const shared = [
    { label: 'Завершено осмотров', value: mo.completed },
    { label: 'Охват', value: `${mo.coverage_pct}%`, tone: 'var(--cyan)' },
    { label: 'Предраки', value: mo.precancers, tone: 'var(--amber)' },
    { label: 'ЗНО', value: mo.zno, tone: mo.zno > 0 ? 'var(--err)' : 'var(--t1)' },
  ]

  if (screen === 'РМЖ') {
    return [
      ...shared,
      { label: 'Биопсия', value: mo.biopsy },
      { label: 'Отказы', value: mo.refusals },
      { label: 'Истечение срока', value: mo.expired },
    ]
  }

  if (screen === 'КРР') {
    return [
      { label: 'Завершено осмотров', value: mo.completed },
      { label: 'Охват', value: `${mo.coverage_pct}%`, tone: 'var(--cyan)' },
      { label: 'Гемокульт+', value: mo.pos, tone: 'var(--amber)' },
      { label: 'Колоноскопия', value: mo.colonoscopy },
      { label: 'Предраки', value: mo.precancers, tone: 'var(--amber)' },
      { label: 'Биопсия', value: mo.biopsy },
      { label: 'ЗНО', value: mo.zno, tone: mo.zno > 0 ? 'var(--err)' : 'var(--t1)' },
      { label: 'Отказы', value: mo.refusals },
      { label: 'Истечение срока', value: mo.expired },
    ]
  }

  return [
    ...shared,
    { label: 'Отказы', value: mo.refusals },
    { label: 'Истечение срока', value: mo.expired },
  ]
}

export function getDistrictIdByPoint(
  lon: number,
  lat: number,
  geoData: DistrictFeatureCollection | null,
): string | null {
  if (!geoData) {
    return null
  }

  const point: [number, number] = [lon, lat]
  const feature = geoData.features.find(item => pointInGeometry(point, item.geometry))
  return feature?.properties.district_id ?? null
}

export function buildMoDistrictMap(
  moData: MoRecord[],
  geoData: DistrictFeatureCollection | null,
): Record<string, string | null> {
  const mapping: Record<string, string | null> = {}

  for (const row of moData) {
    if (mapping[row.mo_name] !== undefined) {
      continue
    }

    if (row.lat === null || row.lon === null) {
      mapping[row.mo_name] = null
      continue
    }

    mapping[row.mo_name] = getDistrictIdByPoint(row.lon, row.lat, geoData)
  }

  return mapping
}

export function averageEpiRecords(rows: EpiRecord[]): EpiRecord | null {
  if (!rows.length) {
    return null
  }

  const indicators: EpiIndicatorId[] = [
    'incidence_rate',
    'mortality_rate',
    'early_stage_percent',
    'advanced_stage_percent',
    'five_year_survival_percent',
  ]

  const result: EpiRecord = {
    district_name_ru: 'Область',
    year: rows[0].year,
    quarter: rows[0].quarter,
    incidence_rate: null,
    mortality_rate: null,
    early_stage_percent: null,
    advanced_stage_percent: null,
    five_year_survival_percent: null,
  }

  for (const indicator of indicators) {
    const values = rows
      .map(row => row[indicator])
      .filter((value): value is number => value !== null && !Number.isNaN(value))

    result[indicator] = values.length
      ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10
      : null
  }

  return result
}
