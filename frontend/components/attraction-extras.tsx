import Link from "next/link"
import { ArrowUpRight, Navigation } from "lucide-react"
import {
  getRegionByName,
  kakaoDirectionsLink,
  kakaoMapLink,
  type AttractionExtras,
  type InfoItem,
  type NearbyPlace,
} from "@/lib/tourism-data"
import { Eyebrow, pad2 } from "@/components/section-heading"
import { SafeImage } from "@/components/safe-image"

// 관광지 상세 페이지의 부가 섹션들 — 이용 안내, 사진, 지도, 주변 장소

function SectionTitle({ id, eyebrow, title }: { id: string; eyebrow: string; title: string }) {
  return (
    <div className="flex flex-col gap-3">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 id={id} className="font-serif text-3xl">
        {title}
      </h2>
    </div>
  )
}

export function AttractionFacts({ extras, address }: { extras: AttractionExtras; address: string | null }) {
  const base: (InfoItem & { href?: string })[] = [
    { label: "유형", value: [extras.contentType, extras.indoorOutdoor].filter(Boolean).join(" · ") },
    { label: "주소", value: [address, extras.zipCode && `(${extras.zipCode})`].filter(Boolean).join(" ") },
    { label: "전화", value: [extras.tel, extras.telName && `(${extras.telName})`].filter(Boolean).join(" ") },
    { label: "홈페이지", value: extras.homepage ?? "", href: extras.homepage ?? undefined },
    { label: "영문명", value: extras.titleEn ?? "" },
  ]
  const rows: (InfoItem & { href?: string })[] = [...base, ...extras.intro, ...extras.info].filter((row) => row.value)
  if (rows.length === 0) return null

  return (
    <section aria-labelledby="facts-heading" className="flex flex-col gap-8 pt-20">
      <SectionTitle id="facts-heading" eyebrow="Information" title="이용 안내" />
      <dl className="grid border-t border-border md:grid-cols-2 md:gap-x-12">
        {rows.map((row, i) => (
          <div
            key={`${row.label}-${i}`}
            className="grid grid-cols-[7rem_1fr] gap-4 border-b border-border py-4 text-sm"
          >
            <dt className="text-muted-foreground">{row.label}</dt>
            <dd className="leading-relaxed whitespace-pre-line [overflow-wrap:anywhere]">
              {row.href ? (
                <a
                  href={row.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="border-b border-foreground/30 transition-colors hover:border-accent hover:text-accent"
                >
                  {row.value}
                </a>
              ) : (
                row.value
              )}
            </dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-muted-foreground">
        출처 · 한국관광공사 TourAPI. 이용시간·요금은 바뀔 수 있으니 방문 전 확인하세요.
      </p>
    </section>
  )
}

export function AttractionGallery({ images, title, fallback }: { images: string[]; title: string; fallback: string }) {
  if (images.length === 0) return null
  return (
    <section aria-labelledby="gallery-heading" className="flex flex-col gap-8 pt-20">
      <SectionTitle id="gallery-heading" eyebrow={`Gallery · ${images.length}`} title="사진" />
      <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {images.map((src, i) => (
          <li key={src}>
            <a
              href={src}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative block aspect-[4/3] overflow-hidden bg-muted"
            >
              <SafeImage
                src={src}
                fallback={fallback}
                alt={`${title} 사진 ${i + 1}`}
                fill
                sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw"
                className="object-cover transition-transform duration-500 group-hover:scale-105"
              />
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function AttractionMap({
  title,
  location,
  address,
}: {
  title: string
  location: { lat: number; lng: number }
  address: string | null
}) {
  const { lat, lng } = location
  const bbox = [lng - 0.012, lat - 0.007, lng + 0.012, lat + 0.007].map((n) => n.toFixed(5)).join(",")
  const embed = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`

  return (
    <section aria-labelledby="map-heading" className="flex flex-col gap-8 pt-20">
      <SectionTitle id="map-heading" eyebrow="Location" title="위치" />
      <div className="relative aspect-[4/3] overflow-hidden border border-border bg-muted md:aspect-[21/9]">
        <iframe
          title={`${title} 위치 지도`}
          src={embed}
          loading="lazy"
          className="absolute inset-0 size-full grayscale-[35%]"
        />
      </div>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        {address && <p className="text-sm text-muted-foreground">{address}</p>}
        <div className="flex flex-wrap gap-3">
          <a
            href={kakaoMapLink(title, lat, lng)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 border border-foreground px-5 py-3 text-sm transition-colors hover:bg-foreground hover:text-background"
          >
            카카오맵에서 보기
            <ArrowUpRight className="size-4" aria-hidden />
          </a>
          <a
            href={kakaoDirectionsLink(title, lat, lng)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-primary px-5 py-3 text-sm text-primary-foreground transition-colors hover:bg-primary/85"
          >
            길찾기
            <Navigation className="size-4" aria-hidden />
          </a>
        </div>
      </div>
    </section>
  )
}

function NearbyList({
  heading,
  places,
  fallback,
  linkToDetail,
  monthIndex,
}: {
  heading: string
  places: NearbyPlace[]
  fallback: string
  linkToDetail: boolean
  monthIndex: number
}) {
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <h3 className="font-serif text-xl">{heading}</h3>
      {places.length === 0 ? (
        <p className="border-t border-border py-6 text-sm text-muted-foreground">15km 안에 등록된 곳이 없어요.</p>
      ) : (
        <ol className="border-t border-border">
          {places.map((place, i) => {
            const regionId = getRegionByName(place.region)?.id
            // 관광지는 우리 상세 페이지로, 맛집·숙소는 카카오맵으로 연결한다.
            const internal = linkToDetail && regionId ? `/attraction/${regionId}/${place.id}?m=${monthIndex}` : null
            const external =
              !internal && place.mapx != null && place.mapy != null
                ? kakaoMapLink(place.title, place.mapy, place.mapx)
                : null
            const content = (
              <>
                <span className="w-5 shrink-0 font-serif text-xs tabular-nums text-muted-foreground">
                  {pad2(i + 1)}
                </span>
                <div className="relative size-12 shrink-0 overflow-hidden bg-muted">
                  <SafeImage
                    src={place.image || fallback}
                    fallback={fallback}
                    alt=""
                    fill
                    sizes="48px"
                    className="object-cover"
                  />
                </div>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-sm transition-colors group-hover:text-accent">{place.title}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {[place.type, `${place.distanceKm}km`].filter(Boolean).join(" · ")}
                  </span>
                </span>
              </>
            )
            const rowClass = "group flex items-center gap-3 border-b border-border py-3"
            return (
              <li key={place.id}>
                {internal ? (
                  <Link href={internal} className={rowClass}>
                    {content}
                  </Link>
                ) : external ? (
                  <a href={external} target="_blank" rel="noopener noreferrer" className={rowClass}>
                    {content}
                  </a>
                ) : (
                  <div className={rowClass}>{content}</div>
                )}
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}

export function NearbyPlaces({ nearby, monthIndex }: { nearby: AttractionExtras["nearby"]; monthIndex: number }) {
  const total = nearby.attractions.length + nearby.restaurants.length + nearby.stays.length
  if (total === 0) return null
  return (
    <section aria-labelledby="nearby-heading" className="flex flex-col gap-8 pt-20">
      <SectionTitle id="nearby-heading" eyebrow="Nearby" title="주변에 함께 가볼 곳" />
      <div className="grid gap-10 md:grid-cols-3 md:gap-8">
        <NearbyList
          heading="관광지"
          places={nearby.attractions}
          fallback="/placeholder.svg"
          linkToDetail
          monthIndex={monthIndex}
        />
        <NearbyList
          heading="맛집"
          places={nearby.restaurants}
          fallback="/placeholder.svg"
          linkToDetail={false}
          monthIndex={monthIndex}
        />
        <NearbyList
          heading="숙소"
          places={nearby.stays}
          fallback="/placeholder.svg"
          linkToDetail={false}
          monthIndex={monthIndex}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        직선거리 기준 · 맛집과 숙소는 카카오맵으로 연결됩니다. 일부 사진은 검색 이미지입니다.
      </p>
    </section>
  )
}
