import {describe, expect, test, vi, beforeEach, afterEach} from 'vitest'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import {
  cleanInstallation,
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

describe('cleanInstallation', () => {
  let tempDir = ''

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'setup-v-clean-'))
  })

  afterEach(() => {
    if (tempDir) {
      fs.rmSync(tempDir, {recursive: true, force: true})
    }
  })

  function mockVInstallation(dir: string): void {
    const nonEssentialDirs = [
      'examples',
      'tests',
      'test',
      'benchmarks',
      'bench',
      'doc',
      'ci',
      '.github',
      '.git'
    ]
    for (const sub of nonEssentialDirs) {
      const subDir = path.join(dir, sub)
      fs.mkdirSync(subDir, {recursive: true})
      fs.writeFileSync(path.join(subDir, 'stub.txt'), 'stub')
    }

    const nonEssentialFiles = [
      'CHANGELOG.md',
      'CONTRIBUTING.md',
      'README.md',
      'CODE_OF_CONDUCT.md'
    ]
    for (const file of nonEssentialFiles) {
      fs.writeFileSync(path.join(dir, file), 'stub')
    }

    const essentialDirs = ['vlib', 'cmd', 'thirdparty']
    for (const sub of essentialDirs) {
      const subDir = path.join(dir, sub)
      fs.mkdirSync(subDir, {recursive: true})
      fs.writeFileSync(path.join(subDir, 'stub.txt'), 'stub')
    }

    const essentialFiles = [
      'v',
      'v.mod',
      'GNUmakefile',
      'makev.bat',
      'make.bat'
    ]
    for (const file of essentialFiles) {
      fs.writeFileSync(path.join(dir, file), 'stub')
    }
  }

  test('removes non-essential directories', () => {
    mockVInstallation(tempDir)

    cleanInstallation(tempDir)

    for (const dir of [
      'examples',
      'tests',
      'test',
      'benchmarks',
      'bench',
      'doc',
      'ci',
      '.github',
      '.git'
    ]) {
      expect(fs.existsSync(path.join(tempDir, dir))).toBe(false)
    }
  })

  test('removes non-essential files', () => {
    mockVInstallation(tempDir)

    cleanInstallation(tempDir)

    for (const file of [
      'CHANGELOG.md',
      'CONTRIBUTING.md',
      'README.md',
      'CODE_OF_CONDUCT.md'
    ]) {
      expect(fs.existsSync(path.join(tempDir, file))).toBe(false)
    }
  })

  test('keeps essential files and directories', () => {
    mockVInstallation(tempDir)

    cleanInstallation(tempDir)

    expect(fs.existsSync(getVExecutable(tempDir))).toBe(true)
    expect(fs.existsSync(path.join(tempDir, 'vlib'))).toBe(true)
    expect(fs.existsSync(path.join(tempDir, 'cmd'))).toBe(true)
    expect(fs.existsSync(path.join(tempDir, 'thirdparty'))).toBe(true)
    expect(fs.existsSync(path.join(tempDir, 'v.mod'))).toBe(true)
    expect(fs.existsSync(path.join(tempDir, 'GNUmakefile'))).toBe(true)
    expect(fs.existsSync(path.join(tempDir, 'makev.bat'))).toBe(true)
    expect(fs.existsSync(path.join(tempDir, 'make.bat'))).toBe(true)
  })

  test('keeps essential file contents intact', () => {
    mockVInstallation(tempDir)

    cleanInstallation(tempDir)

    expect(
      fs.readFileSync(path.join(tempDir, 'vlib', 'stub.txt'), 'utf8')
    ).toBe('stub')
    expect(fs.readFileSync(path.join(tempDir, 'cmd', 'stub.txt'), 'utf8')).toBe(
      'stub'
    )
  })

  test('does not throw when install dir has nothing to clean', () => {
    fs.writeFileSync(path.join(tempDir, 'v'), 'stub')
    fs.mkdirSync(path.join(tempDir, 'vlib'), {recursive: true})

    expect(() => cleanInstallation(tempDir)).not.toThrow()
    expect(fs.existsSync(getVExecutable(tempDir))).toBe(true)
    expect(fs.existsSync(path.join(tempDir, 'vlib'))).toBe(true)
  })

  test('is idempotent', () => {
    mockVInstallation(tempDir)

    expect(() => {
      cleanInstallation(tempDir)
      cleanInstallation(tempDir)
    }).not.toThrow()
  })
})
