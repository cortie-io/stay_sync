import { redirect } from "next/navigation"

// 예전 전시 화면 주소 — 원래 사이트의 전시 모드로 보낸다.
export default function KioskPage() {
  redirect("/?kiosk=1")
}
