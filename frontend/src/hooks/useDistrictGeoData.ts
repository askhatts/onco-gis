import { useEffect, useState } from 'react'
import type { DistrictFeatureCollection } from '../types'

let cache: DistrictFeatureCollection | null = null

export function useDistrictGeoData() {
  const [geoData, setGeoData] = useState<DistrictFeatureCollection | null>(cache)
  const [loading, setLoading] = useState(!cache)

  useEffect(() => {
    if (cache) {
      setGeoData(cache)
      setLoading(false)
      return
    }

    setLoading(true)
    fetch('/abay_districts.geojson')
      .then(response => response.json())
      .then((data: DistrictFeatureCollection) => {
        cache = data
        setGeoData(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  return { geoData, loading }
}
