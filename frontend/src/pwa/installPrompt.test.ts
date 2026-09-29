import { describe, expect, it } from 'vitest'
import { shouldShowInstallPrompt } from './installPrompt'

describe('install prompt visibility', () => {
  it('exibe o prompt somente quando o evento existe e o app não está instalado', () => {
    expect(shouldShowInstallPrompt({ hasPrompt: true, isStandalone: false })).toBe(true)
    expect(shouldShowInstallPrompt({ hasPrompt: false, isStandalone: false })).toBe(false)
    expect(shouldShowInstallPrompt({ hasPrompt: true, isStandalone: true })).toBe(false)
  })
})
