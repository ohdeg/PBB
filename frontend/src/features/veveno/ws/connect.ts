import { applyWsEvent, resetVevenoWsLive } from './live'
import type { VevenoWsEvent } from '../../../types/veveno'

const MAX_BACKOFF_MS = 15_000

let socket: WebSocket | null = null
let backoffMs = 1000
let stopped = true
let timer = 0
let getToken: () => string | null = () => null
let onAlert: ((kind: 'posOpen' | 'ownerDone' | 'noticeCreated', event: VevenoWsEvent) => void) | null =
  null

function wsUrl(): string {
  const base = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080'
  const url = new URL('/api/v1/veveno/ws', base.endsWith('/') ? base : `${base}/`)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  return url.toString()
}

function connect(): void {
  if (stopped) {
    return
  }
  const token = getToken()
  if (!token) {
    return
  }
  const next = new WebSocket(wsUrl())
  socket = next
  next.addEventListener('open', () => {
    backoffMs = 1000
    next.send(JSON.stringify({ token }))
  })
  next.addEventListener('message', (message) => {
    if (typeof message.data !== 'string') {
      return
    }
    try {
      const event = JSON.parse(message.data) as VevenoWsEvent
      const alert = applyWsEvent(event)
      if (alert) {
        onAlert?.(alert, event)
      }
    } catch {
      /* ignore bad frames */
    }
  })
  next.addEventListener('close', () => {
    if (socket === next) {
      socket = null
    }
    if (stopped) {
      return
    }
    window.clearTimeout(timer)
    timer = window.setTimeout(() => {
      backoffMs = Math.min(MAX_BACKOFF_MS, backoffMs * 2)
      connect()
    }, backoffMs)
  })
}

export function startVevenoWs(
  tokenFn: () => string | null,
  alertFn: (kind: 'posOpen' | 'ownerDone' | 'noticeCreated', event: VevenoWsEvent) => void,
): void {
  getToken = tokenFn
  onAlert = alertFn
  if (!stopped && socket) {
    return
  }
  stopped = false
  backoffMs = 1000
  connect()
}

export function stopVevenoWs(): void {
  stopped = true
  window.clearTimeout(timer)
  onAlert = null
  socket?.close()
  socket = null
  resetVevenoWsLive()
}
