import { useEffect, useMemo, useRef } from 'react'
import L from 'leaflet'
import type {
  CurrentMoRecord,
  DistrictFeatureCollection,
  EpiIndicatorDefinition,
  FilterState,
  LayerState,
} from '../types'
import { getScreenIndicatorValue, getShortMoName } from '../utils/dashboard'

const DEFAULT_CENTER: L.LatLngExpression = [49.8, 80.5]
const DEFAULT_ZOOM = 7
const CHOROPLETH_STOPS = [0, 0.25, 0.5, 0.75, 1]
const CHOROPLETH_COLORS = ['rgba(232,80,80,0.68)', 'rgba(0,196,206,0.72)', 'rgba(0,168,158,0.78)', 'rgba(58,143,244,0.78)']
const GOLD_STROKE = '#d4af37'

function formatLegendNumber(value: number) {
  return value.toLocaleString('ru-RU', {
    minimumFractionDigits: Math.abs(value % 1) > 0.001 ? 1 : 0,
    maximumFractionDigits: Math.abs(value % 1) > 0.001 ? 1 : 0,
  })
}

function getChoroplethColor(value: number | null, min: number, max: number): string {
  if (value === null) {
    return 'rgba(16,35,58,0.75)'
  }

  const normalized = max === min ? 0.75 : (value - min) / (max - min)
  if (normalized > 0.75) return CHOROPLETH_COLORS[3]
  if (normalized > 0.5) return CHOROPLETH_COLORS[2]
  if (normalized > 0.25) return CHOROPLETH_COLORS[1]
  return CHOROPLETH_COLORS[0]
}

function getMarkerRadius(value: number, min: number, max: number): number {
  const normalized = max === min ? 0.5 : (value - min) / (max - min)
  return 6 + normalized * 8
}

function getChoroplethLegendItems(min: number, max: number) {
  if (max === min) {
    return [
      {
        color: CHOROPLETH_COLORS[2],
        label: `${formatLegendNumber(min)} — ${formatLegendNumber(max)}`,
      },
    ]
  }

  const thresholds = CHOROPLETH_STOPS.map(stop => min + (max - min) * stop)
  return CHOROPLETH_COLORS.map((color, index) => ({
    color,
    label: `${formatLegendNumber(thresholds[index])} — ${formatLegendNumber(thresholds[index + 1])}`,
  }))
}

function getMarkerLegendItems(values: number[], isPercent: boolean) {
  if (!values.length) {
    return []
  }

  const sorted = [...values].sort((left, right) => left - right)
  const min = sorted[0]
  const median = sorted[Math.floor((sorted.length - 1) / 2)]
  const max = sorted[sorted.length - 1]

  return [min, median, max].map((value, index) => ({
    key: `${index}-${value}`,
    radius: getMarkerRadius(value, min, max),
    label: isPercent ? `${formatLegendNumber(value)}%` : formatLegendNumber(value),
  }))
}

interface Props {
  geoData: DistrictFeatureCollection | null
  moData: CurrentMoRecord[]
  filters: FilterState
  layers: LayerState
  selectedMo: string | null
  selectedDistrictId: string | null
  selectedEpiIndicator: EpiIndicatorDefinition
  epiValueByDistrictId: Record<string, number | null>
  onSelectDistrict: (districtId: string | null) => void
  onSelectMo: (name: string | null) => void
}

