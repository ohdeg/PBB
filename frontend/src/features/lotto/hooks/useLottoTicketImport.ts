import { useEffect, useRef, useState } from 'react'
import { recognizeTicket } from '../services/ticketOcr'
import { FULL_TICKET_CROP, prepareTicketImage, validateTicketImage, type TicketCrop } from '../utils/prepareTicketImage'

/** Owns temporary image URLs and cancellable OCR; no persistence or network upload. */
export function useLottoTicketImport() {
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [rotation, setRotation] = useState(0)
  const [crop, setCrop] = useState<TicketCrop>({ ...FULL_TICKET_CROP })
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')
  const controller = useRef<AbortController | null>(null)
  const url = useRef('')
  const cancel = () => { controller.current?.abort(); controller.current = null; setBusy(false) }
  useEffect(() => () => { controller.current?.abort(); controller.current=null; if(url.current) URL.revokeObjectURL(url.current) }, [])
  const select = (next: File) => {
    cancel(); setError('')
    try {
      validateTicketImage(next)
      if(url.current) URL.revokeObjectURL(url.current)
      url.current=URL.createObjectURL(next)
      setFile(next);setPreviewUrl(url.current);setRotation(0);setCrop({...FULL_TICKET_CROP})
      return true
    } catch(error) { setError(error instanceof Error?error.message:'사진을 열지 못했습니다.');return false }
  }
  const recognize = async () => {
    if(!file) return null
    cancel()
    const job=new AbortController();controller.current=job
    setBusy(true);setError('');setProgress('사진을 준비하는 중…')
    let canvas: HTMLCanvasElement | undefined
    try {
      canvas=await prepareTicketImage(file,{rotation,crop},job.signal)
      const draft=await recognizeTicket(canvas,{signal:job.signal,onProgress:setProgress})
      job.signal.throwIfAborted()
      return draft
    } catch(error) {
      if(!job.signal.aborted) setError(error instanceof Error?error.message:'사진 인식에 실패했습니다. 다시 촬영하거나 직접 입력해 주세요.')
      return null
    } finally {
      if(canvas) {canvas.width=0;canvas.height=0}
      if(controller.current===job) {controller.current=null;setBusy(false)}
    }
  }
  const clearImage = () => {
    cancel();setFile(null);setPreviewUrl('')
    if(url.current) URL.revokeObjectURL(url.current)
    url.current=''
  }
  return {file,previewUrl,rotation,setRotation,crop,setCrop,busy,progress,error,select,recognize,cancel,clearImage}
}
