const { useEffect, useMemo, useRef, useState } = React

const SCREEN_TYPES = ['РМЖ', 'КРР', 'РШМ']
const SCREEN_INDICATORS = {
  РМЖ: ['Охват', 'Предраки', 'ЗНО', 'Биопсия', 'Отказы'],
  КРР: ['Охват', 'Гемокульт+', 'Колоноскопия', 'Предраки', 'Биопсия', 'ЗНО'],
  РШМ: ['Охват', 'Предраки', 'ЗНО', 'Отказы'],
}

const FALLBACK_EPI_INDICATORS = [
  { id: 'incidence_rate',     label: 'Заболеваемость',            unit: 'на 100 тыс.', color: '#00c4ce', polarity: 'negative' },
  { id: 'mortality_rate',     label: 'Смертность',                unit: 'на 100 тыс.', color: '#e85050', polarity: 'negative' },
  { id: 'mortality_ratio',    label: 'Смертность/заболеваемость', unit: '%',            color: '#e8a020', polarity: 'negative' },
  { id: 'early_stage_pct',    label: 'Ранняя диагностика',        unit: '%',            color: '#27c97a', polarity: 'positive' },
  { id: 'early_stage_count',  label: 'Впервые 0–I ст.',           unit: 'чел.',         color: '#00a89e', polarity: 'positive' },
  { id: 'advanced_stage_pct', label: 'Запущенность',              unit: '%',            color: '#e85050', polarity: 'negative' },
  { id: 'survival_5yr_pct',   label: '5-лет. выживаемость',       unit: '%',            color: '#3a8ff4', polarity: 'positive' },
]

function normalizeDistrictName(value) {
  return String(value || '')
    .replace(/\s+район$/i, '')
    .replace(/^г\.?\s+/i, '')
    .toLowerCase()
    .replace(/[.\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function buildDistrictOptions(geoData) {
  if (!geoData) return []
  return geoData.features.map(feature => {
    const mapName = feature.properties.name_ru
    const shortName = mapName.replace(/\s+район$/i, '').trim()
    return {
      id: feature.properties.district_id,
      mapName,
      shortName,
      epiName: shortName,
    }
  })
}

function getLatestPeriod(meta) {
  const year = meta.years.length ? meta.years[meta.years.length - 1] : null
  const quarter = meta.quarters.length ? meta.quarters[meta.quarters.length - 1] : null
  return { year, quarter }
}


function getScreenIndicatorValue(mo, indicator) {
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

function getEpiValue(record, indicator) {
  return record ? record[indicator] : null
}

function formatValue(value, unit = '') {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  if (unit === '%') return `${value.toLocaleString('ru-RU', { maximumFractionDigits: 1 })}%`
  return unit ? `${value.toLocaleString('ru-RU', { maximumFractionDigits: 1 })} ${unit}` : value.toLocaleString('ru-RU')
}

function formatPeriodLabel(year, quarter) {
  if (!year || !quarter) return 'Нет периода'
  return `${year} / Q${quarter}`
}

function getMoContextStats(screen, mo) {
  const shared = [
    { label: 'Завершено осмотров', value: mo.completed },
    { label: 'Охват', value: `${mo.coverage_pct}%`, tone: 'var(--cyan)' },
    { label: 'Предраки', value: mo.precancers, tone: 'var(--amber)' },
    { label: 'ЗНО', value: mo.zno, tone: mo.zno > 0 ? 'var(--err)' : 'var(--t1)' },
  ]

  if (screen === 'РМЖ') {
    return [...shared, { label: 'Биопсия', value: mo.biopsy }, { label: 'Отказы', value: mo.refusals }, { label: 'Истечение срока', value: mo.expired }]
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
  return [...shared, { label: 'Отказы', value: mo.refusals }, { label: 'Истечение срока', value: mo.expired }]
}

function averageEpiRecords(rows, indicators = FALLBACK_EPI_INDICATORS) {
  if (!rows.length) return null
  const result = { district_name_ru: 'Область', year: rows[0].year, quarter: rows[0].quarter || null }
  indicators.forEach(ind => {
    const values = rows.map(row => row[ind.id]).filter(v => v !== null && v !== undefined && !Number.isNaN(v))
    result[ind.id] = values.length ? Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 10) / 10 : null
  })
  return result
}

function pointInRing(point, ring) {
  const [x, y] = point
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    const intersects = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / ((yj - yi) || 1e-9) + xi
    if (intersects) inside = !inside
  }
  return inside
}

function pointInPolygon(point, polygon) {
  if (!polygon.length || !pointInRing(point, polygon[0])) return false
  for (let i = 1; i < polygon.length; i += 1) {
    if (pointInRing(point, polygon[i])) return false
  }
  return true
}

function pointInGeometry(point, geometry) {
  if (geometry.type === 'Polygon') return pointInPolygon(point, geometry.coordinates)
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.some(polygon => pointInPolygon(point, polygon))
  return false
}

function getDistrictIdByPoint(lon, lat, geoData) {
  if (!geoData) return null
  const feature = geoData.features.find(item => pointInGeometry([lon, lat], item.geometry))
  return feature ? feature.properties.district_id : null
}

function buildMoDistrictMap(moData, geoData) {
  const mapping = {}
  moData.forEach(row => {
    if (mapping[row.mo_name] !== undefined) return
    if (row.lat === null || row.lon === null) {
      mapping[row.mo_name] = null
      return
    }
    mapping[row.mo_name] = getDistrictIdByPoint(row.lon, row.lat, geoData)
  })
  return mapping
}

function useFetchJson(path, fallback) {
  const [data, setData] = useState(fallback)
  useEffect(() => {
    let alive = true
    fetch(path)
      .then(response => response.json())
      .then(value => {
        if (alive) setData(value)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [path])
  return data
}

function useMeta(version = 0) {
  return useFetchJson(`/meta.json?v=${version}`, { years: [], quarters: [1, 2, 3, 4] })
}

function useEpidemiology(version = 0) {
  const payload = useFetchJson(`/epidemiology.json?v=${version}`, { indicators: FALLBACK_EPI_INDICATORS, data: [] })
  return {
    indicators: payload.indicators && payload.indicators.length ? payload.indicators : FALLBACK_EPI_INDICATORS,
    data: payload.data || [],
  }
}

function useDistrictGeoData() {
  return useFetchJson('/abay_districts.geojson', null)
}

const screeningCache = {}
function useScreeningData(type, version = 0) {
  const cacheKey = `${type}:${version}`
  const [data, setData] = useState(screeningCache[cacheKey] || [])
  useEffect(() => {
    let alive = true
    if (screeningCache[cacheKey]) {
      setData(screeningCache[cacheKey])
      return () => {
        alive = false
      }
    }
    const fileMap = {
      РМЖ: '/screening_rmzh.json',
      КРР: '/screening_krr.json',
      РШМ: '/screening_rshm.json',
    }
    fetch(`${fileMap[type]}?v=${version}`)
      .then(response => response.json())
      .then(rows => {
        screeningCache[cacheKey] = rows
        if (alive) setData(rows)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [cacheKey, type, version])
  return data
}

function Badge({ children, color = 'var(--t3)' }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 7px',
        borderRadius: 3,
        background: 'rgba(255,255,255,0.04)',
        border: `1px solid ${color}`,
        fontSize: 'var(--fs-sm)',
        color: 'var(--t2)',
        fontFamily: 'var(--mono)',
      }}
    >
      {children}
    </span>
  )
}

function Sep({ label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '10px 0 6px' }}>
      {label && (
        <span style={{ fontSize: 'var(--fs-xs)', fontFamily: 'var(--mono)', color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>
          {label}
        </span>
      )}
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
    </div>
  )
}

function Spark({ values, color, width = 64, height = 22 }) {
  if (!values || values.length < 2) return null
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const step = width / (values.length - 1)
  const points = values.map((value, index) => {
    const x = index * step
    const y = height - ((value - min) / range) * (height - 2) - 1
    return `${x},${y}`
  })
  const area = `M${points[0]} L${points.join(' L')} L${width},${height} L0,${height} Z`
  const line = `M${points[0]} L${points.join(' L')}`
  const gradientId = `sg-${color.replace('#', '')}`
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} fill="none">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} />
      <path d={line} stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

function formatAxisNumber(value) {
  const hasFraction = Math.abs(value % 1) > 0.001
  return value.toLocaleString('ru-RU', {
    minimumFractionDigits: hasFraction ? 1 : 0,
    maximumFractionDigits: hasFraction ? 1 : 0,
  })
}

function LineChart({ series, labels = [], width = 400, height = 80, yTickCount = 5, valueFormatter }) {
  const allValues = series.flatMap(item => item.values)
  if (!allValues.length) return <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} />
  const min = Math.min(...allValues)
  const max = Math.max(...allValues)
  const range = max - min || 1
  const tickFormatter = valueFormatter || formatAxisNumber
  const pad = { t: 8, b: 22, l: 46, r: 10 }
  const W = width - pad.l - pad.r
  const H = height - pad.t - pad.b
  const yTicks = Math.max(4, yTickCount)

  function toPath(values) {
    if (values.length < 2) return ''
    const step = W / (values.length - 1)
    const points = values.map((value, index) => `${pad.l + index * step},${pad.t + H - ((value - min) / range) * H}`)
    return `M${points.join(' L')}`
  }

  function toArea(values) {
    if (values.length < 2) return ''
    const step = W / (values.length - 1)
    const points = values.map((value, index) => `${pad.l + index * step},${pad.t + H - ((value - min) / range) * H}`)
    return `M${points[0]} L${points.join(' L')} L${pad.l + W},${pad.t + H} L${pad.l},${pad.t + H} Z`
  }

  const tickCount = Math.min(labels.length, 6)
  const tickStep = labels.length > 1 && tickCount > 1 ? (labels.length - 1) / (tickCount - 1) : 0

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} fill="none">
      <defs>
        {series.map((item, index) => {
          const gradientId = `lc-${index}-${item.color.replace('#', '')}`
          return (
            <linearGradient key={gradientId} id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={item.color} stopOpacity="0.22" />
              <stop offset="100%" stopColor={item.color} stopOpacity="0" />
            </linearGradient>
          )
        })}
      </defs>
      {Array.from({ length: yTicks }, (_, index) => {
        const factor = yTicks === 1 ? 0 : index / (yTicks - 1)
        const y = pad.t + H * factor
        const tickValue = max - factor * range
        return (
          <g key={`y-${index}`}>
            <line x1={pad.l} y1={y} x2={pad.l + W} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
            <text x={pad.l - 6} y={y + 4} textAnchor="end" fontSize="11" fill="rgba(141,166,188,0.88)" fontFamily="IBM Plex Mono">
              {tickFormatter(tickValue)}
            </text>
          </g>
        )
      })}
      {series.map((item, index) => (
        <path key={`area-${index}`} d={toArea(item.values)} fill={`url(#lc-${index}-${item.color.replace('#', '')})`} />
      ))}
      {series.map((item, index) => (
        <path key={`line-${index}`} d={toPath(item.values)} stroke={item.color} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
      ))}
      {tickCount > 0 &&
        Array.from({ length: tickCount }, (_, index) => {
          const labelIndex = Math.round(index * tickStep)
          const x = pad.l + (series[0] && series[0].values.length > 1 ? (labelIndex / (series[0].values.length - 1)) * W : 0)
          return (
            <text key={index} x={x} y={height - 4} textAnchor="middle" fontSize="11" fill="rgba(93,122,148,0.85)" fontFamily="IBM Plex Mono">
              {labels[labelIndex]}
            </text>
          )
        })}
    </svg>
  )
}

function TopBar({ year, quarter, onAdminClick }) {
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
        }}
      >
        Администрирование
      </button>
    </header>
  )
}

