// @vitest-environment jsdom

import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useTranslation } from './LanguageContext'

describe('useTranslation without provider', () => {
  it('keeps the translator identity across rerenders', () => {
    const { result, rerender } = renderHook(() => useTranslation())
    const first = result.current
    rerender()
    expect(result.current).toBe(first)
  })
})
