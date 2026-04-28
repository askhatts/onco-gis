import { useEffect, useState } from 'react'
import type { EpiPayload } from '../types'
import { FALLBACK_EPI_INDICATORS } from '../utils/dashboard'

const EMPTY_PAYLOAD: EpiPayload = {
  indicators: FALLBACK_EPI_INDICATORS,
  data: [],
}

let cache: EpiPayload | null = null
let cacheVersion = -1

export function useEpidemiology(version = 0) {
  const [payload, setPayload] = useState<EpiPayload>(cache ?? EMPTY_PAYLOAD)
  const [loading, setLoading] = useState(!cache || cacheVersion !== version)

  useEffect(() => {
    if (cache && cacheVersion === version) {
      setPayload(cache)
      setLoading(false)
      return
    }

    setLoading(true)
    fetch(`/epidemiology.json?v=${version}`)
      .then(response => response.json())
      .then((data: EpiPayload) => {
        cache = {
          indicators: data.indicators?.length ? data.indicators : FALLBACK_EPI_INDICATORS,
          data: data.data ?? [],
        }
        cacheVersion = version
        setPayload(cache)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [version])

  return { payload, loading }
}
