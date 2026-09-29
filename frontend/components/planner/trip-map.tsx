"use client"

import "leaflet/dist/leaflet.css"
import L from "leaflet"
import { Fragment, useEffect, useMemo } from "react"
import { MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from "react-leaflet"
import type { MapPoint } from "@/lib/planner"

// 경기북부 중심
const DEFAULT_CENTER: [number, number] = [37.85, 127.15]

export type MapRoute = { points: MapPoint[]; color?: string; dimmed?: boolean }

function FitToPoints({ points }: { points: MapPoint[] }) {
  const map = useMap()

  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize())
    observer.observe(map.getContainer())
    return () => observer.disconnect()
  }, [map])

  useEffect(() => {
    if (points.length === 0) {
      map.setView(DEFAULT_CENTER, 9)
    } else if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 12)
    } else {
      map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng])), { padding: [32, 32], maxZoom: 13 })
    }
  }, [map, points])

  return null
}

function markerIcon(label: string, color?: string, variant: "stop" | "origin" = "stop") {
  return L.divIcon({
    className: "",
    html: `<div class="trip-marker" data-variant="${variant}" style="${color ? `background:${color}` : ""}">${label}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  })
}

/**
 * points 하나(단일 경로) 또는 routes 여러 개(일자별 경로)를 그린다.
 * 선택하지 않은 날(dimmed)은 옅게 보여 주고, 지도 범위는 강조된 경로에 맞춘다.
 */
export default function TripMap({
  points,
  routes,
  origin,
  interactive = false,
}: {
  points?: MapPoint[]
  routes?: MapRoute[]
  origin?: MapPoint | null
  interactive?: boolean
}) {
  const allRoutes: MapRoute[] = useMemo(() => routes ?? [{ points: points ?? [] }], [routes, points])
  const focusPoints = useMemo(() => {
    const active = allRoutes.filter((r) => !r.dimmed).flatMap((r) => r.points)
    return [...(origin ? [origin] : []), ...(active.length ? active : allRoutes.flatMap((r) => r.points))]
  }, [allRoutes, origin])

  return (
    <MapContainer
      center={DEFAULT_CENTER}
      zoom={9}
      zoomControl={interactive}
      scrollWheelZoom={interactive}
      dragging={interactive}
      doubleClickZoom={interactive}
      attributionControl={interactive}
      className="size-full"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {allRoutes.map((route, r) => {
        const line = [...(origin ? [origin] : []), ...route.points]
        return (
          <Fragment key={r}>
            {line.length > 1 && (
              <Polyline
                positions={line.map((p) => [p.lat, p.lng])}
                pathOptions={{
                  color: route.color ?? "oklch(0.22 0.004 60)",
                  weight: route.dimmed ? 1.5 : 2.5,
                  opacity: route.dimmed ? 0.25 : 0.9,
                  lineCap: "round",
                  dashArray: "1 6",
                }}
              />
            )}
            {route.points.map((p, i) => (
              <Marker
                key={`${r}-${p.id ?? p.name}-${i}`}
                position={[p.lat, p.lng]}
                icon={markerIcon(String(i + 1), route.color)}
                opacity={route.dimmed ? 0.35 : 1}
              >
                <Tooltip direction="top" offset={[0, -12]}>
                  {p.name}
                </Tooltip>
              </Marker>
            ))}
          </Fragment>
        )
      })}
      {origin && (
        <Marker position={[origin.lat, origin.lng]} icon={markerIcon("H", undefined, "origin")}>
          <Tooltip direction="top" offset={[0, -12]}>
            {`출발 · ${origin.name}`}
          </Tooltip>
        </Marker>
      )}
      <FitToPoints points={focusPoints} />
    </MapContainer>
  )
}
