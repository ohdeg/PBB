// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { VevenoStoreDeleteDialog } from './VevenoStoreDeleteDialog'
import { VevenoI18nProvider } from '../../features/veveno/i18n/LanguageContext'

afterEach(() => {
  cleanup()
  document.body.innerHTML = ''
})

describe('VevenoStoreDeleteDialog', () => {
  it('enables delete when the typed name matches, including trim', () => {
    const onConfirm = vi.fn()
    render(
      <VevenoI18nProvider locale="ko">
        <div id="root">
          <VevenoStoreDeleteDialog
            open
            storeName="test store"
            onConfirm={onConfirm}
            onCancel={vi.fn()}
          />
        </div>
      </VevenoI18nProvider>,
    )

    expect(screen.getByLabelText('"test store"을(를) 입력하세요')).toBeInTheDocument()
    const del = screen.getByRole('button', { name: '삭제' })
    expect(del).toBeDisabled()

    fireEvent.change(screen.getByLabelText('"test store"을(를) 입력하세요'), {
      target: { value: 'TEST STORE' },
    })
    expect(del).toBeDisabled()

    fireEvent.change(screen.getByLabelText('"test store"을(를) 입력하세요'), {
      target: { value: '  test store  ' },
    })
    expect(del).toBeEnabled()
    fireEvent.click(del)
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })
})
