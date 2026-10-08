import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// 한글은 자간을 넓히면 글자가 낱낱이 흩어져 읽기 어렵다 — 한글이 들어간 작은 라벨은 자간을 좁힌다(영문 대문자 라벨은 그대로)
function plainText(node: unknown): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(plainText).join('')
  return ''
}
export function koTracking(text: unknown) {
  return /[가-힣]/.test(plainText(text)) ? 'tracking-[0.04em]' : ''
}