export function MapView({
  geoData,
  moData,
  filters,
  layers,
  selectedMo,
  selectedDistrictId,
  selectedEpiIndicator,
  epiValueByDistrictId,
  onSelectDistrict,
  onSelectMo,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const geojsonLayerRef = useRef<L.GeoJSON | null>(null)
  const moLayerRef = useRef<L.LayerGroup | null>(null)
  const selectionLayerRef = useRef<L.LayerGroup | null>(null)
  const labelsLayerRef = useRef<L.LayerGroup | null>(null)

  const availableEpiValues = useMemo(() => {
    return Object.values(epiValueByDistrictId).filter((value): value is number => value !== null && value !== undefined && !Number.isNaN(value))
  }, [epiValueByDistrictId])
  const epiMin = availableEpiValues.length ? Math.min(...availableEpiValues) : 0
  const epiMax = availableEpiValues.length ? Math.max(...availableEpiValues) : 1

  const markerValues = useMemo(() => moData.map(row => getScreenIndicatorValue(row, filters.screenInd)), [filters.screenInd, moData])
  const markerMin = markerValues.length ? Math.min(...markerValues) : 0
  const markerMax = markerValues.length ? Math.max(...markerValues) : 1
  const markerLegendItems = useMemo(() => getMarkerLegendItems(markerValues, filters.screenInd === 'Охват'), [filters.screenInd, markerValues])
  const choroplethLegendItems = useMemo(
    () => (availableEpiValues.length ? getChoroplethLegendItems(epiMin, epiMax) : []),
    [availableEpiValues.length, epiMax, epiMin],
  )

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return
    }

    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: false,
      preferCanvas: true,
      minZoom: 6,
      maxZoom: 10,
    }).setView(DEFAULT_CENTER, DEFAULT_ZOOM)

    map.createPane('choroplethPane')
    map.getPane('choroplethPane')!.style.zIndex = '330'
    map.createPane('moPane')
    map.getPane('moPane')!.style.zIndex = '460'
    map.createPane('selectionPane')
    map.getPane('selectionPane')!.style.zIndex = '500'
    map.getPane('selectionPane')!.style.pointerEvents = 'none'
    map.createPane('labelsPane')
    map.getPane('labelsPane')!.style.zIndex = '520'
    map.getPane('labelsPane')!.style.pointerEvents = 'none'

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map)

    map.on('click', () => {
      onSelectDistrict(null)
      onSelectMo(null)
    })

    mapRef.current = map
    moLayerRef.current = L.layerGroup().addTo(map)
    selectionLayerRef.current = L.layerGroup().addTo(map)
    labelsLayerRef.current = L.layerGroup().addTo(map)

    return () => {
      map.remove()
      mapRef.current = null
      moLayerRef.current = null
      selectionLayerRef.current = null
      geojsonLayerRef.current = null
      labelsLayerRef.current = null
    }
  }, [onSelectDistrict, onSelectMo])

  useEffect(() => {
    if (!mapRef.current || !geoData) {
      return
    }

    if (geojsonLayerRef.current) {
      geojsonLayerRef.current.remove()
    }
    labelsLayerRef.current?.clearLayers()

    const layer = L.geoJSON(geoData as GeoJSON.FeatureCollection, {
      pane: 'choroplethPane',
      style: feature => {
        const districtId = feature?.properties?.district_id
        const value = districtId ? epiValueByDistrictId[districtId] ?? null : null
        const isSelected = districtId === selectedDistrictId

        return {
          fillColor: getChoroplethColor(value, epiMin, epiMax),
          fillOpacity: layers.choropleth ? (isSelected ? 0.84 : 0.64) : 0.06,
          color: isSelected ? 'rgba(255,255,255,0.88)' : 'rgba(255,255,255,0.18)',
          weight: layers.borders ? (isSelected ? 2.3 : 1.1) : 0.3,
          opacity: layers.borders ? 1 : 0.28,
        }
      },
      onEachFeature: (feature, layerItem) => {
        const districtId = feature.properties?.district_id ?? null
        const districtName = feature.properties?.name_ru ?? 'Район'

        layerItem.on({
          mouseover: () => layerItem.setStyle({ fillOpacity: layers.choropleth ? 0.82 : 0.12, color: 'rgba(0,196,206,0.55)', weight: layers.borders ? 2 : 1 }),
          mouseout: () => layer.resetStyle(layerItem),
          click: () => onSelectDistrict(districtId === selectedDistrictId ? null : districtId),
        })

        if (layers.labels) {
          const center = layerItem.getBounds().getCenter()
          const label = L.marker(center, {
            pane: 'labelsPane',
            interactive: false,
            icon: L.divIcon({
              className: 'district-label',
              html: `<div style="font-family:'IBM Plex Sans',sans-serif;font-size:11px;line-height:1.2;color:#a7bed3;text-align:center;text-shadow:0 1px 0 rgba(0,0,0,0.4);">${districtName}</div>`,
            }),
          })
          label.addTo(labelsLayerRef.current!)
        }
      },
    }).addTo(mapRef.current)

    geojsonLayerRef.current = layer
  }, [epiMax, epiMin, epiValueByDistrictId, geoData, layers.borders, layers.choropleth, layers.labels, onSelectDistrict, selectedDistrictId])

  useEffect(() => {
    const layer = moLayerRef.current
    const selectionLayer = selectionLayerRef.current
    if (!layer || !selectionLayer) {
      return
    }

    layer.clearLayers()
    selectionLayer.clearLayers()
    if (!layers.mo) {
      return
    }

    moData
      .filter(row => row.lat !== null && row.lon !== null)
      .forEach(row => {
        const value = getScreenIndicatorValue(row, filters.screenInd)
        const isSelected = row.mo_name === selectedMo
        const radius = getMarkerRadius(value, markerMin, markerMax)
        const marker = L.circleMarker([row.lat!, row.lon!], {
          pane: 'moPane',
          radius,
          fillColor: 'rgba(0,196,206,0.82)',
          color: GOLD_STROKE,
          weight: 1.1,
          fillOpacity: isSelected ? 1 : 0.86,
        })

        marker.bindTooltip(
          `
            <div style="font-family:'IBM Plex Sans',sans-serif;font-size:12px;color:#cddae8;background:#0c1d30;border:1px solid rgba(0,196,206,0.22);border-radius:6px;padding:8px 10px;min-width:160px;">
              <div style="font-weight:600;margin-bottom:4px;color:#00c4ce;">${getShortMoName(row.mo_name)}</div>
              <div>${filters.screenInd}: <b>${filters.screenInd === 'Охват' ? `${formatLegendNumber(value)}%` : formatLegendNumber(value)}</b></div>
              <div>Охват: <b>${formatLegendNumber(row.coverage_pct)}%</b></div>
              <div>Предраки: <b>${row.precancers}</b></div>
              <div>ЗНО: <b>${row.zno}</b></div>
            </div>
          `,
          { className: 'onco-tooltip', sticky: false, opacity: 1 },
        )

        marker.on('click', event => {
          if (event.originalEvent) {
            L.DomEvent.stopPropagation(event.originalEvent)
          }
          onSelectMo(row.mo_name === selectedMo ? null : row.mo_name)
        })

        marker.addTo(layer)

        if (isSelected) {
          L.circleMarker([row.lat!, row.lon!], {
            pane: 'selectionPane',
            radius: radius + 4.5,
            fill: false,
            color: '#f7fbff',
            weight: 2.1,
            opacity: 0.95,
            interactive: false,
          }).addTo(selectionLayer)
        }
      })
  }, [filters.screenInd, layers.mo, markerMax, markerMin, moData, onSelectMo, selectedMo])

  return (
    <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      <div
        style={{
          position: 'absolute',
          top: 12,
          left: 12,
          zIndex: 20,
          background: 'rgba(8,21,37,0.9)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 8,
          padding: '10px 12px',
          minWidth: 212,
          pointerEvents: 'none',
        }}
      >
        <div style={{ color: '#cddae8', fontSize: 'var(--fs-sm)', marginBottom: 8, fontWeight: 600 }}>{selectedEpiIndicator.label}</div>
        {choroplethLegendItems.length ? (
          <>
            {choroplethLegendItems.map(item => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, fontSize: 'var(--fs-sm)', color: '#8aa5bd' }}>
                <span style={{ width: 12, height: 12, borderRadius: 3, background: item.color, display: 'inline-block' }} />
                <span>{item.label}</span>
              </div>
            ))}
            <div style={{ marginTop: 6, fontSize: 'var(--fs-xs)', color: '#5d7a94', fontFamily: 'var(--mono)' }}>{selectedEpiIndicator.unit}</div>
          </>
        ) : (
          <div style={{ fontSize: 'var(--fs-sm)', color: '#8aa5bd' }}>Нет данных за выбранный период</div>
        )}
      </div>

      <div
        style={{
          position: 'absolute',
          top: 12,
          right: 12,
          zIndex: 20,
          background: 'rgba(8,21,37,0.9)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 8,
          padding: '10px 12px',
          minWidth: 228,
          pointerEvents: 'none',
        }}
      >
        <div style={{ color: '#cddae8', fontSize: 'var(--fs-sm)', marginBottom: 8, fontWeight: 600 }}>МО • {filters.screenInd}</div>
        {markerLegendItems.length ? (
          <>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, marginBottom: 8 }}>
              {markerLegendItems.map(item => (
                <div key={item.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                  <span
                    style={{
                      width: item.radius * 2,
                      height: item.radius * 2,
                      borderRadius: '50%',
                      background: 'rgba(0,196,206,0.78)',
                      border: `1px solid ${GOLD_STROKE}`,
                      display: 'inline-block',
                    }}
                  />
                  <span style={{ fontSize: 'var(--fs-xs)', color: '#8aa5bd', fontFamily: 'var(--mono)' }}>{item.label}</span>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 'var(--fs-sm)', color: '#8aa5bd' }}>Размер круга и значение синхронизированы с выбранным показателем.</div>
            <div style={{ fontSize: 'var(--fs-xs)', color: '#5d7a94', fontFamily: 'var(--mono)', marginTop: 6 }}>
              Золотой контур — МО на карте, внешнее светлое кольцо — выбранная МО
            </div>
          </>
        ) : (
          <div style={{ fontSize: 'var(--fs-sm)', color: '#8aa5bd' }}>Нет данных для легенды МО</div>
        )}
      </div>

      <div
        style={{
          position: 'absolute',
          right: 12,
          bottom: 12,
          zIndex: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        {[
          { label: '+', onClick: () => mapRef.current?.zoomIn() },
          { label: '−', onClick: () => mapRef.current?.zoomOut() },
          { label: '⌂', onClick: () => mapRef.current?.setView(DEFAULT_CENTER, DEFAULT_ZOOM) },
        ].map(button => (
          <button
            key={button.label}
            onClick={button.onClick}
            style={{
              width: 34,
              height: 34,
              borderRadius: 6,
              border: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(8,21,37,0.92)',
              color: '#8aa5bd',
              fontSize: button.label === '⌂' ? 'var(--fs-sm)' : '18px',
              cursor: 'pointer',
            }}
          >
            {button.label}
          </button>
        ))}
      </div>

      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background: 'radial-gradient(ellipse at center, transparent 60%, rgba(5,16,29,0.58) 100%)',
          zIndex: 10,
        }}
      />
    </div>
  )
}
