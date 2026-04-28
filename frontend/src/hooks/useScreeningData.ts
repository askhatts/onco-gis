import { useEffect, useState } from 'react'
import type { MoRecord, ScreenType } from '../types'

const cache: Record<string, MoRecord[]> = {}

const FILE: Record<ScreenType, string> = {
  РМЖ: '/screening_rmzh.json',
  КРР: '/screening_krr.json',
  РШМ: '/screening_rshm.json',
}

export function useScreeningData(type: ScreenType, version = 0) {
  const cacheKey = `${type}:${version}`
  const [data, setData] = useState<MoRecord[]>(cache[cacheKey] ?? [])
  const [loading, setLoading] = useState(!cache[cacheKey])

  useEffect(() => {
    if (cache[cacheKey]) {
      setData(cache[cacheKey])
      setLoading(false)
      return
    }

    setLoading(true)
    fetch(`${FILE[type]}?v=${version}`)
      .then(response => response.json())
      .then((rows: MoRecord[]) => {
        cache[cacheKey] = rows
        setData(rows)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [cacheKey, type, version])

  return { data, loading }
}
