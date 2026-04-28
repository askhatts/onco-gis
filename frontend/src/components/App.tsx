import { useEffect, useMemo, useState } from 'react'
import { TopBar } from './TopBar'
import { AdminPanel } from './AdminPanel'
import { LeftPanel } from './LeftPanel'
import { MapView } from './MapView'
import { KPICards } from './KPICards'
import { ContextPanel } from './ContextPanel'
import { TrendPanel } from './TrendPanel'
import { useDistrictGeoData } from '../hooks/useDistrictGeoData'
import { useEpidemiology } from '../hooks/useEpidemiology'
import { useMeta } from '../hooks/useMeta'
import { useScreeningData } from '../hooks/useScreeningData'
import type { CurrentMoRecord, FilterState, LayerState } from '../types'
import {
  averageEpiRecords,
  buildDistrictOptions,
  buildMoDistrictMap,
  getLatestPeriod,
  normalizeDistrictName,
  SCREEN_INDICATORS,
} from '../utils/dashboard'

const DEFAULT_FILTERS: FilterState = {
  year: null,
  quarter: null,
  epi: 'incidence_rate',
  screen: 'РМЖ',
  screenInd: SCREEN_INDICATORS['РМЖ'][0],
  districtId: null,
}

const DEFAULT_LAYERS: LayerState = {
  choropleth: true,
  mo: true,
  borders: true,
  labels: true,
}

