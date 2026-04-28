export interface DistrictGeoProperties {
  district_id: string
  name_en: string
  name_ru: string
}

export type DistrictFeatureCollection = GeoJSON.FeatureCollection<GeoJSON.Geometry, DistrictGeoProperties>

export interface DistrictOption {
  id: string
  mapName: string
  shortName: string
  epiName: string
}

export interface MoRecord {
  mo_name: string
  lat: number | null
  lon: number | null
  year: number | null
  quarter: number | null
  completed: number
  coverage: number
  coverage_pct: number
  precancers: number
  zno: number
  refusals: number
  expired: number
  biopsy: number
  neg: number
  pos: number
  colonoscopy: number
}

export interface CurrentMoRecord extends MoRecord {
  districtId: string | null
}

export type ScreenType = 'РМЖ' | 'КРР' | 'РШМ'

export type EpiIndicatorId =
  | 'incidence_rate'
  | 'mortality_rate'
  | 'early_stage_percent'
  | 'advanced_stage_percent'
  | 'five_year_survival_percent'

export interface EpiIndicatorDefinition {
  id: EpiIndicatorId
  label: string
  unit: string
  color: string
  polarity: 'positive' | 'negative'
}

export interface EpiRecord {
  district_name_ru: string
  year: number | null
  quarter: number | null
  incidence_rate: number | null
  mortality_rate: number | null
  early_stage_percent: number | null
  advanced_stage_percent: number | null
  five_year_survival_percent: number | null
}

export interface EpiPayload {
  indicators: EpiIndicatorDefinition[]
  data: EpiRecord[]
}

export interface MetaData {
  years: number[]
  quarters: number[]
}

export interface FilterState {
  year: number | null
  quarter: number | null
  epi: EpiIndicatorId
  screen: ScreenType
  screenInd: string
  districtId: string | null
}

export interface LayerState {
  choropleth: boolean
  mo: boolean
  borders: boolean
  labels: boolean
}

export interface KpiItem {
  label: string
  val: string
  unit: string
  delta: string
  deltaUp: boolean
  color: string
  spark: number[]
}
