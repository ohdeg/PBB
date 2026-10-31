interface OcrWorker {
  recognize(image: HTMLCanvasElement, options: Record<string, unknown>, output: { text: boolean; blocks: boolean }): Promise<{ data: { text: string } }>
  terminate(): Promise<unknown>
}
export interface TicketOcrEngine {
  createWorker(languages: string[], mode: number, options: {
    workerPath: string; corePath: string; langPath: string
    logger: (message: { status: string }) => void
  }): Promise<OcrWorker>
}
/** The preparation script pins the engine and models; runtime never loads a remote CDN. */
export async function loadTicketOcrEngine(): Promise<TicketOcrEngine> {
  const url = `${import.meta.env.BASE_URL}ocr/tesseract.esm.min.js`
  try { return await import(/* @vite-ignore */ url) as TicketOcrEngine }
  catch { throw new Error('사진 인식 도구를 불러오지 못했습니다. 다시 시도하거나 직접 입력해 주세요.') }
}
