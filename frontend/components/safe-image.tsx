"use client"

import { useState } from "react"
import Image, { type ImageProps } from "next/image"

// 외부 사진(TourAPI·검색 이미지)은 링크가 깨지거나 핫링크가 막힐 수 있어, 실패하면 대체 이미지로 바꾼다.
export function SafeImage({ src, fallback, alt, ...props }: ImageProps & { src: string; fallback: string }) {
  const [failed, setFailed] = useState(false)
  return <Image {...props} alt={alt} src={failed || !src ? fallback : src} onError={() => setFailed(true)} />
}
