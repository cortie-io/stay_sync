"use client"

import dynamic from "next/dynamic"

// Leaflet은 window가 필요해 서버 렌더링에서 뺀다.
export const LazyMap = dynamic(() => import("./trip-map"), {
  ssr: false,
  loading: () => <div className="size-full animate-pulse bg-muted" aria-hidden />,
})