async function sha256(text) {
  const data = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest)).map(value => value.toString(16).padStart(2, '0')).join('')
}

async function parseAdminError(response) {
  const payload = await response.json().catch(() => null)
  if (payload && typeof payload.detail === 'string') return payload.detail
  return `Ошибка ${response.status}`
}

function AdminPanel({ open, onClose, onRefresh }) {
  const [password, setPassword] = useState('')
  const [adminHash, setAdminHash] = useState('')
  const [authenticated, setAuthenticated] = useState(false)
  const [activeTab, setActiveTab] = useState('epi')
  const [screenType, setScreenType] = useState('РМЖ')
  const [epiFile, setEpiFile] = useState(null)
  const [screenFile, setScreenFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) {
      setBusy(false)
      setStatus('')
      setError('')
      setEpiFile(null)
      setScreenFile(null)
    }
  }, [open])

  if (!open) return null

  async function handleAuth() {
    if (!password.trim()) {
      setError('Введите пароль администратора.')
      return
    }
    setBusy(true)
    setError('')
    setStatus('')
    try {
      const hash = await sha256(password.trim())
      const response = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hash }),
      })
      if (!response.ok) {
        throw new Error(await parseAdminError(response))
      }
      setAdminHash(hash)
      setAuthenticated(true)
      setPassword('')
      setStatus('Доступ подтвержден. Можно загружать файлы.')
    } catch (authError) {
      setAuthenticated(false)
      setAdminHash('')
      setError(authError instanceof Error ? authError.message : 'Не удалось авторизоваться.')
    } finally {
      setBusy(false)
    }
  }

  async function handleProcessAll() {
    if (!adminHash) { setError('Сначала подтвердите доступ.'); return }
    setBusy(true); setError(''); setStatus('Пересчёт всех данных из raws/...')
    try {
      const response = await fetch('/api/admin/process-all', {
        method: 'POST', headers: { 'x-admin-hash': adminHash },
      })
      if (!response.ok) throw new Error(await parseAdminError(response))
      setStatus('Готово. Все данные пересчитаны из raws/.')
      onRefresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка пересчёта.')
    } finally { setBusy(false) }
  }

  async function handleUpload(kind) {
    const file = kind === 'epi' ? epiFile : screenFile
    if (!file) {
      setError('Сначала выберите файл для загрузки.')
      return
    }
    if (!adminHash) {
      setError('Сначала подтвердите доступ администратора.')
      return
    }
    setBusy(true)
    setError('')
    setStatus('Загрузка файла и обновление данных...')
    try {
      const formData = new FormData()
      formData.append('file', file)
      const endpoint = kind === 'epi' ? '/api/upload/epidemiology' : `/api/upload/screening/${screenType}`
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'x-admin-hash': adminHash },
        body: formData,
      })
      if (!response.ok) {
        throw new Error(await parseAdminError(response))
      }
      if (kind === 'epi') {
        setEpiFile(null)
      } else {
        setScreenFile(null)
      }
      setStatus(kind === 'epi' ? 'Эпидемиология загружена. Данные обновлены.' : `Скрининг ${screenType} загружен. Данные обновлены.`)
      onRefresh()
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Ошибка при загрузке файла.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(4,12,21,0.72)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <section onClick={event => event.stopPropagation()} style={{ width: 'min(720px, 100%)', maxHeight: 'min(760px, calc(100vh - 48px))', overflowY: 'auto', background: 'rgba(8,21,37,0.98)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, boxShadow: '0 24px 60px rgba(0,0,0,0.35)', padding: 18, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 'var(--fs-lg)', color: 'var(--t1)', fontWeight: 600 }}>Администрирование</div>
            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--t3)', marginTop: 4 }}>Авторизация и загрузка файлов обновления без ручного refresh.</div>
          </div>
          <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--t2)', fontSize: '18px', cursor: 'pointer' }}>×</button>
        </div>

        {!authenticated ? (
          <div style={{ borderRadius: 12, border: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--t2)', fontFamily: 'var(--mono)' }}>Пароль администратора</span>
              <input
                type="password"
                value={password}
                onChange={event => setPassword(event.target.value)}
                onKeyDown={event => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    void handleAuth()
                  }
                }}
                style={{ height: 42, borderRadius: 8, border: '1px solid var(--border)', background: 'rgba(4,14,27,0.92)', color: 'var(--t1)', padding: '0 12px', fontSize: 'var(--fs-md)', outline: 'none' }}
              />
            </label>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => void handleAuth()} disabled={busy} style={{ minWidth: 176, height: 40, borderRadius: 8, border: '1px solid rgba(0,196,206,0.3)', background: 'rgba(0,196,206,0.14)', color: 'var(--cyan)', fontSize: 'var(--fs-md)', fontFamily: 'var(--mono)', cursor: busy ? 'progress' : 'pointer', opacity: busy ? 0.75 : 1 }}>
                {busy ? 'Проверка...' : 'Подтвердить доступ'}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: 8 }}>
                {[{ id: 'epi', label: 'Эпидемиология' }, { id: 'screen', label: 'Скрининги' }, { id: 'raws', label: 'Пересчитать из raws/' }].map(tab => (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ border: '1px solid var(--border)', background: activeTab === tab.id ? 'rgba(0,196,206,0.12)' : 'var(--bg3)', color: activeTab === tab.id ? 'var(--cyan)' : 'var(--t2)', borderRadius: 8, padding: '7px 12px', fontSize: 'var(--fs-sm)', fontFamily: 'var(--mono)', cursor: 'pointer' }}>
                    {tab.label}
                  </button>
                ))}
              </div>
              <a href="/api/template/epidemiology" target="_blank" rel="noreferrer" style={{ color: 'var(--cyan)', fontSize: 'var(--fs-sm)', textDecoration: 'none', fontFamily: 'var(--mono)' }}>
                Скачать шаблон эпидемиологии
              </a>
            </div>

            {activeTab === 'raws' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--t2)', lineHeight: 1.6 }}>
                  Скопируйте обновлённые файлы в папку <code style={{ background: 'var(--bg3)', padding: '1px 5px', borderRadius: 3 }}>raws/</code> проекта, затем нажмите кнопку — скрипты обработки запустятся автоматически.
                </div>
                <div style={{ fontSize: 'var(--fs-xs)', fontFamily: 'var(--mono)', color: 'var(--t3)', lineHeight: 1.8 }}>
                  Ожидаемые файлы в raws/:<br />
                  · <b>РМЖ (1)бн.xlsx</b> — скрининг РМЖ<br />
                  · <b>КРР (1)бн.xlsx</b> — скрининг КРР<br />
                  · <b>РШМ (1)бн.xlsx</b> — скрининг РШМ<br />
                  · <b>координаты МО бн.xlsx</b> — список МО с координатами<br />
                  · <b>template_epidemiology-2.xlsx</b> — эпидемиология (9 столбцов: Район, Год + 7 показателей)
                </div>
                <button onClick={() => void handleProcessAll()} disabled={busy} style={{ alignSelf: 'flex-start', minWidth: 220, height: 40, borderRadius: 8, border: '1px solid rgba(0,196,206,0.3)', background: 'rgba(0,196,206,0.14)', color: 'var(--cyan)', fontSize: 'var(--fs-md)', fontFamily: 'var(--mono)', cursor: busy ? 'progress' : 'pointer', opacity: busy ? 0.6 : 1 }}>
                  {busy ? 'Пересчёт...' : 'Пересчитать все данные'}
                </button>
              </div>
            ) : activeTab === 'epi' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--t2)' }}>Загрузите новый файл эпидемиологии. После импорта дэшборд перечитает meta, эпид и текущие screening-срезы.</div>
                <input key={epiFile ? epiFile.name : 'epi-input'} type="file" accept=".xlsx,.xls,.csv" onChange={event => setEpiFile((event.target.files && event.target.files[0]) || null)} style={{ color: 'var(--t2)', fontSize: 'var(--fs-sm)' }} />
                <button onClick={() => void handleUpload('epi')} disabled={busy || !epiFile} style={{ alignSelf: 'flex-start', minWidth: 176, height: 40, borderRadius: 8, border: '1px solid rgba(0,196,206,0.3)', background: 'rgba(0,196,206,0.14)', color: 'var(--cyan)', fontSize: 'var(--fs-md)', fontFamily: 'var(--mono)', cursor: busy ? 'progress' : 'pointer', opacity: busy || !epiFile ? 0.55 : 1 }}>
                  {busy ? 'Загрузка...' : 'Загрузить эпид'}
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--t2)', fontFamily: 'var(--mono)' }}>Тип скрининга</span>
                  <select value={screenType} onChange={event => setScreenType(event.target.value)} style={{ width: 180, height: 40, borderRadius: 8, border: '1px solid var(--border)', background: 'rgba(4,14,27,0.92)', color: 'var(--t1)', padding: '0 10px', fontSize: 'var(--fs-md)' }}>
                    {['РМЖ', 'КРР', 'РШМ'].map(type => <option key={type} value={type}>{type}</option>)}
                  </select>
                </label>
                <input key={`${screenType}-${screenFile ? screenFile.name : 'screen-input'}`} type="file" accept=".xlsx,.xls,.csv" onChange={event => setScreenFile((event.target.files && event.target.files[0]) || null)} style={{ color: 'var(--t2)', fontSize: 'var(--fs-sm)' }} />
                <button onClick={() => void handleUpload('screen')} disabled={busy || !screenFile} style={{ alignSelf: 'flex-start', minWidth: 196, height: 40, borderRadius: 8, border: '1px solid rgba(0,196,206,0.3)', background: 'rgba(0,196,206,0.14)', color: 'var(--cyan)', fontSize: 'var(--fs-md)', fontFamily: 'var(--mono)', cursor: busy ? 'progress' : 'pointer', opacity: busy || !screenFile ? 0.55 : 1 }}>
                  {busy ? 'Загрузка...' : `Загрузить ${screenType}`}
                </button>
              </div>
            )}
          </>
        )}

        {status ? <div style={{ borderRadius: 10, border: '1px solid rgba(39,201,122,0.24)', background: 'rgba(39,201,122,0.1)', color: '#9ae4be', fontSize: 'var(--fs-sm)', padding: '10px 12px' }}>{status}</div> : null}
        {error ? <div style={{ borderRadius: 10, border: '1px solid rgba(232,80,80,0.24)', background: 'rgba(232,80,80,0.1)', color: '#ffb1b1', fontSize: 'var(--fs-sm)', padding: '10px 12px' }}>{error}</div> : null}
      </section>
    </div>
  )
}

