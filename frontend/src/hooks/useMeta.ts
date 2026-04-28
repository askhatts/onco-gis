import { useEffect, useState } from 'react'
import type { MetaData } from '../types'
import { FALLBACK_META } from '../utils/dashboard'

let cache: MetaData | null = null
let cacheVersion = -1

export function useMeta(version = 0) {
  const [meta, setMeta] = useState<MetaData>(cache ?? FALLBACK_META)
  const [loading, setLoading] = useState(!cache || cacheVersion !== version)

  useEffect(() => {
    if (cache && cacheVersion === version) {
      setMeta(cache)
      setLoading(false)
      return
    }

    setLoading(true)
    fetch(`/meta.json?v=${version}`)
      .then(response => response.json())
      .then((data: MetaData) => {
        cache = data
        cacheVersion = version
        setMeta(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [version])

  return { meta, loading }
}
