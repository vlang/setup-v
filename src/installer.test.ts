import {describe, expect, test, vi, beforeEach, afterEach} from 'vitest'
import * as path from 'path'
import {getVExecutable, resolveVersionRef} from './installer'
import * as githubApiHelper from './github-api-helper'

describe('getVExecutable', () => {
  const platformSpy = vi.spyOn(process, 'platform', 'get')

  afterEach(() => {
    platformSpy.mockReset()
  })

  test('uses v.exe on Windows', () => {
    platformSpy.mockReturnValue('win32')
    expect(getVExecutable('/tmp/vlang')).toBe(path.join('/tmp/vlang', 'v.exe'))
  })

  test('uses v on Unix', () => {
    platformSpy.mockReturnValue('linux')
    expect(getVExecutable('/tmp/vlang')).toBe(path.join('/tmp/vlang', 'v'))
  })
})

describe('resolveVersionRef', () => {
  beforeEach(() => {
    vi.spyOn(githubApiHelper, 'getLatestRelease').mockResolvedValue('0.5.1')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('prefers explicit version', async () => {
    await expect(
      resolveVersionRef('token', 'weekly.2024.01', true, true)
    ).resolves.toBe('weekly.2024.01')
  })

  test('resolves stable release without check-latest', async () => {
    await expect(resolveVersionRef('token', '', false, true)).resolves.toBe(
      '0.5.1'
    )
  })

  test('uses default branch when only check-latest is set', async () => {
    await expect(resolveVersionRef('token', '', true, false)).resolves.toBe('')
  })
})
