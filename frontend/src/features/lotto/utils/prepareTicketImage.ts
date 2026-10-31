export interface TicketCrop { left: number; top: number; right: number; bottom: number }
export const FULL_TICKET_CROP: TicketCrop = { left: 0, top: 0, right: 100, bottom: 100 }
export function validateTicketImage(file: { size: number; type: string }) {
  if (!['image/jpeg','image/png','image/webp'].includes(file.type)) throw new Error('JPEG, PNG, WebP 사진을 선택해 주세요. HEIC 사진은 JPEG로 변환해 주세요.')
  if (!file.size || file.size > 15*1024*1024) throw new Error('15MB 이하의 사진을 선택해 주세요.')
}
export function ticketImageSize(w: number, h: number, rotation: number, crop: TicketCrop) {
  if (w < 1 || h < 1 || w*h > 25_000_000) throw new Error('2,500만 픽셀 이하의 사진을 선택해 주세요.')
  if (![0,90,180,270].includes(rotation) || Object.values(crop).some(n=>!Number.isFinite(n)||n<0||n>100) || crop.right<=crop.left || crop.bottom<=crop.top) throw new Error('사진 영역을 확인해 주세요.')
  const rw = rotation%180 ? h:w, rh=rotation%180 ? w:h
  const sx=rw*crop.left/100, sy=rh*crop.top/100, sw=rw*(crop.right-crop.left)/100, sh=rh*(crop.bottom-crop.top)/100
  const scale=Math.min(1,2048/Math.max(sw,sh))
  return {rw,rh,sx,sy,sw,sh,width:Math.max(1,Math.round(sw*scale)),height:Math.max(1,Math.round(sh*scale))}
}
/** File decoding ignores filenames; decode failure rejects spoofed MIME or corrupt files. */
export async function prepareTicketImage(file: File, options: { rotation: number; crop: TicketCrop }, signal: AbortSignal): Promise<HTMLCanvasElement> {
  validateTicketImage(file)
  signal.throwIfAborted()
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  let rotated: HTMLCanvasElement | undefined
  try {
    signal.throwIfAborted()
    const s=ticketImageSize(bitmap.width,bitmap.height,options.rotation,options.crop)
    rotated=document.createElement('canvas'); rotated.width=s.rw; rotated.height=s.rh
    const ctx=rotated.getContext('2d'); if(!ctx) throw new Error('사진을 처리할 수 없습니다. 다른 사진이나 직접 입력을 이용해 주세요.')
    ctx.translate(s.rw/2,s.rh/2); ctx.rotate(options.rotation*Math.PI/180); ctx.drawImage(bitmap,-bitmap.width/2,-bitmap.height/2)
    const canvas=document.createElement('canvas'); canvas.width=s.width; canvas.height=s.height
    const output=canvas.getContext('2d'); if(!output) throw new Error('사진을 처리할 수 없습니다.')
    output.fillStyle='white'; output.fillRect(0,0,s.width,s.height)
    output.drawImage(rotated,s.sx,s.sy,s.sw,s.sh,0,0,s.width,s.height)
    return canvas
  } finally { bitmap.close(); if(rotated) {rotated.width=0;rotated.height=0} }
}
