import type { TicketOcrDraft } from '../types/ticketImport'
import { loadTicketOcrEngine } from './ticketOcrEngine'
import { parseLottoTicket } from '../utils/ticketImport'

/** All OCR assets are served by our origin; the image never leaves the browser. */
export async function recognizeTicket(image: HTMLCanvasElement, options: {
  signal: AbortSignal
  onProgress: (message: string) => void
}): Promise<TicketOcrDraft> {
  options.signal.throwIfAborted()
  let worker: Awaited<ReturnType<Awaited<ReturnType<typeof loadTicketOcrEngine>>['createWorker']>> | undefined
  let expired = false
  let timer: ReturnType<typeof setTimeout> | undefined
  let cancel!: () => void
  const stopped = new Promise<never>((_, reject) => {
    cancel = () => { expired = true; reject(new Error('번호 인식이 취소되었습니다.')) }
    timer = setTimeout(() => { expired = true; reject(new Error('인식 시간이 초과되었습니다. 다시 촬영하거나 직접 입력해 주세요.')) }, 45_000)
  })
  options.signal.addEventListener('abort', cancel, { once: true })
  const work = async () => {
    const { createWorker } = await loadTicketOcrEngine()
    if (expired) throw new Error('인식이 종료되었습니다.')
    options.onProgress('인식 도구 준비 중…')
    const base = `${import.meta.env.BASE_URL}ocr`
    const created = await createWorker(['kor','eng'], 1, {
      workerPath: `${base}/worker.min.js`,
      corePath: `${base}/core`,
      langPath: `${base}/lang`,
      logger: (message) => {
        if (!expired && message.status === 'recognizing text') options.onProgress('번호를 읽는 중…')
      },
    })
    if (expired) { await created.terminate(); throw new Error('인식이 종료되었습니다.') }
    worker = created
    const read = async (input: HTMLCanvasElement) => {
      const result = await created.recognize(input, {}, { text: true, blocks: true })
      // Tesseract preserves OCR line boundaries. Never merge physical rows to fill six numbers.
      return parseLottoTicket(result.data.text.split(/\r?\n/))
    }
    const first = await read(image)
    if (expired) throw new Error('인식이 종료되었습니다.')
    if (first.detectedRound && first.rows.length && first.rows.every(r=>!r.needsReview)) return first
    const contrast = document.createElement('canvas')
    contrast.width=image.width; contrast.height=image.height
    try {
      const ctx=contrast.getContext('2d')
      if(!ctx) return first
      ctx.filter='grayscale(1) contrast(1.5)';ctx.drawImage(image,0,0)
      const second = await read(contrast)
      if(expired) throw new Error('인식이 종료되었습니다.')
      // Disagreement is explicit: do not silently prefer one valid-looking digit sequence.
      const rows = second.rows.map(row => {
        const prior=first.rows.find(r=>r.line===row.line)
        return prior && JSON.stringify(prior.values)!==JSON.stringify(row.values)
          ? {...row, values:Array(6).fill(null), needsReview:true} : row
      })
      for(const row of first.rows) if(!rows.some(r=>r.line===row.line)) rows.push({...row,needsReview:true})
      return {...second, detectedRound:first.detectedRound && second.detectedRound!==first.detectedRound ? null:second.detectedRound, rows}
    } finally { contrast.width=0;contrast.height=0 }
  }
  try { return await Promise.race([work(), stopped]) }
  finally {
    expired = true
    clearTimeout(timer)
    options.signal.removeEventListener('abort',cancel)
    if(worker) await worker.terminate()
  }
}