function KPICards({ indicators, areaEpiRecord, selectedEpi, onSelectEpi }) {
  if (!indicators || !indicators.length) return null
  return (
    <div style={{ display: 'flex', gap: 6, padding: '7px 12px', background: 'var(--bg1)', borderBottom: '1px solid var(--border)', overflowX: 'auto' }}>
      {indicators.map(ind => {
        const isSelected = ind.id === selectedEpi
        const raw = areaEpiRecord ? areaEpiRecord[ind.id] : null
        const displayVal = raw !== null && raw !== undefined ? raw.toLocaleString('ru-RU', { maximumFractionDigits: 1 }) : '—'
        return (
          <button
            key={ind.id}
            onClick={() => onSelectEpi(ind.id)}
            style={{
              flex: '1 1 130px', minWidth: 118, background: isSelected ? 'rgba(0,196,206,0.1)' : 'var(--bg2)',
              border: isSelected ? '1px solid rgba(0,196,206,0.45)' : '1px solid var(--border)',
              borderRadius: 6, padding: '9px 11px', display: 'flex', flexDirection: 'column', gap: 3,
              cursor: 'pointer', textAlign: 'left', transition: 'border-color 0.15s',
            }}
          >
            <div style={{ fontSize: 10, color: isSelected ? 'var(--cyan)' : 'var(--t2)', fontFamily: 'var(--mono)', letterSpacing: '0.04em', textTransform: 'uppercase', lineHeight: 1.3 }}>{ind.label}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginTop: 2 }}>
              <span style={{ fontSize: 'var(--fs-xl)', fontWeight: 600, color: ind.color || 'var(--cyan)', fontFamily: 'var(--mono)', lineHeight: 1 }}>{displayVal}</span>
              <span style={{ fontSize: 10, color: 'var(--t3)' }}>{ind.unit}</span>
            </div>
            <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 1 }}>Среднее по области</div>
          </button>
        )
      })}
    </div>
  )
}

function LeftPanel({ filters, layers, years, quarters, districts, epiIndicators, onFilter, onLayer }) {
  return (
    <aside style={{ width: 228, flexShrink: 0, background: 'var(--bg1)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', padding: '12px 12px 0', overflowY: 'auto' }}>
      <Sep label="Период" />
      <select value={filters.year ?? ''} onChange={event => onFilter({ year: Number(event.target.value) })} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--t1)', fontSize: 'var(--fs-sm)', padding: '6px 9px' }}>
        {years.map(year => <option key={year} value={year}>{year}</option>)}
      </select>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
        {quarters.map(quarter => (
          <button
            key={quarter}
            onClick={() => onFilter({ quarter })}
            style={{ padding: '4px 9px', borderRadius: 4, fontSize: 'var(--fs-sm)', fontFamily: 'var(--mono)', cursor: 'pointer', border: 'none', background: filters.quarter === quarter ? 'var(--amber)' : 'var(--bg3)', color: filters.quarter === quarter ? '#fff' : 'var(--t2)' }}
          >
            Q{quarter}
          </button>
        ))}
      </div>

      <Sep label="Эпидемиология" />
      <select value={filters.epi} onChange={event => onFilter({ epi: event.target.value })} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--t1)', fontSize: 'var(--fs-sm)', padding: '6px 9px' }}>
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
            style={{ flex: 1, padding: '4px 0', borderRadius: 4, fontSize: 'var(--fs-sm)', fontFamily: 'var(--mono)', cursor: 'pointer', border: 'none', background: filters.screen === screen ? 'var(--teal)' : 'var(--bg3)', color: filters.screen === screen ? '#fff' : 'var(--t2)' }}
          >
            {screen}
          </button>
        ))}
      </div>
      <select value={filters.screenInd} onChange={event => onFilter({ screenInd: event.target.value })} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--t1)', fontSize: 'var(--fs-sm)', padding: '6px 9px' }}>
        {SCREEN_INDICATORS[filters.screen].map(option => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>

      <Sep label="Район" />
      <select value={filters.districtId || ''} onChange={event => onFilter({ districtId: event.target.value || null })} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--t1)', fontSize: 'var(--fs-sm)', padding: '6px 9px' }}>
        <option value="">Все районы</option>
        {districts.map(district => (
          <option key={district.id} value={district.id}>
            {district.shortName}
          </option>
        ))}
      </select>

      <Sep label="Слои карты" />
      {[
        ['choropleth', 'Хороплет'],
        ['mo', 'МО на карте'],
        ['borders', 'Границы'],
        ['labels', 'Подписи'],
      ].map(([key, label]) => (
        <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer', padding: '4px 0' }}>
          <div
            onClick={() => onLayer({ [key]: !layers[key] })}
            style={{ width: 32, height: 17, borderRadius: 8, position: 'relative', background: layers[key] ? 'var(--cyan)' : 'var(--bg4)', transition: 'background 0.2s', flexShrink: 0 }}
          >
            <div style={{ position: 'absolute', top: 2, left: layers[key] ? 17 : 2, width: 13, height: 13, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
          </div>
          <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--t2)' }}>{label}</span>
        </label>
      ))}

      <div style={{ flex: 1 }} />
      <div style={{ padding: '10px 0 12px', borderTop: '1px solid var(--border)', marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 'var(--fs-xs)', fontFamily: 'var(--mono)', color: 'var(--t3)' }}>v2.5.0</span>
        <span style={{ fontSize: 'var(--fs-xs)', padding: '2px 6px', borderRadius: 3, background: 'var(--amber-d)', color: 'var(--amber)', fontFamily: 'var(--mono)', letterSpacing: '0.06em' }}>БЕТА</span>
      </div>
    </aside>
  )
}

function ContextPanel({ selectedDistrict, selectedMoRecord, screenType, districtEpiRecord, epiIndicators, year, quarter }) {
  const Stat = ({ label, value, color = 'var(--t1)' }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--t2)' }}>{label}</span>
      <span style={{ fontSize: 'var(--fs-md)', fontFamily: 'var(--mono)', fontWeight: 500, color }}>{value}</span>
    </div>
  )

  return (
    <aside style={{ width: 300, flexShrink: 0, background: 'var(--bg1)', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
      <div style={{ padding: '12px 16px 10px', borderBottom: '1px solid var(--border)', fontSize: 'var(--fs-xs)', fontFamily: 'var(--mono)', color: 'var(--t3)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
        {selectedMoRecord ? 'Организация ПМСП' : selectedDistrict ? 'Район' : 'Контекст'}
      </div>

      {selectedMoRecord ? (
        <div style={{ padding: '14px 16px', overflowY: 'auto' }}>
          <div style={{ fontSize: 'var(--fs-xs)', fontFamily: 'var(--mono)', color: 'var(--cyan)', marginBottom: 4, letterSpacing: '0.08em' }}>МО</div>
          <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 600, color: 'var(--t1)', marginBottom: 6, lineHeight: 1.35 }}>{selectedMoRecord.mo_name}</div>
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--t3)', marginBottom: 12 }}>{screenType} • {formatPeriodLabel(year, quarter)}</div>
          {getMoContextStats(screenType, selectedMoRecord).map(item => (
            <Stat key={item.label} label={item.label} value={item.value} color={item.tone} />
          ))}
          {selectedMoRecord.lat !== null && selectedMoRecord.lon !== null && (
            <div style={{ marginTop: 12, fontSize: 'var(--fs-xs)', fontFamily: 'var(--mono)', color: 'var(--t3)' }}>
              {selectedMoRecord.lat.toFixed(4)}, {selectedMoRecord.lon.toFixed(4)}
            </div>
          )}
        </div>
      ) : selectedDistrict ? (
        districtEpiRecord ? (
          <div style={{ padding: '14px 16px', overflowY: 'auto' }}>
            <div style={{ fontSize: 'var(--fs-xs)', fontFamily: 'var(--mono)', color: 'var(--teal)', marginBottom: 4, letterSpacing: '0.08em' }}>РАЙОН</div>
            <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 600, color: 'var(--t1)', marginBottom: 6 }}>{selectedDistrict.shortName}</div>
            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--t3)', marginBottom: 12 }}>{formatPeriodLabel(year, quarter)}</div>
            {epiIndicators.map(indicator => (
              <Stat key={indicator.id} label={indicator.label} value={formatValue(getEpiValue(districtEpiRecord, indicator.id), indicator.unit)} color={indicator.color} />
            ))}
          </div>
        ) : (
          <div style={{ padding: '16px 16px 18px' }}>
            <div style={{ fontSize: 'var(--fs-xs)', fontFamily: 'var(--mono)', color: 'var(--teal)', marginBottom: 6, letterSpacing: '0.08em' }}>РАЙОН</div>
            <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 600, color: 'var(--t1)', marginBottom: 10 }}>{selectedDistrict.shortName}</div>
            <div style={{ padding: 12, borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', color: 'var(--t2)', fontSize: 'var(--fs-sm)', lineHeight: 1.5 }}>
              Нет данных за выбранный период.
            </div>
          </div>
        )
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 }}>
          <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
            <circle cx="28" cy="28" r="27" stroke="rgba(0,196,206,0.15)" strokeWidth="1" strokeDasharray="4 4" />
            <circle cx="28" cy="28" r="18" stroke="rgba(0,196,206,0.1)" strokeWidth="1" strokeDasharray="3 3" />
            <circle cx="28" cy="28" r="4" fill="rgba(0,196,206,0.2)" />
          </svg>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 'var(--fs-md)', color: 'var(--t2)', marginBottom: 4 }}>Выберите район или МО</div>
            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--t3)' }}>Нажмите на объект на карте или выберите строку в таблице</div>
          </div>
        </div>
      )}
    </aside>
  )
}

