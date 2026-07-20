const KOREAN_WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'] as const

export function formatLottoDrawnDate(isoOrDate: string | Date): string {
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate
  if (Number.isNaN(d.getTime())) return ''

  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const wd = KOREAN_WEEKDAYS[d.getDay()]

  return `${y}-${m}-${day}(${wd})`
}

export function formatLottoDrawnDateTime(isoOrDate: string | Date): string {
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate
  if (Number.isNaN(d.getTime())) return ''

  const h = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')

  return `${formatLottoDrawnDate(d)} ${h}:${min}`
}
