import { useState } from 'react'
import type { Dispatch, FormEvent, SetStateAction } from 'react'
import { vevenoApi } from '../api/vevenoApi'
import type { VevenoNotice, VevenoStore } from '../types/veveno'
import { getErrorMessage } from '../utils/error'

interface UseVevenoNoticesOptions {
  store: VevenoStore | null
  storeId: string
  setError: Dispatch<SetStateAction<string>>
}

export function useVevenoNotices({
  store,
  storeId,
  setError,
}: UseVevenoNoticesOptions) {
  const [notices, setNotices] = useState<VevenoNotice[]>([])
  const [noticesOpen, setNoticesOpen] = useState(false)
  const [noticeForm, setNoticeForm] = useState({ title: '', body: '' })
  const [editingNoticeId, setEditingNoticeId] = useState<string | null>(null)
  const [savingNotice, setSavingNotice] = useState(false)

  const openNotices = () => {
    setNoticesOpen(true)
    setEditingNoticeId(null)
    setNoticeForm({ title: '', body: '' })
    setError('')
  }

  const closeNotices = () => {
    if (savingNotice) return
    setNoticesOpen(false)
    setEditingNoticeId(null)
    setNoticeForm({ title: '', body: '' })
  }

  const startEditNotice = (notice: VevenoNotice) => {
    setEditingNoticeId(notice.id)
    setNoticeForm({ title: notice.title, body: notice.body })
  }

  const cancelNoticeEdit = () => {
    setEditingNoticeId(null)
    setNoticeForm({ title: '', body: '' })
  }

  const handleSaveNotice = async (event: FormEvent) => {
    event.preventDefault()
    if (!store?.owned) return

    const title = noticeForm.title.trim()
    const body = noticeForm.body.trim()
    if (!title || !body) {
      setError('제목과 본문을 입력해 주세요.')
      return
    }

    setSavingNotice(true)
    setError('')
    try {
      if (editingNoticeId) {
        const { data } = await vevenoApi.updateNotice(editingNoticeId, {
          title,
          body,
        })
        setNotices((current) =>
          current.map((notice) => (notice.id === data.id ? data : notice)),
        )
      } else {
        const { data } = await vevenoApi.createNotice(storeId, { title, body })
        setNotices((current) => [data, ...current])
      }
      setEditingNoticeId(null)
      setNoticeForm({ title: '', body: '' })
    } catch (error: unknown) {
      setError(getErrorMessage(error, '공지 저장에 실패했습니다.'))
    } finally {
      setSavingNotice(false)
    }
  }

  const handleDeleteNotice = async (noticeId: string) => {
    if (!store?.owned || !window.confirm('이 공지를 삭제할까요?')) return

    setSavingNotice(true)
    setError('')
    try {
      await vevenoApi.deleteNotice(noticeId)
      setNotices((current) =>
        current.filter((notice) => notice.id !== noticeId),
      )
      if (editingNoticeId === noticeId) {
        setEditingNoticeId(null)
        setNoticeForm({ title: '', body: '' })
      }
    } catch (error: unknown) {
      setError(getErrorMessage(error, '공지 삭제에 실패했습니다.'))
    } finally {
      setSavingNotice(false)
    }
  }

  return {
    notices,
    setNotices,
    noticesOpen,
    noticeForm,
    setNoticeForm,
    editingNoticeId,
    savingNotice,
    openNotices,
    closeNotices,
    startEditNotice,
    cancelNoticeEdit,
    handleSaveNotice,
    handleDeleteNotice,
  }
}

export function formatVevenoNoticeDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}`
}
