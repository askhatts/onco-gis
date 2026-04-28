function pointInRing(point: [number, number], ring: number[][]): boolean {
  const [x, y] = point
  let inside = false

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    const intersects =
      yi > y !== yj > y &&
      x < ((xj - xi) * (y - yi)) / ((yj - yi) || 1e-9) + xi

    if (intersects) {
      inside = !inside
    }
  }

  return inside
}

function pointInPolygon(point: [number, number], polygon: number[][][]): boolean {
  if (!polygon.length || !pointInRing(point, polygon[0])) {
    return false
  }

  for (let i = 1; i < polygon.length; i += 1) {
    if (pointInRing(point, polygon[i])) {
      return false
    }
  }

  return true
}

export function pointInGeometry(point: [number, number], geometry: GeoJSON.Geometry): boolean {
  if (geometry.type === 'Polygon') {
    return pointInPolygon(point, geometry.coordinates as number[][][])
  }

  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.some(polygon => pointInPolygon(point, polygon as number[][][]))
  }

  return false
}
