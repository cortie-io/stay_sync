import type { Metadata, Viewport } from 'next'
import { Gowun_Batang } from 'next/font/google'
import './globals.css'
import { KioskProvider } from '@/lib/kiosk'

// 제목·숫자는 고운바탕(부드러운 세리프), 본문은 프리텐다드(아래 <head>에서 CDN 동적 서브셋으로 불러온다).
const gowunBatang = Gowun_Batang({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-gowun-batang',
  display: 'swap',
  // 한글 글자 묶음이 많아 preload를 켜면 Link 응답 헤더가 ~6KB가 되고, gate nginx 헤더 버퍼를 넘어 502가 난다.
  // 끄면 화면에 필요한 글자 묶음만 그때그때 받는다.
  preload: false,
})

// 한글 글자 묶음별로 필요한 것만 받아 오는 프리텐다드 CSS
const PRETENDARD_CSS =
  'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css'

export const metadata: Metadata = {
  title: 'stay-sync | 경기북부 지역별·월별 인기 관광지 순위',
  description:
    '가평·고양·구리·남양주·동두천·양주·연천·의정부·파주·포천 등 경기북부 10개 지역의 월별 검색량 기반 인기 관광지 순위를 한눈에 확인하세요.',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#ffffff',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ko" className={`bg-background ${gowunBatang.variable}`}>
      <head>
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
        <link rel="stylesheet" href={PRETENDARD_CSS} crossOrigin="anonymous" />
      </head>
      <body className="font-sans antialiased break-keep">
        <KioskProvider>{children}</KioskProvider>
      </body>
    </html>
  )
}
