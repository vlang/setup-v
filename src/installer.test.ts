import {describe, expect, test, vi, beforeEach, afterEach} from 'vitest'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import {
  getInstallDir,
  getVExecutable,
  getWindowsBuildCommand,
  resolveVersionRef
} from './installer'
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

describe('getInstallDir', () => {
  function expectedDefaultDir(arch: string = os.arch()): string {
    const platformMap: Record<string, string> = {
      darwin: 'macos',
      win32: 'windows'
    }
    const osArch = platformMap[arch] || arch
    return path.join(os.homedir(), 'vlang', `vlang_${os.platform()}_${osArch}`)
  }

  test('returns the default path when no custom path is provided', () => {
    expect(getInstallDir()).toBe(expectedDefaultDir())
  })

  test('returns the custom path when provided', () => {
    expect(getInstallDir('x64', '/opt/v')).toBe('/opt/v')
  })

  test('resolves a relative custom path to an absolute path', () => {
    const result = getInstallDir('x64', 'custom-v')
    expect(path.isAbsolute(result)).toBe(true)
  })

  test('ignores the custom path when it is an empty string', () => {
    expect(getInstallDir('x64', '')).toBe(expectedDefaultDir('x64'))
  })
})

describe('getWindowsBuildCommand', () => {
  let tempDir = ''

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'setup-v-'))
  })

  afterEach(() => {
    if (tempDir) {
      fs.rmSync(tempDir, {recursive: true, force: true})
    }
  })

  test('prefers makev.bat when present (MSVC by default)', () => {
    fs.writeFileSync(path.join(tempDir, 'makev.bat'), '@echo off')
    fs.writeFileSync(path.join(tempDir, 'make.bat'), '@echo off')

    expect(getWindowsBuildCommand(tempDir)).toBe('.\\makev.bat')
  })

  test('uses makev.bat with -gcc when useGcc is true', () => {
    fs.writeFileSync(path.join(tempDir, 'makev.bat'), '@echo off')
    fs.writeFileSync(path.join(tempDir, 'make.bat'), '@echo off')

    expect(getWindowsBuildCommand(tempDir, true)).toBe('.\\makev.bat -gcc')
  })

  test('falls back to make.bat for older releases (MSVC by default)', () => {
    fs.writeFileSync(path.join(tempDir, 'make.bat'), '@echo off')

    expect(getWindowsBuildCommand(tempDir)).toBe('.\\make.bat')
  })

  test('falls back to make.bat with -gcc when useGcc is true', () => {
    fs.writeFileSync(path.join(tempDir, 'make.bat'), '@echo off')

    expect(getWindowsBuildCommand(tempDir, true)).toBe('.\\make.bat -gcc')
  })

  test('throws when no build script exists', () => {
    expect(() => getWindowsBuildCommand(tempDir)).toThrow(
      'No Windows build script found'
    )
  })
})