export function App() {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS)
  const [layers, setLayers] = useState<LayerState>(DEFAULT_LAYERS)
  const [selectedMo, setSelectedMo] = useState<string | null>(null)
  const [adminOpen, setAdminOpen] = useState(false)
  const [dataVersion, setDataVersion] = useState(0)

  const { meta } = useMeta(dataVersion)
  const { payload: epiPayload } = useEpidemiology(dataVersion)
  const { geoData } = useDistrictGeoData()
  const { data: screeningData, loading: screeningLoading } = useScreeningData(filters.screen, dataVersion)

  const districtOptions = useMemo(() => buildDistrictOptions(geoData), [geoData])
  const districtById = useMemo(() => new Map(districtOptions.map(option => [option.id, option])), [districtOptions])
  const latestPeriod = useMemo(() => getLatestPeriod(meta), [meta])

  useEffect(() => {
    setFilters(prev => {
      const nextYear = prev.year !== null && meta.years.includes(prev.year) ? prev.year : latestPeriod.year
      const nextQuarter = prev.quarter !== null && meta.quarters.includes(prev.quarter) ? prev.quarter : latestPeriod.quarter

      if (prev.year === nextYear && prev.quarter === nextQuarter) {
        return prev
      }

      return {
        ...prev,
        year: nextYear,
        quarter: nextQuarter,
      }
    })
  }, [latestPeriod.quarter, latestPeriod.year, meta.quarters, meta.years])

  useEffect(() => {
    if (!filters.districtId || districtById.has(filters.districtId)) {
      return
    }

    setFilters(prev => ({ ...prev, districtId: null }))
  }, [districtById, filters.districtId])

  const moDistrictMap = useMemo(() => buildMoDistrictMap(screeningData, geoData), [geoData, screeningData])

  const currentMoData = useMemo<CurrentMoRecord[]>(() => {
    if (filters.year === null || filters.quarter === null) {
      return []
    }

    return screeningData
      .filter(row => row.year === filters.year && row.quarter === filters.quarter)
      .map(row => ({
        ...row,
        districtId: moDistrictMap[row.mo_name] ?? null,
      }))
  }, [filters.quarter, filters.year, moDistrictMap, screeningData])

  useEffect(() => {
    if (!selectedMo || screeningLoading) {
      return
    }

    if (!currentMoData.some(row => row.mo_name === selectedMo)) {
      setSelectedMo(null)
    }
  }, [currentMoData, screeningLoading, selectedMo])

  const selectedDistrict = filters.districtId ? districtById.get(filters.districtId) ?? null : null
  const selectedMoRecord = selectedMo ? currentMoData.find(row => row.mo_name === selectedMo) ?? null : null

  const periodEpiRows = useMemo(() => {
    if (filters.year === null || filters.quarter === null) {
      return []
    }

    return epiPayload.data.filter(row => row.year === filters.year && row.quarter === filters.quarter)
  }, [epiPayload.data, filters.quarter, filters.year])

  const epiByDistrictKey = useMemo(() => {
    return new Map(periodEpiRows.map(row => [normalizeDistrictName(row.district_name_ru), row]))
  }, [periodEpiRows])

  const districtEpiRecord = selectedDistrict ? epiByDistrictKey.get(normalizeDistrictName(selectedDistrict.epiName)) ?? null : null
  const areaEpiRecord = useMemo(() => averageEpiRecords(periodEpiRows), [periodEpiRows])
  const selectedEpiIndicator = epiPayload.indicators.find(item => item.id === filters.epi) ?? epiPayload.indicators[0]

  const epiValueByDistrictId = useMemo(() => {
    const values: Record<string, number | null> = {}

    for (const district of districtOptions) {
      const record = epiByDistrictKey.get(normalizeDistrictName(district.epiName)) ?? null
      values[district.id] = record ? record[filters.epi] : null
    }

    return values
  }, [districtOptions, epiByDistrictKey, filters.epi])

  function handleFilter(partial: Partial<FilterState>) {
    if (Object.prototype.hasOwnProperty.call(partial, 'districtId')) {
      setSelectedMo(null)
    }

    setFilters(prev => ({ ...prev, ...partial }))
  }

  function handleLayer(partial: Partial<LayerState>) {
    setLayers(prev => ({ ...prev, ...partial }))
  }

  function handleSelectDistrict(districtId: string | null) {
    setSelectedMo(null)
    setFilters(prev => ({ ...prev, districtId }))
  }

  function handleSelectMo(name: string | null) {
    if (!name) {
      setSelectedMo(null)
      return
    }

    const moRecord = currentMoData.find(row => row.mo_name === name)
    setSelectedMo(name)
    if (moRecord) {
      setFilters(prev => ({ ...prev, districtId: moRecord.districtId }))
    }
  }

  function handleDataRefresh() {
    setDataVersion(prev => prev + 1)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <TopBar year={filters.year} quarter={filters.quarter} onAdminClick={() => setAdminOpen(true)} />
      <KPICards />
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        <LeftPanel
          filters={filters}
          layers={layers}
          years={meta.years}
          quarters={meta.quarters}
          districts={districtOptions}
          epiIndicators={epiPayload.indicators}
          onFilter={handleFilter}
          onLayer={handleLayer}
        />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <MapView
            geoData={geoData}
            moData={currentMoData}
            filters={filters}
            layers={layers}
            selectedMo={selectedMo}
            selectedDistrictId={filters.districtId}
            selectedEpiIndicator={selectedEpiIndicator}
            epiValueByDistrictId={epiValueByDistrictId}
            onSelectDistrict={handleSelectDistrict}
            onSelectMo={handleSelectMo}
          />
          <TrendPanel
            year={filters.year}
            quarter={filters.quarter}
            selectedDistrict={selectedDistrict}
            areaEpiRecord={areaEpiRecord}
            districtEpiRecord={districtEpiRecord}
            epiIndicators={epiPayload.indicators}
            epiRows={periodEpiRows}
            epiHistory={epiPayload.data}
            districtOptions={districtOptions}
            currentMoData={currentMoData}
            screeningHistory={screeningData}
            selectedMo={selectedMo}
            selectedIndicator={filters.screenInd}
            screenType={filters.screen}
            selectedEpiIndicator={selectedEpiIndicator}
            onSelectMo={handleSelectMo}
          />
        </div>
        <ContextPanel
          selectedDistrict={selectedDistrict}
          selectedMoRecord={selectedMoRecord}
          screenType={filters.screen}
          districtEpiRecord={districtEpiRecord}
          epiIndicators={epiPayload.indicators}
          year={filters.year}
          quarter={filters.quarter}
        />
      </div>
      <AdminPanel open={adminOpen} onClose={() => setAdminOpen(false)} onRefresh={handleDataRefresh} />
    </div>
  )
}
