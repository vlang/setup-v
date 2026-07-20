import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest'
import * as cp from 'child_process'

const {mockFsExistsSync, mockFsReadFileSync} = vi.hoisted(() => ({
  mockFsExistsSync: vi.fn(() => false),
  mockFsReadFileSync: vi.fn(() => '')
}))

vi.mock('fs', () => ({
  existsSync: mockFsExistsSync,
  readFileSync: mockFsReadFileSync
}))

type ExecCb = (err: Error | null, res?: {stdout: string; stderr: string}) => void

vi.mock('@actions/core', () => ({
  getInput: vi.fn(() => ''),
  setFailed: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
  addPath: vi.fn(),
  setOutput: vi.fn(),
  exportVariable: vi.fn(),
  saveState: vi.fn(),
  getState: vi.fn(() => '')
}))
vi.mock('@actions/cache', () => ({restoreCache: vi.fn(), saveCache: vi.fn()}))
vi.mock('@actions/tool-cache', () => ({cacheDir: vi.fn()}))
vi.mock('./installer', () => ({
  getVlang: vi.fn(async () => '/tmp/vlang'),
  getInstallDir: vi.fn(() => '/tmp/vlang'),
  getVExecutable: vi.fn(() => '/tmp/vlang/v')
}))
vi.mock('./state-helper', () => ({IS_POST: true}))
vi.mock('child_process', () => ({
  exec: vi.fn((_cmd: string, cb: ExecCb) =>
    cb(null, {stdout: 'V 0.4.4 abc123', stderr: ''})
  ),
  execSync: vi.fn()
}))

import * as core from '@actions/core'
import * as cache from '@actions/cache'
import {parseVersionFile, strToBoolean, getVersion, resolveVersionInput, run} from './main'
import type {Mock} from 'vitest'

const execMock = cp.exec as unknown as Mock
const getInputMock = core.getInput as unknown as Mock
const restoreCacheMock = cache.restoreCache as unknown as Mock

describe('parseVersionFile', () => {
  it('strips a leading v', () => {
    expect(parseVersionFile('v0.4.4')).toBe('0.4.4')
  })
  it('trims surrounding whitespace', () => {
    expect(parseVersionFile('  0.4.4\n')).toBe('0.4.4')
  })
  it('keeps non-v-prefixed versions', () => {
    expect(parseVersionFile('weekly.2024.06')).toBe('weekly.2024.06')
  })
})

describe('strToBoolean', () => {
  it('treats true-ish strings as true (case-insensitive)', () => {
    for (const v of ['true', 'TRUE', 'yes', 'Yes', '1']) {
      expect(strToBoolean(v)).toBe(true)
    }
  })
  it('treats false-ish strings (and empty) as false', () => {
    for (const v of ['false', 'no', '0', '', 'undefined', 'null']) {
      expect(strToBoolean(v)).toBe(false)
    }
  })
})

describe('getVersion', () => {
  it('parses the version token from `v version` output', async () => {
    expect(await getVersion('/tmp/vlang/v')).toBe('0.4.4')
  })
  it('throws when stderr is present', async () => {
    execMock.mockImplementation((_cmd: string, cb: ExecCb) =>
      cb(null, {stdout: '', stderr: 'boom'})
    )
    await expect(getVersion('/tmp/vlang/v')).rejects.toThrow()
  })
})

describe('resolveVersionInput', () => {
  beforeEach(() => {
    getInputMock.mockImplementation(() => '')
    mockFsExistsSync.mockReturnValue(false)
    mockFsReadFileSync.mockReturnValue('')
  })
  it('returns the explicit version', async () => {
    getInputMock.mockImplementation((name: string) =>
      name === 'version' ? '0.5.1' : ''
    )
    expect(await resolveVersionInput()).toBe('0.5.1')
  })
  it('reads the version from a version-file', async () => {
    mockFsExistsSync.mockReturnValueOnce(true)
    mockFsReadFileSync.mockReturnValueOnce('weekly.2024.06\n')
    getInputMock.mockImplementation((name: string) =>
      name === 'version-file' ? '.v-version' : ''
    )
    expect(await resolveVersionInput()).toBe('weekly.2024.06')
  })
})

describe('run', () => {
  beforeEach(() => {
    execMock.mockImplementation((_cmd: string, cb: ExecCb) =>
      cb(null, {stdout: 'V 0.4.4 abc123', stderr: ''})
    )
    getInputMock.mockImplementation(() => '')
    mockFsExistsSync.mockReturnValue(false)
    mockFsReadFileSync.mockReturnValue('')
    restoreCacheMock.mockClear()
  })
  it('restores the cache with a key prefixed by v-<version>', async () => {
    getInputMock.mockImplementation((name: string) =>
      name === 'version' ? '0.5.1' : ''
    )
    await run()
    expect(restoreCacheMock).toHaveBeenCalledWith(
      expect.any(Array),
      expect.stringMatching(/^v-0\.5\.1-/)
    )
  })
})
