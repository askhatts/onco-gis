interface Series {
  values: number[]
  color: string
  label?: string
}

interface Props {
  series: Series[]
  labels?: string[]
  width?: number
  height?: number
  yTickCount?: number
  valueFormatter?: (value: number) => string
}

function formatNumber(value: number) {
  const hasFraction = Math.abs(value % 1) > 0.001
  return value.toLocaleString('ru-RU', {
    minimumFractionDigits: hasFraction ? 1 : 0,
    maximumFractionDigits: hasFraction ? 1 : 0,
  })
}

export function LineChart({
  series,
  labels = [],
  width = 400,
  height = 80,
  yTickCount = 5,
  valueFormatter,
}: Props) {
  const allValues = series.flatMap(item => item.values)
  if (!allValues.length) {
    return <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} />
  }

  const min = Math.min(...allValues)
  const max = Math.max(...allValues)
  const range = max - min || 1
  const tickFormatter = valueFormatter ?? formatNumber
  const pad = { t: 8, b: 22, l: 46, r: 10 }
  const W = width - pad.l - pad.r
  const H = height - pad.t - pad.b
  const yTicks = Math.max(4, yTickCount)

  function toPath(values: number[]) {
    if (values.length < 2) return ''
    const step = W / (values.length - 1)
    const points = values.map((value, index) => `${pad.l + index * step},${pad.t + H - ((value - min) / range) * H}`)
    return `M${points.join(' L')}`
  }

  function toArea(values: number[]) {
    if (values.length < 2) return ''
    const step = W / (values.length - 1)
    const points = values.map((value, index) => `${pad.l + index * step},${pad.t + H - ((value - min) / range) * H}`)
    return `M${points[0]} L${points.join(' L')} L${pad.l + W},${pad.t + H} L${pad.l},${pad.t + H} Z`
  }

  const xTickCount = Math.min(labels.length, 6)
  const xTickStep = labels.length > 1 && xTickCount > 1 ? (labels.length - 1) / (xTickCount - 1) : 0

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
            <text
              x={pad.l - 6}
              y={y + 4}
              textAnchor="end"
              fontSize="11"
              fill="rgba(141,166,188,0.88)"
              fontFamily="IBM Plex Mono"
            >
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

      {xTickCount > 0 &&
        Array.from({ length: xTickCount }, (_, index) => {
          const labelIndex = Math.round(index * xTickStep)
          const x = pad.l + (series[0]?.values.length > 1 ? (labelIndex / (series[0].values.length - 1)) * W : 0)
          return (
            <text key={index} x={x} y={height - 4} textAnchor="middle" fontSize="11" fill="rgba(93,122,148,0.85)" fontFamily="IBM Plex Mono">
              {labels[labelIndex]}
            </text>
          )
        })}
    </svg>
  )
}