function TrendPanel({ year, quarter, selectedDistrict, areaEpiRecord, districtEpiRecord, epiIndicators, epiRows, districtOptions, currentMoData, screeningHistory, selectedMo, selectedIndicator, screenType, onSelectMo }) {
  const [expanded, setExpanded] = useState({ epi: false, screenings: false })
  const [screenMode, setScreenMode] = useState('rating')
  const summaryRecord = selectedDistrict ? districtEpiRecord : areaEpiRecord

  const rankedRows = useMemo(() => {
    return [...currentMoData].sort((left, right) => {
      const delta = getScreenIndicatorValue(right, selectedIndicator) - getScreenIndicatorValue(left, selectedIndicator)
      if (delta !== 0) return delta
      return left.mo_name.localeCompare(right.mo_name, 'ru')
    })
  }, [currentMoData, selectedIndicator])

  const historyRows = useMemo(() => {
    if (!selectedMo) return []
    return screeningHistory
      .filter(row => row.mo_name === selectedMo)
      .sort((left, right) => (left.year || 0) * 10 + (left.quarter || 0) - ((right.year || 0) * 10 + (right.quarter || 0)))
  }, [screeningHistory, selectedMo])

  const epiTableRows = useMemo(() => {
    const nameToDistrict = new Map(districtOptions.map(option => [normalizeDistrictName(option.epiName), option]))
    return [...epiRows].sort((left, right) => left.district_name_ru.localeCompare(right.district_name_ru, 'ru')).map(record => {
      const district = nameToDistrict.get(normalizeDistrictName(record.district_name_ru)) || null
      return { record, districtName: district ? district.shortName : record.district_name_ru, districtId: district ? district.id : null }
    })
  }, [districtOptions, epiRows])

  const dashboardHeight = expanded.epi || expanded.screenings ? 348 : 216
  const summaryTarget = selectedDistrict ? selectedDistrict.shortName : 'Область'

  return (
    <div style={{ flexShrink: 0, display: 'flex', background: 'var(--bg1)', borderTop: '1px solid var(--border)', height: dashboardHeight, transition: 'height 0.2s ease' }}>
      <section style={{ flex: 1, minWidth: 0, padding: '12px 14px 12px', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 'var(--fs-md)', fontWeight: 600, color: 'var(--t1)' }}>Эпид</div>
            <div style={{ fontSize: 'var(--fs-xs)', fontFamily: 'var(--mono)', color: 'var(--t3)', marginTop: 3 }}>{summaryTarget} • {formatPeriodLabel(year, quarter)}</div>
          </div>
          <button onClick={() => setExpanded(prev => ({ ...prev, epi: !prev.epi }))} style={{ border: '1px solid var(--border)', background: expanded.epi ? 'rgba(0,196,206,0.12)' : 'var(--bg3)', color: expanded.epi ? 'var(--cyan)' : 'var(--t2)', borderRadius: 6, padding: '5px 10px', fontSize: 'var(--fs-sm)', fontFamily: 'var(--mono)', cursor: 'pointer' }}>
            {expanded.epi ? 'Свернуть' : 'Развернуть'}
          </button>
        </div>
        {summaryRecord ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 8 }}>
            {epiIndicators.map(indicator => (
              <div key={indicator.id} style={{ borderRadius: 8, border: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)', padding: '10px 11px' }}>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--t3)', fontFamily: 'var(--mono)', marginBottom: 6 }}>{indicator.label}</div>
                <div style={{ fontSize: 'var(--fs-md)', color: indicator.color, fontFamily: 'var(--mono)', fontWeight: 600 }}>{formatValue(getEpiValue(summaryRecord, indicator.id), indicator.unit)}</div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: 8, color: 'var(--t3)', fontSize: 'var(--fs-sm)' }}>Нет данных за выбранный период.</div>
        )}
        {expanded.epi && (
          epiTableRows.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(130px, 1.3fr) repeat(5, minmax(70px, 0.8fr))', gap: 10, padding: '0 10px 8px', color: 'var(--t3)', fontSize: 'var(--fs-xs)', fontFamily: 'var(--mono)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                <span>Район</span>
                {epiIndicators.map(indicator => <span key={indicator.id} style={{ textAlign: 'right' }}>{indicator.label}</span>)}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minHeight: 0, overflowY: 'auto', paddingRight: 2 }}>
                {epiTableRows.map(item => {
                  const isSelected = item.districtId && selectedDistrict && item.districtId === selectedDistrict.id
                  return (
                    <div key={`${item.record.district_name_ru}-${item.record.year}-${item.record.quarter}`} style={{ display: 'grid', gridTemplateColumns: 'minmax(130px, 1.3fr) repeat(5, minmax(70px, 0.8fr))', gap: 10, padding: '8px 10px', borderRadius: 8, border: isSelected ? '1px solid rgba(0,196,206,0.4)' : '1px solid var(--border)', background: isSelected ? 'rgba(0,196,206,0.12)' : 'rgba(255,255,255,0.02)' }}>
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
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: 8, color: 'var(--t3)', fontSize: 'var(--fs-sm)' }}>Таблица эпидпоказателей пока пуста.</div>
          )
        )}
      </section>

      <section style={{ flex: 1, minWidth: 0, padding: '12px 14px 12px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 'var(--fs-md)', fontWeight: 600, color: 'var(--t1)' }}>Скрининги</div>
            <div style={{ fontSize: 'var(--fs-xs)', fontFamily: 'var(--mono)', color: 'var(--t3)', marginTop: 3 }}>{screenType} • {selectedIndicator} • {formatPeriodLabel(year, quarter)}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 6 }}>
              {['rating', 'dynamics'].map(mode => (
                <button key={mode} onClick={() => setScreenMode(mode)} style={{ border: '1px solid var(--border)', background: screenMode === mode ? 'rgba(0,196,206,0.12)' : 'var(--bg3)', color: screenMode === mode ? 'var(--cyan)' : 'var(--t2)', borderRadius: 6, padding: '5px 10px', fontSize: 'var(--fs-sm)', fontFamily: 'var(--mono)', cursor: 'pointer' }}>
                  {mode === 'rating' ? 'Рейтинг' : 'Динамика'}
                </button>
              ))}
            </div>
            <button onClick={() => setExpanded(prev => ({ ...prev, screenings: !prev.screenings }))} style={{ border: '1px solid var(--border)', background: expanded.screenings ? 'rgba(0,196,206,0.12)' : 'var(--bg3)', color: expanded.screenings ? 'var(--cyan)' : 'var(--t2)', borderRadius: 6, padding: '5px 10px', fontSize: 'var(--fs-sm)', fontFamily: 'var(--mono)', cursor: 'pointer' }}>
              {expanded.screenings ? 'Свернуть' : 'Развернуть'}
            </button>
          </div>
        </div>

        {screenMode === 'rating' ? (
          rankedRows.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '44px minmax(0,1fr) 82px', gap: 10, padding: '0 10px 8px', color: 'var(--t3)', fontSize: 'var(--fs-xs)', fontFamily: 'var(--mono)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                <span>№</span>
                <span>МО</span>
                <span style={{ textAlign: 'right' }}>{selectedIndicator}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minHeight: 0, overflowY: 'auto', paddingRight: 2 }}>
                {(expanded.screenings ? rankedRows : rankedRows.slice(0, 6)).map((row, index) => {
                  const isSelected = row.mo_name === selectedMo
                  const value = getScreenIndicatorValue(row, selectedIndicator)
                  return (
                    <button key={row.mo_name} onClick={() => onSelectMo(isSelected ? null : row.mo_name)} style={{ display: 'grid', gridTemplateColumns: '44px minmax(0,1fr) 82px', gap: 10, alignItems: 'center', textAlign: 'left', border: isSelected ? '1px solid rgba(0,196,206,0.4)' : '1px solid var(--border)', background: isSelected ? 'rgba(0,196,206,0.12)' : 'rgba(255,255,255,0.02)', borderRadius: 8, padding: '8px 10px', cursor: 'pointer', color: 'var(--t1)' }}>
                      <span style={{ fontSize: 'var(--fs-sm)', fontFamily: 'var(--mono)', color: isSelected ? 'var(--cyan)' : 'var(--t2)' }}>{index + 1}</span>
                      <span style={{ fontSize: 'var(--fs-sm)', color: isSelected ? 'var(--t1)' : 'var(--t2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.mo_name}</span>
                      <span style={{ fontSize: 'var(--fs-md)', fontFamily: 'var(--mono)', color: 'var(--cyan)', textAlign: 'right' }}>{selectedIndicator === 'Охват' ? `${value}%` : value.toLocaleString('ru-RU')}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: 8, color: 'var(--t3)', fontSize: 'var(--fs-sm)' }}>За выбранный период нет записей по скринингу.</div>
          )
        ) : (
          selectedMo ? (
            historyRows.length ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0, flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 'var(--fs-md)', color: 'var(--t1)', fontWeight: 600 }}>{selectedMo}</div>
                    <div style={{ fontSize: 'var(--fs-xs)', fontFamily: 'var(--mono)', color: 'var(--t3)', marginTop: 3 }}>{selectedIndicator}</div>
                  </div>
                  <div style={{ fontSize: 'var(--fs-xl)', fontFamily: 'var(--mono)', color: 'var(--cyan)' }}>
                    {getScreenIndicatorValue(historyRows[historyRows.length - 1], selectedIndicator).toLocaleString('ru-RU')}
                    {selectedIndicator === 'Охват' ? '%' : ''}
                  </div>
                </div>
                <div style={{ flexShrink: 0 }}>
                  <LineChart series={[{ values: historyRows.map(row => getScreenIndicatorValue(row, selectedIndicator)), color: '#00c4ce', label: selectedIndicator }]} labels={historyRows.map(row => `Q${row.quarter} ${row.year}`)} width={expanded.screenings ? 470 : 340} height={expanded.screenings ? 158 : 132} />
                </div>
                {expanded.screenings && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, overflowY: 'auto', paddingRight: 2 }}>
                    {historyRows.map(row => (
                      <div key={`${row.year}-${row.quarter}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)' }}>
                        <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--t2)' }}>{formatPeriodLabel(row.year, row.quarter)}</span>
                        <span style={{ fontSize: 'var(--fs-md)', fontFamily: 'var(--mono)', color: 'var(--cyan)' }}>{getScreenIndicatorValue(row, selectedIndicator).toLocaleString('ru-RU')}{selectedIndicator === 'Охват' ? '%' : ''}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: 8, color: 'var(--t3)', fontSize: 'var(--fs-sm)' }}>Для выбранной МО нет данных динамики.</div>
            )
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: 8, color: 'var(--t3)', fontSize: 'var(--fs-sm)' }}>Выберите МО на карте или в рейтинге, чтобы увидеть динамику.</div>
          )
        )}
      </section>
    </div>
  )
}

function formatScreenValue(value, indicator) {
  return indicator === 'Охват' ? `${value.toLocaleString('ru-RU')}%` : value.toLocaleString('ru-RU')
}

function EmptyCard({ text }) {
  return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: 8, color: 'var(--t3)', fontSize: 'var(--fs-sm)', padding: 18, textAlign: 'center' }}>{text}</div>
}

function SectionTitle({ title, subtitle }) {
  return <div><div style={{ fontSize: 'var(--fs-md)', fontWeight: 600, color: 'var(--t1)' }}>{title}</div><div style={{ fontSize: 'var(--fs-xs)', fontFamily: 'var(--mono)', color: 'var(--t3)', marginTop: 3 }}>{subtitle}</div></div>
}

function PanelSwitch({ modes, active, onChange }) {
  return <div style={{ display: 'flex', gap: 6 }}>{modes.map(mode => <button key={mode.id} onClick={() => onChange(mode.id)} style={{ border: '1px solid var(--border)', background: active === mode.id ? 'rgba(0,196,206,0.12)' : 'var(--bg3)', color: active === mode.id ? 'var(--cyan)' : 'var(--t2)', borderRadius: 6, padding: '5px 10px', fontSize: 'var(--fs-sm)', fontFamily: 'var(--mono)', cursor: 'pointer' }}>{mode.label}</button>)}</div>
}

function RatingTable({ rows, selectedMo, selectedIndicator, expanded, onSelectMo }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '44px minmax(0,1fr) 92px', gap: 10, padding: '0 10px 8px', color: 'var(--t3)', fontSize: 'var(--fs-xs)', fontFamily: 'var(--mono)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
        <span>№</span><span>МО</span><span style={{ textAlign: 'right' }}>{selectedIndicator}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minHeight: 0, overflowY: 'auto', paddingRight: 2 }}>
        {(expanded ? rows : rows.slice(0, 6)).map((row, index) => {
          const isSelected = row.mo_name === selectedMo
          const value = getScreenIndicatorValue(row, selectedIndicator)
          return (
            <button key={row.mo_name} onClick={() => onSelectMo(isSelected ? null : row.mo_name)} style={{ display: 'grid', gridTemplateColumns: '44px minmax(0,1fr) 92px', gap: 10, alignItems: 'center', textAlign: 'left', border: isSelected ? '1px solid rgba(0,196,206,0.4)' : '1px solid var(--border)', background: isSelected ? 'rgba(0,196,206,0.12)' : 'rgba(255,255,255,0.02)', borderRadius: 8, padding: '8px 10px', cursor: 'pointer', color: 'var(--t1)' }}>
              <span style={{ fontSize: 'var(--fs-sm)', fontFamily: 'var(--mono)', color: isSelected ? 'var(--cyan)' : 'var(--t2)' }}>{index + 1}</span>
              <span style={{ fontSize: 'var(--fs-sm)', color: isSelected ? 'var(--t1)' : 'var(--t2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.mo_name}</span>
              <span style={{ fontSize: 'var(--fs-md)', fontFamily: 'var(--mono)', color: 'var(--cyan)', textAlign: 'right' }}>{formatScreenValue(value, selectedIndicator)}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function ScreeningDynamicsView({ selectedMo, historyRows, selectedIndicator, expanded }) {
  if (!selectedMo) return <EmptyCard text="Выберите МО на карте или в рейтинге, чтобы увидеть динамику." />
  if (!historyRows.length) return <EmptyCard text="Для выбранной МО нет данных динамики." />
  const values = historyRows.map(row => getScreenIndicatorValue(row, selectedIndicator))
  const labels = historyRows.map(row => `Q${row.quarter} ${row.year}`)
  const currentValue = values[values.length - 1]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0, flex: 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
        <div><div style={{ fontSize: 'var(--fs-md)', color: 'var(--t1)', fontWeight: 600 }}>{selectedMo}</div><div style={{ fontSize: 'var(--fs-xs)', fontFamily: 'var(--mono)', color: 'var(--t3)', marginTop: 3 }}>{selectedIndicator}</div></div>
        <div style={{ fontSize: 'var(--fs-xl)', fontFamily: 'var(--mono)', color: 'var(--cyan)' }}>{formatScreenValue(currentValue, selectedIndicator)}</div>
      </div>
      <div style={{ flexShrink: 0 }}><LineChart series={[{ values, color: '#00c4ce', label: selectedIndicator }]} labels={labels} width={expanded ? 470 : 340} height={expanded ? 164 : 136} valueFormatter={value => formatScreenValue(value, selectedIndicator)} /></div>
      {expanded && <div style={{ display: 'flex', flexDirection: 'column', gap: 4, overflowY: 'auto', paddingRight: 2 }}>{historyRows.map(row => <div key={`${row.year}-${row.quarter}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)' }}><span style={{ fontSize: 'var(--fs-sm)', color: 'var(--t2)' }}>{formatPeriodLabel(row.year, row.quarter)}</span><span style={{ fontSize: 'var(--fs-md)', fontFamily: 'var(--mono)', color: 'var(--cyan)' }}>{formatScreenValue(getScreenIndicatorValue(row, selectedIndicator), selectedIndicator)}</span></div>)}</div>}
    </div>
  )
}

function EpiDynamicsView({ rows, selectedDistrict, selectedIndicator, expanded }) {
  if (!rows.length) return <EmptyCard text="Для выбранного периода нет истории эпидемиологии." />
  const values = rows.map(row => getEpiValue(row, selectedIndicator.id))
  const labels = rows.map(row => `Q${row.quarter} ${row.year}`)
  const currentValue = values[values.length - 1]
  const targetName = selectedDistrict ? selectedDistrict.shortName : 'Область'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0, flex: 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
        <div><div style={{ fontSize: 'var(--fs-md)', color: 'var(--t1)', fontWeight: 600 }}>{targetName}</div><div style={{ fontSize: 'var(--fs-xs)', fontFamily: 'var(--mono)', color: 'var(--t3)', marginTop: 3 }}>{selectedIndicator.label}{selectedIndicator.unit ? ` • ${selectedIndicator.unit}` : ''}</div></div>
        <div style={{ fontSize: 'var(--fs-xl)', fontFamily: 'var(--mono)', color: selectedIndicator.color }}>{formatValue(currentValue, selectedIndicator.unit)}</div>
      </div>
      <div style={{ flexShrink: 0 }}><LineChart series={[{ values, color: selectedIndicator.color, label: selectedIndicator.label }]} labels={labels} width={expanded ? 470 : 340} height={expanded ? 164 : 136} valueFormatter={value => value.toLocaleString('ru-RU', { minimumFractionDigits: Math.abs(value % 1) > 0.001 ? 1 : 0, maximumFractionDigits: Math.abs(value % 1) > 0.001 ? 1 : 0 })} /></div>
      {expanded && <div style={{ display: 'flex', flexDirection: 'column', gap: 4, overflowY: 'auto', paddingRight: 2 }}>{rows.map(row => <div key={`${row.year}-${row.quarter}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)' }}><span style={{ fontSize: 'var(--fs-sm)', color: 'var(--t2)' }}>{formatPeriodLabel(row.year, row.quarter)}</span><span style={{ fontSize: 'var(--fs-md)', fontFamily: 'var(--mono)', color: selectedIndicator.color }}>{formatValue(getEpiValue(row, selectedIndicator.id), selectedIndicator.unit)}</span></div>)}</div>}
    </div>
  )
}

function TrendPanelV2({ year, quarter, selectedDistrict, areaEpiRecord, districtEpiRecord, selectedEpiIndicator, epiIndicators, epiRows, epiHistory, districtOptions, currentMoData, screeningHistory, selectedMo, selectedIndicator, screenType, onSelectMo }) {
  const [expanded, setExpanded] = useState({ epi: false, screenings: false })
  const [screenMode, setScreenMode] = useState('rating')
  const [epiMode, setEpiMode] = useState('summary')
  const summaryRecord = selectedDistrict ? districtEpiRecord : areaEpiRecord
  const rankedRows = useMemo(() => [...currentMoData].sort((left, right) => {
    const delta = getScreenIndicatorValue(right, selectedIndicator) - getScreenIndicatorValue(left, selectedIndicator)
    if (delta !== 0) return delta
    return left.mo_name.localeCompare(right.mo_name, 'ru')
  }), [currentMoData, selectedIndicator])
  const historyRows = useMemo(() => !selectedMo ? [] : screeningHistory.filter(row => row.mo_name === selectedMo).sort((left, right) => (left.year || 0) * 10 + (left.quarter || 0) - ((right.year || 0) * 10 + (right.quarter || 0))), [screeningHistory, selectedMo])
  const epiTableRows = useMemo(() => {
    const nameToDistrict = new Map(districtOptions.map(option => [normalizeDistrictName(option.epiName), option]))
    return [...epiRows].sort((left, right) => {
      const lv = left[selectedEpiIndicator.id] ?? -Infinity
      const rv = right[selectedEpiIndicator.id] ?? -Infinity
      return selectedEpiIndicator.polarity === 'positive' ? rv - lv : lv - rv
    }).map((record, idx) => {
      const district = nameToDistrict.get(normalizeDistrictName(record.district_name_ru)) || null
      return { record, rank: idx + 1, districtName: district ? district.shortName : record.district_name_ru, districtId: district ? district.id : null }
    })
  }, [districtOptions, epiRows, selectedEpiIndicator])
  const epiTrendRows = useMemo(() => {
    if (selectedDistrict) {
      return [...epiHistory].filter(row => normalizeDistrictName(row.district_name_ru) === normalizeDistrictName(selectedDistrict.epiName)).sort((left, right) => (left.year || 0) * 10 + (left.quarter || 0) - ((right.year || 0) * 10 + (right.quarter || 0)))
    }
    const grouped = new Map()
    epiHistory.forEach(row => {
      const key = `${row.year}-${row.quarter}`
      const bucket = grouped.get(key) || []
      bucket.push(row)
      grouped.set(key, bucket)
    })
    return [...grouped.values()].map(rows => averageEpiRecords(rows, epiIndicators)).filter(Boolean).sort((left, right) => (left.year || 0) * 10 + (left.quarter || 0) - ((right.year || 0) * 10 + (right.quarter || 0)))
  }, [epiHistory, selectedDistrict])
  const dashboardHeight = expanded.epi || expanded.screenings ? 352 : 220
  const summaryTarget = selectedDistrict ? selectedDistrict.shortName : 'Область'
  return (
    <div style={{ flexShrink: 0, display: 'flex', background: 'var(--bg1)', borderTop: '1px solid var(--border)', height: dashboardHeight, transition: 'height 0.2s ease' }}>
      <section style={{ flex: 1, minWidth: 0, padding: '12px 14px 12px', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
          <SectionTitle title="Эпид" subtitle={`${summaryTarget} • ${formatPeriodLabel(year, quarter)}`} />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <PanelSwitch modes={[{ id: 'summary', label: 'Сводка' }, { id: 'dynamics', label: 'Динамика' }]} active={epiMode} onChange={setEpiMode} />
            <button onClick={() => setExpanded(prev => ({ ...prev, epi: !prev.epi }))} style={{ border: '1px solid var(--border)', background: expanded.epi ? 'rgba(0,196,206,0.12)' : 'var(--bg3)', color: expanded.epi ? 'var(--cyan)' : 'var(--t2)', borderRadius: 6, padding: '5px 10px', fontSize: 'var(--fs-sm)', fontFamily: 'var(--mono)', cursor: 'pointer' }}>{expanded.epi ? 'Свернуть' : 'Развернуть'}</button>
          </div>
        </div>
        {epiMode === 'summary' ? (epiTableRows.length ? <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}><div style={{ display: 'grid', gridTemplateColumns: `32px minmax(120px, 1.3fr) repeat(${epiIndicators.length}, minmax(60px, 0.8fr))`, gap: 8, padding: '0 10px 8px', color: 'var(--t3)', fontSize: 'var(--fs-xs)', fontFamily: 'var(--mono)', letterSpacing: '0.05em', textTransform: 'uppercase' }}><span>№</span><span>Район</span>{epiIndicators.map(indicator => <span key={indicator.id} style={{ textAlign: 'right', color: indicator.id === selectedEpiIndicator.id ? 'var(--cyan)' : undefined }}>{indicator.label}</span>)}</div><div style={{ display: 'flex', flexDirection: 'column', gap: 4, minHeight: 0, overflowY: 'auto', paddingRight: 2 }}>{epiTableRows.map(item => { const isSelected = item.districtId && selectedDistrict && item.districtId === selectedDistrict.id; return <div key={`${item.record.district_name_ru}-${item.record.year}-${item.record.quarter}`} style={{ display: 'grid', gridTemplateColumns: `32px minmax(120px, 1.3fr) repeat(${epiIndicators.length}, minmax(60px, 0.8fr))`, gap: 8, padding: '8px 10px', borderRadius: 8, border: isSelected ? '1px solid rgba(0,196,206,0.4)' : '1px solid var(--border)', background: isSelected ? 'rgba(0,196,206,0.12)' : 'rgba(255,255,255,0.02)' }}><span style={{ fontSize: 'var(--fs-xs)', fontFamily: 'var(--mono)', color: 'var(--t3)' }}>{item.rank}</span><span style={{ fontSize: 'var(--fs-sm)', color: isSelected ? 'var(--t1)' : 'var(--t2)' }}>{item.districtName}</span>{epiIndicators.map(indicator => <span key={indicator.id} style={{ fontSize: 'var(--fs-sm)', textAlign: 'right', color: indicator.id === selectedEpiIndicator.id ? 'var(--cyan)' : indicator.color, fontFamily: 'var(--mono)', fontWeight: indicator.id === selectedEpiIndicator.id ? 600 : 400 }}>{formatValue(getEpiValue(item.record, indicator.id), indicator.unit)}</span>)}</div> })}</div></div> : <EmptyCard text="Нет данных за выбранный период." />) : <EpiDynamicsView rows={epiTrendRows} selectedDistrict={selectedDistrict} selectedIndicator={selectedEpiIndicator} expanded={expanded.epi} />}
      </section>
      <section style={{ flex: 1, minWidth: 0, padding: '12px 14px 12px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
          <SectionTitle title="Скрининги" subtitle={`${screenType} • ${selectedIndicator} • ${formatPeriodLabel(year, quarter)}`} />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <PanelSwitch modes={[{ id: 'rating', label: 'Рейтинг' }, { id: 'dynamics', label: 'Динамика' }]} active={screenMode} onChange={setScreenMode} />
            <button onClick={() => setExpanded(prev => ({ ...prev, screenings: !prev.screenings }))} style={{ border: '1px solid var(--border)', background: expanded.screenings ? 'rgba(0,196,206,0.12)' : 'var(--bg3)', color: expanded.screenings ? 'var(--cyan)' : 'var(--t2)', borderRadius: 6, padding: '5px 10px', fontSize: 'var(--fs-sm)', fontFamily: 'var(--mono)', cursor: 'pointer' }}>{expanded.screenings ? 'Свернуть' : 'Развернуть'}</button>
          </div>
        </div>
        {screenMode === 'rating' ? (rankedRows.length ? <RatingTable rows={rankedRows} selectedMo={selectedMo} selectedIndicator={selectedIndicator} expanded={expanded.screenings} onSelectMo={onSelectMo} /> : <EmptyCard text="За выбранный период нет записей по скринингу." />) : <ScreeningDynamicsView selectedMo={selectedMo} historyRows={historyRows} selectedIndicator={selectedIndicator} expanded={expanded.screenings} />}
      </section>
    </div>
  )
}

function MapView({ geoData, moData, filters, layers, selectedMo, selectedDistrictId, selectedEpiIndicator, epiValueByDistrictId, onSelectDistrict, onSelectMo }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const geojsonLayerRef = useRef(null)
  const moLayerRef = useRef(null)
  const labelsLayerRef = useRef(null)

  const availableEpiValues = useMemo(() => Object.values(epiValueByDistrictId).filter(value => value !== null && value !== undefined && !Number.isNaN(value)), [epiValueByDistrictId])
  const epiMin = availableEpiValues.length ? Math.min(...availableEpiValues) : 0
  const epiMax = availableEpiValues.length ? Math.max(...availableEpiValues) : 1

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const map = L.map(containerRef.current, { center: [49.8, 80.5], zoom: 7, zoomControl: false, attributionControl: false })
    map.createPane('choroplethPane')
    map.getPane('choroplethPane').style.zIndex = '330'
    map.createPane('moPane')
    map.getPane('moPane').style.zIndex = '460'
    map.createPane('labelsPane')
    map.getPane('labelsPane').style.zIndex = '520'
    map.getPane('labelsPane').style.pointerEvents = 'none'
    mapRef.current = map
    moLayerRef.current = L.layerGroup().addTo(map)
    labelsLayerRef.current = L.layerGroup().addTo(map)
    return () => map.remove()
  }, [])

  useEffect(() => {
    if (!mapRef.current || !geoData) return
    if (geojsonLayerRef.current) {
      geojsonLayerRef.current.remove()
      geojsonLayerRef.current = null
    }
    labelsLayerRef.current && labelsLayerRef.current.clearLayers()

    function getChoroplethColor(value) {
      if (value === null || value === undefined) return 'rgba(16,35,58,0.75)'
      const normalized = epiMax === epiMin ? 0.5 : (value - epiMin) / (epiMax - epiMin)
      if (normalized > 0.75) return 'rgba(58,143,244,0.78)'
      if (normalized > 0.5) return 'rgba(0,168,158,0.78)'
      if (normalized > 0.25) return 'rgba(0,196,206,0.72)'
      return 'rgba(232,80,80,0.68)'
    }

    geojsonLayerRef.current = L.geoJSON(geoData, {
      pane: 'choroplethPane',
      style: feature => {
        const districtId = feature.properties.district_id
        const isSelected = districtId === selectedDistrictId
        const value = epiValueByDistrictId[districtId] ?? null
        return {
          fillColor: getChoroplethColor(value),
          fillOpacity: layers.choropleth ? (isSelected ? 0.84 : 0.64) : 0.06,
          color: layers.borders ? (isSelected ? '#00c4ce' : 'rgba(0,196,206,0.28)') : 'transparent',
          weight: layers.borders ? (isSelected ? 2.2 : 1.1) : 0,
          opacity: 1,
        }
      },
      onEachFeature: (feature, layer) => {
        const districtId = feature.properties.district_id
        const districtName = feature.properties.name_ru
        layer.on({
          click: () => onSelectDistrict(districtId === selectedDistrictId ? null : districtId),
          mouseover: () => layer.setStyle({ fillOpacity: layers.choropleth ? 0.82 : 0.12, color: 'rgba(0,196,206,0.55)', weight: layers.borders ? 2 : 1 }),
          mouseout: () => geojsonLayerRef.current && geojsonLayerRef.current.resetStyle(layer),
        })
        const center = layer.getBounds().getCenter()
        labelsLayerRef.current.addLayer(L.marker(center, {
          pane: 'labelsPane',
          interactive: false,
          icon: L.divIcon({
            className: '',
            html: `<div style="color:#8aa5bd;font-size:12px;font-family:'IBM Plex Sans',sans-serif;white-space:nowrap;text-shadow:0 0 6px #05101d,0 0 3px #05101d;pointer-events:none;transform:translate(-50%,-50%);">${districtName}</div>`,
          }),
        }))
      },
    }).addTo(mapRef.current)

    if (!layers.labels) labelsLayerRef.current.remove()
    else labelsLayerRef.current.addTo(mapRef.current)
  }, [epiMax, epiMin, epiValueByDistrictId, geoData, layers.borders, layers.choropleth, layers.labels, onSelectDistrict, selectedDistrictId])

  useEffect(() => {
    if (!mapRef.current || !geojsonLayerRef.current) return
    if (!selectedDistrictId) {
      mapRef.current.setView([49.8, 80.5], 7)
      return
    }
    geojsonLayerRef.current.eachLayer(layer => {
      const feature = layer.feature
      if (feature && feature.properties && feature.properties.district_id === selectedDistrictId) {
        mapRef.current.fitBounds(layer.getBounds(), { padding: [24, 24], maxZoom: 9 })
      }
    })
  }, [selectedDistrictId])

  useEffect(() => {
    if (!moLayerRef.current) return
    moLayerRef.current.clearLayers()
    if (!layers.mo) return
    const values = moData.map(row => getScreenIndicatorValue(row, filters.screenInd))
    const min = values.length ? Math.min(...values) : 0
    const max = values.length ? Math.max(...values) : 1

    function getMarkerRadius(value, selected) {
      const normalized = max === min ? 0.5 : (value - min) / (max - min)
      return 6 + normalized * 8 + (selected ? 2 : 0)
    }

    moData.filter(row => row.lat !== null && row.lon !== null).forEach(row => {
      const value = getScreenIndicatorValue(row, filters.screenInd)
      const isSelected = row.mo_name === selectedMo
      const marker = L.circleMarker([row.lat, row.lon], {
        pane: 'moPane',
        radius: getMarkerRadius(value, isSelected),
        fillColor: 'rgba(0,196,206,0.82)',
        color: isSelected ? '#ffffff' : 'rgba(0,196,206,0.45)',
        weight: isSelected ? 2.3 : 1.1,
        fillOpacity: isSelected ? 1 : 0.86,
      })
      marker.bindTooltip(`
        <div style="font-family:'IBM Plex Sans',sans-serif;font-size:12px;color:#cddae8;background:#0c1d30;border:1px solid rgba(0,196,206,0.22);border-radius:6px;padding:8px 10px;min-width:160px;max-width:240px;">
          <div style="font-weight:600;margin-bottom:4px;color:#00c4ce;white-space:normal;word-break:break-word;">${row.mo_name}</div>
          <div>${filters.screenInd}: <b>${filters.screenInd === 'Охват' ? `${value}%` : value}</b></div>
          <div>Охват: <b>${row.coverage_pct}%</b></div>
          <div>Предраки: <b>${row.precancers}</b></div>
          <div>ЗНО: <b>${row.zno}</b></div>
        </div>
      `, { className: 'onco-tooltip', sticky: false, opacity: 1 })
      marker.on('click', event => {
        if (event.originalEvent) {
          event.originalEvent._markerHandled = true
          L.DomEvent.stopPropagation(event.originalEvent)
        }
        onSelectMo(row.mo_name === selectedMo ? null : row.mo_name)
      })
      marker.addTo(moLayerRef.current)
    })
  }, [filters.screenInd, layers.mo, moData, onSelectMo, selectedMo])

  return (
    <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 20, background: 'rgba(8,21,37,0.9)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '10px 12px', minWidth: 196, pointerEvents: 'none' }}>
        <div style={{ color: '#cddae8', fontSize: 'var(--fs-sm)', marginBottom: 8, fontWeight: 600 }}>{selectedEpiIndicator.label}</div>
        {availableEpiValues.length ? (
          <>
            {[
              ['rgba(232,80,80,0.68)', 'низкий'],
              ['rgba(0,196,206,0.72)', 'средний'],
              ['rgba(0,168,158,0.78)', 'выше среднего'],
              ['rgba(58,143,244,0.78)', 'высокий'],
            ].map(([color, label]) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, fontSize: 'var(--fs-sm)', color: '#8aa5bd' }}>
                <span style={{ width: 12, height: 12, borderRadius: 3, background: color, display: 'inline-block' }} />
                <span>{label}</span>
              </div>
            ))}
            <div style={{ marginTop: 6, fontSize: 'var(--fs-xs)', color: '#5d7a94', fontFamily: 'var(--mono)' }}>
              {selectedEpiIndicator.unit} • от {epiMin.toLocaleString('ru-RU', { maximumFractionDigits: 1 })} до {epiMax.toLocaleString('ru-RU', { maximumFractionDigits: 1 })}
            </div>
          </>
        ) : (
          <div style={{ fontSize: 'var(--fs-sm)', color: '#8aa5bd' }}>Нет данных за выбранный период</div>
        )}
      </div>
      <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 20, background: 'rgba(8,21,37,0.9)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '10px 12px', minWidth: 210, pointerEvents: 'none' }}>
        <div style={{ color: '#cddae8', fontSize: 'var(--fs-sm)', marginBottom: 8, fontWeight: 600 }}>МО • {filters.screenInd}</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, marginBottom: 8 }}>
          {[8, 11, 14].map(size => (
            <div key={size} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
              <span style={{ width: size, height: size, borderRadius: '50%', background: 'rgba(0,196,206,0.78)', border: '1px solid rgba(255,255,255,0.25)', display: 'inline-block' }} />
              <span style={{ fontSize: 'var(--fs-xs)', color: '#8aa5bd', fontFamily: 'var(--mono)' }}>{size - 5}</span>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 'var(--fs-sm)', color: '#8aa5bd' }}>Крупнее круг — выше значение текущего индикатора</div>
        <div style={{ fontSize: 'var(--fs-xs)', color: '#5d7a94', fontFamily: 'var(--mono)', marginTop: 6 }}>Белый контур — выбранная МО</div>
      </div>
      <div style={{ position: 'absolute', right: 12, bottom: 12, zIndex: 600, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {[
          ['+', () => mapRef.current && mapRef.current.zoomIn()],
          ['−', () => mapRef.current && mapRef.current.zoomOut()],
          ['⌂', () => mapRef.current && mapRef.current.setView([49.8, 80.5], 7)],
        ].map(([label, action]) => (
          <button key={label} onClick={action} style={{ width: 34, height: 34, borderRadius: 6, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(8,21,37,0.92)', color: '#8aa5bd', fontSize: label === '⌂' ? 'var(--fs-sm)' : '18px', cursor: 'pointer' }}>
            {label}
          </button>
        ))}
      </div>
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'radial-gradient(ellipse at center, transparent 60%, rgba(5,16,29,0.58) 100%)', zIndex: 10 }} />
    </div>
  )
}

const MAPV2_CHOROPLETH_STOPS = [0, 0.25, 0.5, 0.75, 1]
// worst → best: red, amber, light-green, green; polarity inversion applied in getMapV2Color
const MAPV2_CHOROPLETH_COLORS = ['rgba(220,60,60,0.78)', 'rgba(210,130,30,0.78)', 'rgba(0,180,190,0.78)', 'rgba(0,100,160,0.84)']
const MAPV2_MO_FILL = 'rgba(212,175,55,0.90)'
const MAPV2_MO_STROKE = '#7c3aed'

function formatLegendNumber(value) {
  return value.toLocaleString('ru-RU', {
    minimumFractionDigits: Math.abs(value % 1) > 0.001 ? 1 : 0,
    maximumFractionDigits: Math.abs(value % 1) > 0.001 ? 1 : 0,
  })
}

function getMapV2Color(value, min, max, polarity = 'positive') {
  if (value === null || value === undefined) return 'rgba(16,35,58,0.75)'
  const normalized = max === min ? 0.5 : (value - min) / (max - min)
  // negative polarity: low value = best → green; invert t so low→COLORS[3]
  const t = polarity === 'negative' ? 1 - normalized : normalized
  if (t > 0.75) return MAPV2_CHOROPLETH_COLORS[3]
  if (t > 0.5) return MAPV2_CHOROPLETH_COLORS[2]
  if (t > 0.25) return MAPV2_CHOROPLETH_COLORS[1]
  return MAPV2_CHOROPLETH_COLORS[0]
}

function getMapV2Radius(value, min, max) {
  const normalized = max === min ? 0.5 : (value - min) / (max - min)
  return 6 + normalized * 8
}

function getMapV2LegendItems(min, max, polarity = 'positive') {
  if (max === min) {
    return [{ color: MAPV2_CHOROPLETH_COLORS[2], label: `${formatLegendNumber(min)}` }]
  }
  const thresholds = MAPV2_CHOROPLETH_STOPS.map(stop => min + (max - min) * stop)
  // for negative polarity: low value = good = green → show colors reversed in legend
  const orderedColors = polarity === 'negative' ? [...MAPV2_CHOROPLETH_COLORS].reverse() : MAPV2_CHOROPLETH_COLORS
  return orderedColors.map((color, index) => ({ color, label: `${formatLegendNumber(thresholds[index])} — ${formatLegendNumber(thresholds[index + 1])}` }))
}

function getMapV2MarkerLegend(values, isPercent) {
  if (!values.length) return []
  const sorted = [...values].sort((left, right) => left - right)
  const min = sorted[0]
  const median = sorted[Math.floor((sorted.length - 1) / 2)]
  const max = sorted[sorted.length - 1]
  return [min, median, max].map((value, index) => ({ key: `${index}-${value}`, radius: getMapV2Radius(value, min, max), label: isPercent ? `${formatLegendNumber(value)}%` : formatLegendNumber(value) }))
}

function MapViewV2({ geoData, moData, filters, layers, selectedMo, selectedDistrictId, selectedEpiIndicator, epiValueByDistrictId, onSelectDistrict, onSelectMo }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const geojsonLayerRef = useRef(null)
  const moLayerRef = useRef(null)
  const selectionLayerRef = useRef(null)
  const labelsLayerRef = useRef(null)
  const availableEpiValues = useMemo(() => Object.values(epiValueByDistrictId).filter(value => value !== null && value !== undefined && !Number.isNaN(value)), [epiValueByDistrictId])
  const epiMin = availableEpiValues.length ? Math.min(...availableEpiValues) : 0
  const epiMax = availableEpiValues.length ? Math.max(...availableEpiValues) : 1
  const markerValues = useMemo(() => moData.map(row => getScreenIndicatorValue(row, filters.screenInd)), [filters.screenInd, moData])
  const markerMin = markerValues.length ? Math.min(...markerValues) : 0
  const markerMax = markerValues.length ? Math.max(...markerValues) : 1
  const markerLegendItems = useMemo(() => getMapV2MarkerLegend(markerValues, filters.screenInd === 'Охват'), [filters.screenInd, markerValues])
  const choroplethLegendItems = useMemo(() => availableEpiValues.length ? getMapV2LegendItems(epiMin, epiMax, selectedEpiIndicator.polarity) : [], [availableEpiValues.length, epiMax, epiMin, selectedEpiIndicator.polarity])

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const map = L.map(containerRef.current, { center: [49.8, 80.5], zoom: 7, zoomControl: false, attributionControl: false, preferCanvas: true, minZoom: 6, maxZoom: 17 })
    map.createPane('choroplethPane')
    map.getPane('choroplethPane').style.zIndex = '330'
    map.createPane('moPane')
    map.getPane('moPane').style.zIndex = '460'
    map.createPane('selectionPane')
    map.getPane('selectionPane').style.zIndex = '500'
    map.getPane('selectionPane').style.pointerEvents = 'none'
    map.createPane('labelsPane')
    map.getPane('labelsPane').style.zIndex = '520'
    map.getPane('labelsPane').style.pointerEvents = 'none'
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { subdomains: 'abcd', maxZoom: 19 }).addTo(map)
    map.on('click', event => {
      if (!event.originalEvent._markerHandled) {
        onSelectDistrict(null)
        onSelectMo(null)
      }
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
    if (!mapRef.current || !geoData) return
    if (geojsonLayerRef.current) geojsonLayerRef.current.remove()
    if (labelsLayerRef.current) labelsLayerRef.current.clearLayers()
    const layer = L.geoJSON(geoData, {
      pane: 'choroplethPane',
      style: feature => {
        const districtId = feature && feature.properties ? feature.properties.district_id : null
        const value = districtId ? (epiValueByDistrictId[districtId] ?? null) : null
        const isSelected = districtId === selectedDistrictId
        return {
          fillColor: getMapV2Color(value, epiMin, epiMax, selectedEpiIndicator.polarity),
          fillOpacity: layers.choropleth ? (isSelected ? 0.84 : 0.64) : 0.06,
          color: isSelected ? 'rgba(255,255,255,0.88)' : 'rgba(255,255,255,0.18)',
          weight: layers.borders ? (isSelected ? 2.3 : 1.1) : 0.3,
          opacity: layers.borders ? 1 : 0.28,
        }
      },
      onEachFeature: (feature, layerItem) => {
        const districtId = feature.properties ? feature.properties.district_id : null
        const districtName = feature.properties ? feature.properties.name_ru : 'Район'
        layerItem.on({
          mouseover: () => layerItem.setStyle({ fillOpacity: layers.choropleth ? 0.82 : 0.12, color: 'rgba(0,196,206,0.55)', weight: layers.borders ? 2 : 1 }),
          mouseout: () => layer.resetStyle(layerItem),
          click: event => {
            if (event.originalEvent) event.originalEvent._markerHandled = true
            onSelectDistrict(districtId === selectedDistrictId ? null : districtId)
          },
        })
        if (layers.labels) {
          const center = layerItem.getBounds().getCenter()
          const label = L.marker(center, {
            pane: 'labelsPane',
            interactive: false,
            icon: L.divIcon({ className: 'district-label', html: `<div style="font-family:'IBM Plex Sans',sans-serif;font-size:11px;line-height:1.2;color:#a7bed3;text-align:center;text-shadow:0 1px 0 rgba(0,0,0,0.4);">${districtName}</div>` }),
          })
          label.addTo(labelsLayerRef.current)
        }
      },
    }).addTo(mapRef.current)
    geojsonLayerRef.current = layer
  }, [epiMax, epiMin, epiValueByDistrictId, geoData, layers.borders, layers.choropleth, layers.labels, onSelectDistrict, selectedDistrictId])

  useEffect(() => {
    const layer = moLayerRef.current
    const selectionLayer = selectionLayerRef.current
    if (!layer || !selectionLayer) return
    layer.clearLayers()
    selectionLayer.clearLayers()
    if (!layers.mo) return
    moData.filter(row => row.lat !== null && row.lon !== null).forEach(row => {
      const value = getScreenIndicatorValue(row, filters.screenInd)
      const isSelected = row.mo_name === selectedMo
      const radius = getMapV2Radius(value, markerMin, markerMax)
      const marker = L.circleMarker([row.lat, row.lon], {
        pane: 'moPane',
        radius,
        fillColor: MAPV2_MO_FILL,
        color: MAPV2_MO_STROKE,
        weight: isSelected ? 1.8 : 1.2,
        fillOpacity: isSelected ? 1 : 0.88,
      })
      marker.bindTooltip(`<div style="font-family:'IBM Plex Sans',sans-serif;font-size:12px;color:#cddae8;background:#0c1d30;border:1px solid rgba(0,196,206,0.22);border-radius:6px;padding:8px 10px;min-width:160px;max-width:240px;"><div style="font-weight:600;margin-bottom:4px;color:#00c4ce;white-space:normal;word-break:break-word;">${row.mo_name}</div><div>${filters.screenInd}: <b>${filters.screenInd === 'Охват' ? `${formatLegendNumber(value)}%` : formatLegendNumber(value)}</b></div><div>Охват: <b>${formatLegendNumber(row.coverage_pct)}%</b></div><div>Предраки: <b>${row.precancers}</b></div><div>ЗНО: <b>${row.zno}</b></div></div>`, { className: 'onco-tooltip', sticky: false, opacity: 1 })
      marker.on('click', event => {
        if (event.originalEvent) {
          event.originalEvent._markerHandled = true
          L.DomEvent.stopPropagation(event.originalEvent)
        }
        onSelectMo(row.mo_name === selectedMo ? null : row.mo_name)
      })
      marker.addTo(layer)
      if (isSelected) {
        L.circleMarker([row.lat, row.lon], { pane: 'selectionPane', radius: radius + 4.5, fill: false, color: '#f7fbff', weight: 2.1, opacity: 0.95, interactive: false }).addTo(selectionLayer)
      }
    })
  }, [filters.screenInd, layers.mo, markerMax, markerMin, moData, onSelectMo, selectedMo])

  // Auto-zoom to selected district (skip if an MO is also selected to avoid competing flyTo)
  useEffect(() => {
    if (!mapRef.current || !geojsonLayerRef.current || !selectedDistrictId || selectedMo) return
    geojsonLayerRef.current.eachLayer(layer => {
      if (layer.feature?.properties?.district_id === selectedDistrictId) {
        mapRef.current.flyToBounds(layer.getBounds(), { padding: [40, 40], maxZoom: 10, duration: 0.7 })
      }
    })
  }, [selectedDistrictId, selectedMo])

  // Auto-zoom to selected MO marker
  useEffect(() => {
    if (!mapRef.current || !selectedMo) return
    const row = moData.find(r => r.mo_name === selectedMo)
    if (row && row.lat !== null && row.lon !== null) {
      mapRef.current.flyTo([row.lat, row.lon], 14, { duration: 0.7 })
    }
  }, [selectedMo, moData])

  return (
    <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 600, background: 'rgba(5,16,29,0.92)', border: '1px solid rgba(0,196,206,0.18)', borderRadius: 10, padding: '11px 14px', minWidth: 200, pointerEvents: 'none', backdropFilter: 'blur(4px)' }}>
        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--cyan)', fontFamily: 'var(--mono)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>Районы</div>
        <div style={{ fontSize: 'var(--fs-md)', color: '#cddae8', fontWeight: 600, marginBottom: 8, lineHeight: 1.25 }}>{selectedEpiIndicator.label}</div>
        {choroplethLegendItems.length ? <>
          {choroplethLegendItems.map((item, idx) => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: idx < choroplethLegendItems.length - 1 ? 5 : 0 }}>
              <span style={{ flexShrink: 0, width: 14, height: 14, borderRadius: 4, background: item.color, display: 'inline-block', border: '1px solid rgba(255,255,255,0.08)' }} />
              <span style={{ fontSize: 'var(--fs-sm)', color: '#a7bed3', fontFamily: 'var(--mono)' }}>{item.label}</span>
            </div>
          ))}
          <div style={{ marginTop: 7, fontSize: 'var(--fs-xs)', color: 'var(--t3)', fontFamily: 'var(--mono)' }}>{selectedEpiIndicator.unit} · {selectedEpiIndicator.polarity === 'positive' ? '↑ лучше' : '↓ лучше'}</div>
        </> : <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--t2)' }}>Нет данных за период</div>}
      </div>
      <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 600, background: 'rgba(5,16,29,0.92)', border: '1px solid rgba(0,196,206,0.18)', borderRadius: 10, padding: '11px 14px', minWidth: 200, pointerEvents: 'none', backdropFilter: 'blur(4px)' }}>
        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--cyan)', fontFamily: 'var(--mono)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>Скрининг · МО</div>
        <div style={{ fontSize: 'var(--fs-md)', color: '#cddae8', fontWeight: 600, marginBottom: 10, lineHeight: 1.25 }}>{filters.screenInd}</div>
        {markerLegendItems.length ? <>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 18, marginBottom: 8, paddingBottom: 4 }}>
            {markerLegendItems.map(item => (
              <div key={item.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                <span style={{ width: item.radius * 2, height: item.radius * 2, borderRadius: '50%', background: MAPV2_MO_FILL, border: `1.5px solid ${MAPV2_MO_STROKE}`, display: 'inline-block' }} />
                <span style={{ fontSize: 'var(--fs-xs)', color: '#a7bed3', fontFamily: 'var(--mono)' }}>{item.label}</span>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 10, color: 'var(--t3)', lineHeight: 1.4 }}>Размер = значение показателя<br />Золотой с фиолетовым контуром = МО<br />Белое кольцо = выбранная МО</div>
        </> : <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--t2)' }}>Нет данных МО</div>}
      </div>
      <div style={{ position: 'absolute', right: 12, bottom: 12, zIndex: 600, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {[{ label: '+', onClick: () => mapRef.current && mapRef.current.zoomIn() }, { label: '−', onClick: () => mapRef.current && mapRef.current.zoomOut() }, { label: '⌂', onClick: () => mapRef.current && mapRef.current.setView([49.8, 80.5], 7) }].map(button => <button key={button.label} onClick={button.onClick} style={{ width: 34, height: 34, borderRadius: 6, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(8,21,37,0.92)', color: '#8aa5bd', fontSize: button.label === '⌂' ? 'var(--fs-sm)' : '18px', cursor: 'pointer' }}>{button.label}</button>)}
      </div>
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'radial-gradient(ellipse at center, transparent 60%, rgba(5,16,29,0.58) 100%)', zIndex: 10 }} />
    </div>
  )
}

function App() {
  const [filters, setFilters] = useState({
    year: null,
    quarter: null,
    epi: 'incidence_rate',
    screen: 'РМЖ',
    screenInd: SCREEN_INDICATORS['РМЖ'][0],
    districtId: null,
  })
  const [layers, setLayers] = useState({ choropleth: true, mo: true, borders: true, labels: true })
  const [selectedMo, setSelectedMo] = useState(null)
  const [adminOpen, setAdminOpen] = useState(false)
  const [dataVersion, setDataVersion] = useState(0)

  const meta = useMeta(dataVersion)
  const epiPayload = useEpidemiology(dataVersion)
  const geoData = useDistrictGeoData()
  const screeningData = useScreeningData(filters.screen, dataVersion)

  const districtOptions = useMemo(() => buildDistrictOptions(geoData), [geoData])
  const districtById = useMemo(() => new Map(districtOptions.map(option => [option.id, option])), [districtOptions])
  const latestPeriod = useMemo(() => getLatestPeriod(meta), [meta])

  useEffect(() => {
    setFilters(prev => ({
      ...prev,
      year: prev.year !== null && meta.years.includes(prev.year) ? prev.year : latestPeriod.year,
      quarter: prev.quarter !== null && meta.quarters.includes(prev.quarter) ? prev.quarter : latestPeriod.quarter,
    }))
  }, [latestPeriod.quarter, latestPeriod.year, meta.quarters, meta.years])

  useEffect(() => {
    if (filters.districtId && !districtById.has(filters.districtId)) {
      setFilters(prev => ({ ...prev, districtId: null }))
    }
  }, [districtById, filters.districtId])

  const moDistrictMap = useMemo(() => buildMoDistrictMap(screeningData, geoData), [geoData, screeningData])

  const currentMoData = useMemo(() => {
    if (filters.year === null || filters.quarter === null) return []
    return screeningData.filter(row => row.year === filters.year && row.quarter === filters.quarter).map(row => ({ ...row, districtId: moDistrictMap[row.mo_name] ?? null }))
  }, [filters.quarter, filters.year, moDistrictMap, screeningData])

  useEffect(() => {
    if (selectedMo && !currentMoData.some(row => row.mo_name === selectedMo)) setSelectedMo(null)
  }, [currentMoData, selectedMo])

  const selectedDistrict = filters.districtId ? districtById.get(filters.districtId) || null : null
  const selectedMoRecord = selectedMo ? currentMoData.find(row => row.mo_name === selectedMo) || null : null

  const periodEpiRows = useMemo(() => {
    if (filters.year === null) return []
    return epiPayload.data.filter(row =>
      row.year === filters.year && (row.quarter == null || row.quarter === filters.quarter)
    )
  }, [epiPayload.data, filters.quarter, filters.year])

  const epiByDistrictKey = useMemo(() => new Map(periodEpiRows.map(row => [normalizeDistrictName(row.district_name_ru), row])), [periodEpiRows])
  const districtEpiRecord = selectedDistrict ? epiByDistrictKey.get(normalizeDistrictName(selectedDistrict.epiName)) || null : null
  const areaEpiRecord = useMemo(() => averageEpiRecords(periodEpiRows, epiPayload.indicators), [periodEpiRows, epiPayload.indicators])
  const epiValueByDistrictId = useMemo(() => {
    const values = {}
    districtOptions.forEach(district => {
      const record = epiByDistrictKey.get(normalizeDistrictName(district.epiName)) || null
      values[district.id] = record ? record[filters.epi] : null
    })
    return values
  }, [districtOptions, epiByDistrictKey, filters.epi])

  function handleFilter(partial) {
    if (Object.prototype.hasOwnProperty.call(partial, 'districtId')) setSelectedMo(null)
    setFilters(prev => ({ ...prev, ...partial }))
  }

  function handleSelectDistrict(districtId) {
    setSelectedMo(null)
    setFilters(prev => ({ ...prev, districtId }))
  }

  function handleSelectMo(name) {
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

  const selectedEpiIndicator = epiPayload.indicators.find(item => item.id === filters.epi) || epiPayload.indicators[0]

  function handleDataRefresh() {
    setDataVersion(prev => prev + 1)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <TopBar year={filters.year} quarter={filters.quarter} onAdminClick={() => setAdminOpen(true)} />
      <KPICards indicators={epiPayload.indicators} areaEpiRecord={areaEpiRecord} selectedEpi={filters.epi} onSelectEpi={epi => handleFilter({ epi })} />
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        <LeftPanel filters={filters} layers={layers} years={meta.years} quarters={meta.quarters} districts={districtOptions} epiIndicators={epiPayload.indicators} onFilter={handleFilter} onLayer={partial => setLayers(prev => ({ ...prev, ...partial }))} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <MapViewV2 geoData={geoData} moData={currentMoData} filters={filters} layers={layers} selectedMo={selectedMo} selectedDistrictId={filters.districtId} selectedEpiIndicator={selectedEpiIndicator} epiValueByDistrictId={epiValueByDistrictId} onSelectDistrict={handleSelectDistrict} onSelectMo={handleSelectMo} />
          <TrendPanelV2 year={filters.year} quarter={filters.quarter} selectedDistrict={selectedDistrict} areaEpiRecord={areaEpiRecord} districtEpiRecord={districtEpiRecord} selectedEpiIndicator={selectedEpiIndicator} epiIndicators={epiPayload.indicators} epiRows={periodEpiRows} epiHistory={epiPayload.data} districtOptions={districtOptions} currentMoData={currentMoData} screeningHistory={screeningData} selectedMo={selectedMo} selectedIndicator={filters.screenInd} screenType={filters.screen} onSelectMo={handleSelectMo} />
        </div>
        <ContextPanel selectedDistrict={selectedDistrict} selectedMoRecord={selectedMoRecord} screenType={filters.screen} districtEpiRecord={districtEpiRecord} epiIndicators={epiPayload.indicators} year={filters.year} quarter={filters.quarter} />
      </div>
      <AdminPanel open={adminOpen} onClose={() => setAdminOpen(false)} onRefresh={handleDataRefresh} />
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />)
