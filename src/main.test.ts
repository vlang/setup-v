import { describe, it, expect, vi, beforeEach } from 'vitest'

// -----------------------------------------------------------------------------
//  Mocks – must be defined before importing the module under test
// -----------------------------------------------------------------------------

const mockCore = {
  getInput: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
  setOutput: vi.fn(),
  setFailed: vi.fn(),
  addPath: vi.fn(),
  saveState: vi.fn(),
}

const mockCache = {
  restoreCache: vi.fn(),
  saveCache: vi.fn(),
}

const mockTc = {
  cacheDir: vi.fn(),
}

const mockFs = {
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}

const mockInstaller = {
  getInstallDir: vi.fn(),
  getVExecutable: vi.fn(),
  getVlang: vi.fn(),
}

vi.mock('@actions/core', () => ({ default: mockCore, ...mockCore }))
vi.mock('@actions/cache', () => ({ default: mockCache, ...mockCache }))
vi.mock('@actions/tool-cache', () => ({ default: mockTc, ...mockTc }))
vi.mock('fs', () => ({ default: mockFs, ...mockFs }))
vi.mock('./installer', () => ({ default: mockInstaller, ...mockInstaller }))

// Mock state-helper so that IS_POST is false (the "run" path)
vi.mock('./state-helper', () => ({
  IS_POST: false,
}))

// Now import the module under test
import * as main from './main'

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
  // Default mocks for common calls
  mockCore.getInput.mockImplementation((name: string) => {
    if (name === 'cache') return 'true'
    if (name === 'version') return ''
    if (name === 'version-file') return ''
    if (name === 'architecture') return ''
    if (name === 'path') return ''
    if (name === 'token') return 'mock-token'
    if (name === 'stable') return 'false'
    if (name === 'check-latest') return 'false'
    if (name === 'clean') return 'true'
    return ''
  })
  mockInstaller.getVExecutable.mockImplementation((dir: string) => `${dir}/v`)
  mockInstaller.getInstallDir.mockReturnValue('/mock/install/dir')
  mockInstaller.getVlang.mockResolvedValue('/mock/v/bin')
  mockTc.cacheDir.mockResolvedValue('/mock/cached/v')
  mockCache.restoreCache.mockResolvedValue(undefined) // cache miss by default
  // Default: no version file
  mockFs.existsSync.mockReturnValue(false)
})

// -----------------------------------------------------------------------------
// Tests: parseVersionFile
// -----------------------------------------------------------------------------

describe('parseVersionFile()', () => {
  it('trims whitespace', () => {
    expect((main as any).parseVersionFile('  0.2.0  ')).toBe*('0.2.0')
  })

  it('strips leading "v" when version starts with v<digit>', () => {
    expect((main as any).parseVersionFile('v0.2.0')).toBe('0.2.0')
  })

  it('does NOT strip leading "v" if not followed by a digit', () => {
    expect((main as any).parseVersionFile('version-1.0.0')).toBe('version-1.0.0')
  })

  it('handles empty string', () => {
    expect((main as any).parseVersionFile('')).toBe*('')
  })

  it('handles version with newlines', () => {
    expect((main as any).parseVersionFile('\nv0.5.0\n')).toBe('0.5.0')
  })

  it('strips "v" from "v1.2.3-rc1"', () => {
    expect((main as any).parseVersionFile('v1.2.3-rc1')).toBe('1.2.3-rc1')
  })
})

// -----------------------------------------------------------------------------
// Tests: strToBoolean
// -----------------------------------------------------------------------------

describe('strToBoolean()', () => {
  it('returns true for "true"', () => {
    expect((main as any).strToBoolean('true')).toBe(true)
  })

  it('returns true for "yes"', () => {
    expect((main as any).strToBoolean('yes')).toBe(true)
  })

  it('returns true for "1"', () => {
    expect((main as any).strToBoolean('1')).toBe(true)
  })

  it('returns true for any non-falsy string', () => {
    expect((main as any).strToBoolean('TRUE')).toBe(true)
  })

  it('returns false for "false"', () => {
    expect((main as any).strToBoolean('false')).toBe(false)
  })

  it('returns false for "no"', () => {
    expect((main as any).strToBoolean('no')).toBe(false)
  })

  it('returns false for "0"', () => {
    expect((main as any).strToBoolean('0')).toBe(false)
  })

  it('returns false for empty string', () => {
    expect((main as any).strToBoolean('')).toBe(false)
  })

  it('returns false for "undefined"', () => {
    expect((main as any).strToBoolean('undefined')).toBe(false)
  })

  it('returns false for "null"', () => {
    expect((main as any).strToBoolean('null')).toBe(false)
  })

  it('handles case-insensitivity', () => {
    expect((main as any).strToBoolean('False')).toBe(false)
    expect((main as any).strToBoolean('NO')).toBe(false)
    expect((main as any).strToBoolean('Null')).toBe(false)
  })
})

// -----------------------------------------------------------------------------
// Tests: getVersion
// -----------------------------------------------------------------------------

describe('getVersion()', () => {
  beforeEach(() => {
    mockInstaller.getVExecutable.mockReturnValue('/mock/v/bin/v')
  })

  it('parses version from "V 0.6.3" output', async () => {
    const execerMock = vi.spyOn(main, 'execer').mockResolvedValue({
      stdout: 'V 0.6.3\n',
      stderr: '',
    } as any)

    const result = await (main as any).getVersion('/mock/v/bin')
    expect(result).toBe('0.6.3')
    expect(execerMock).toHaveBeenCalledWith('"/mock/v/bin/v" version')
  })

  it('parses version from "V 0.5.0-rc2" output', async () => {
    const execerMock = vi.spyOn(main, 'execer').mockResolvedValue({
      stdout: 'V 0.5.0-rc2\n',
      stderr: '',
    } as any)

    const result = await (main as any).getVersion('/mock/v/bin')
    expect(result).toBe('0.5.0-rc2')
  })

  it('throws when stderr is non-empty', async () => {
    vi.spyOn(main, 'execer').mockResolvedValue({
      stdout: '',
      stderr: 'command not found',
    } as any)

    await expect((main as any).getVersion('/mock/v/bin')).rejects.toThrow(
      'Unable to get version from /mock/v/bin/v'
    )
  })

  it('returns "0.0.0" when stdout is empty but no stderr', async () => {
    vi.spyOn(main, 'execer').mockResolvedValue({
      stdout: '',
      stderr: '',
    } as any)

    const result = await (main as any).getVersion('/mock/v/bin')
    expect(result).toBe('0.0.0')
    expect(mockCore.warning).toHaveBeenCalledWith(
      'Unable to get version from v executable.'
    )
  })
})

// -----------------------------------------------------------------------------
// Tests: resolveVersionInput
// -----------------------------------------------------------------------------

describe('resolveVersionInput()', () => {
  it('returns version from input when no version-file', () => {
    mockCore.getInput.mockImplementation((name: string) => {
      if (name === 'version') return '0.6.3'
      if (name === 'version-file') return ''
      return ''
    })

    const result = (main as any).resolveVersionInput()
    expect(result).toBe('0.6.3')
  })

  it('reads version from version-file when specified', () => {
    mockCore.getInput.mockImplementation((name: string) => {
      if (name === 'version') return ''
      if (name === 'version-file') return '.v-version'
      return ''
    })
    process.env.GITHUB_WORKSPACE = '/workspace'
    mockFs.existsSync.mockReturnValue(true)
    mockFs.readFileSync.mockReturnValue('v0.7.0\n')

    const result = (main as any).resolveVersionInput()
    expect(result).toBe('0.7.0')
    expect(mockFs.readFileSync).toHaveBeenCalledWith('/workspace/.v-version', 'utf8')
  })

  it('throws when version-file does not exist', () => {
    mockCore.getInput.mockImplementation((name: string) => {
      if (name === 'version') return ''
      if (name === 'version-file') return '.v-version'
      return ''
    })
    process.env.GITHUB_WORKSPACE = '/workspace'
    mockFs.existsSync.mockReturnValue(false)

    expect(() => (main as any).resolveVersionInput()).toThrow(
      'The specified v version file at: /workspace/.v-version does not exist'
    )
  })

  it('warns when both version and version-file are specified, uses version', () => {
    mockCore.getInput.mockImplementation((name: string) => {
      if (name === 'version') return '0.8.0'
      if (name === 'version-file') return '.v-version'
      return ''
    })

    const result = (main as any).resolveVersionInput()
    expect(result).toBe('0.8.0')
    expect(mockCore.warning).toHaveBeenCalledWith(
      'Both version and version-file inputs are specified, only version will be used'
    )
  })

  it('strips "v" prefix from version-file contents', () => {
    mockCore.getInput.mockImplementation((name: string) => {
      if (name === 'version') return ''
      if (name === 'version-file') return '.v-version'
      return ''
    })
    process.env.GITHUB_WORKSPACE = '/workspace'
    mockFs.existsSync.mockReturnValue(true)
    mockFs.readFileSync.mockReturnValue('v0.9.0')

    const result = (main as any).resolveVersionInput()
    expect(result).toBe('0.9.0')
  })
})

// -----------------------------------------------------------------------------
// Tests: Cache key generation (in run function)
// -----------------------------------------------------------------------------

describe('Cache key generation', () => {
  beforeEach(() => {
    mockCore.getInput.mockImplementation((name: string) => {
      if (name === 'version') return '0.6.3'
      if (name === 'cache') return 'true'
      if (name === 'token') return 'mock-token'
      if (name === 'architecture') return 'x64'
      if (name === 'path') return ''
      if (name === 'stable') return 'false'
      if (name === 'check-latest') return 'false'
      if (name === 'clean') return 'true'
      return ''
    })
    mockInstaller.getInstallDir.mockReturnValue('/mock/install/dir')
    mockInstaller.getVExecutable.mockImplementation((dir: string) => `${dir}/v`)
    mockInstaller.getVlang.mockResolvedValue('/mock/v/bin')
    mockTc.cacheDir.mockResolvedValue('/mock/cached/v')
  })

  it('generates cache key with version-platform-arch format', async () => {
    mockCache.restoreCache.mockResolvedValue(undefined)
    vi.spyOn(main, 'execer').mockResolvedValue({
      stdout: 'V 0.6.3\n',
      stderr: '',
    } as any)

    await (main as any).run()

    expect(mockCache.restoreCache).toHaveBeenCalledWith(
      ['/mock/install/dir'],
      expect.stringMatching(/^v-0\.6\;3-.+-x64$/)
    )
    expect(mockCache.saveCache).toHaveBeenCalledWith(
      ['/mock/v/bin'],
      expect.stringMatching(/^v-0\.6\33-.+-x64$/)
    )
  })

  it('includes architecture in cache key', async () => {
    mockCore.getInput.mockImplementation((name: string) => {
      if (name === 'version') return '0.6.3'
      if (name === 'cache') return 'true'
      if (name === 'architecture') return 'arm64'
      if (name === 'token') return 'mock-token'
      if (name === 'stable') return 'false'
      if (name === 'check-latest') return 'false'
      if (name === 'clean') return 'true'
      return ''
    })

    vi.spyOn(main, 'execer').mockResolvedValue({
      stdout: 'V 0.6.3\n',
      stderr: '',
    } as any)

    await (main as any).run()
    expect(mockCache.saveCache).toHaveBeenCalledWith(
      ['/mock/v/bin'],
      expect.stringContaining('arm64')
    )
  })
})

// -----------------------------------------------------------------------------
// Tests: Cache hit scenario
// -----------------------------------------------------------------------------

describe('Cache hit scenario', () => {
  beforeEach(() => {
    mockCore.getInput.mockImplementation((name: string) => {
      if (name === 'version') return '0.6.3'
      if (name === 'cache') return 'true'
      if (name === 'token') return 'mock-token'
      if (name === 'path') return ''
      if (name === 'stable') return 'false'
      if (name === 'check-latest') return 'false'
      if (name === 'clean') return 'true'
      return ''
    })
    mockInstaller.getInstallDir.mockReturnValue('/mock/install/dir')
    mockInstaller.getVExecutable.mockImplementation((dir: string) => `${dir}/v`)
    mockCache.restoreCache.mockResolvedValue('hit') // cache hit!
  })

  it('restores from cache and returns early when cache hits', async () => {
    await (main as any).run()

    expect(mockCache.restoreCache).toHaveBeenCalled()
    expect(mockCore.info).toHaveBeenCalledWith('Cache hit for V 0.6.3')
    expect(mockCore.addPath).toHaveBeenCalledWith('/mock/install/dir')
    expect(mockCore.setOutput).toHaveBeenCalledWith('bin-path', '/mock/install/dir')
    expect(mockCore.setOutput).toHaveBeenCalledWith('v-bin-path', '/mock/install/dir/v')
    expect(mockCore.setOutput).toHaveBeenCalledWith('version', '0.6.3')
    expect(mockCore.setOutput).toHaveBeenCalledWith('architecture', expect.anyString())
    expect(mockInstaller.getVlang).not.toHaveBeenCalled()
    expect(mockCache.saveCache).not.toHaveBeenCalled()
  })

  it('skips cache when cache input is false', async () => {
    mockCore.getInput.mockImplementation((name: string) => {
      if (name === 'version') return '0.6.3'
      if (name === 'cache') return 'false'
      if (name === 'token') return 'mock-token'
      if (name === 'path') return ''
      if (name === 'stable') return 'false'
      if (name === 'check-latest') return 'false'
      if (name === 'clean') return 'true'
      return ''
    })

    vi.spyOn(main, 'execer').mockResolvedValue({
      stdout: 'V 0.6.3\n',
      stderr: '',
    } as any)

    await (main as any).run()
    expect(mockCache.restoreCache).not.toHaveBeenCalled()
    expect(mockCache.saveCache).not.toHaveBeenCalled()
  })

  it('skips cache when version is not provided', async () => {
    mockCore.getInput.mockImplementation((name: string) => {
      if (name === 'version') return ''
      if (name === 'cache') return 'true'
      if (name === 'token') return 'mock-token'
      if (name === 'path') return ''
      if (name === 'stable') return 'false'
      if (name === 'check-latest') return 'false'
      if (name === 'clean') return 'true'
      return ''
    })

    vi.spyOn(main, 'execer').mockResolvedValue({
      stdout: 'V 0.6.3\n',
      stderr: '',
    } as any)

    await (main as any).run()
    expect(mockCache.restoreCache).not.toHaveBeenCalled()
    expect(mockCache.saveCache).not.toHaveBeenCalled()
  })
})

// -----------------------------------------------------------------------------
// Tests: Cache miss scenario
// -----------------------------------------------------------------------------

describe('Cache miss scenario', () => {
  beforeEach(() => {
    mockCore.getInput.mockImplementation((name: string) => {
      if (name === 'version') return '0.6.3'
      if (name === 'cache') return 'true'
      if (name === 'token') return 'mock-token'
      if (name === 'architecture') return 'x64'
      if (name === 'path') return ''
      if (name === 'stable') return 'false'
      if (name === 'check-latest') return 'false'
      if (name === 'clean') return 'true'
      return ''
    })
    mockInstaller.getInstallDir.mockReturnValue('/mock/install/dir')
    mockInstaller.getVExecutable.mockImplementation((dir: string) => `${dir}/v`)
    mockInstaller.getVlang.mockResolvedValue('/mock/v/bin')
    mockTc.cacheDir.mockResolvedValue('/mock/cached/v')
    mockCache.restoreCache.mockResolvedValue(undefined) // cache miss

    vi.spyOn(main, 'execer').mockResolvedValue({
      stdout: 'V 0.6.3\n',
      stderr: '',
    } as any)
  })

  it('downloads V on cache miss', async () => {
    await (main as any).run()
    expect(mockCache.restoreCache).toHaveBeenCalled()
    expect(mockInstaller.getVlang).toHaveBeenCalledWith({
      authToken: 'mock-token',
      version: '0.6.3',
      checkLatest: false,
      stable: false,
      arch: 'x64',
      installPath: '',
      clean: true,
    })
  })

  it('caches the downloaded version', async () => {
    await (main as any).run()
    expect(mockTc.cacheDir).toHaveBeenCalledWith('/mock/v/bin', 'v', '0.6.3')
    expect(mockCache.saveCache).toHaveBeenCalledWith(
      ['/mock/v/bin'],
      expect.stringMatching(/^v-0.6.3-.+-x64$/)
    )
    expect(mockCore.info).toHaveBeenCalledWith('Saved V 0.6.3 to cache')
  })

  it('sets all outputs after installation', async () => {
    await (main as any).run()
    expect(mockCore.setOutput).toHaveBeenCalledWith('bin-path', '/mock/v/bin')
    expect(mockCore.setOutput).toHaveBeenCalledWith('v-bin-path', '/mock/v/bin/v')
    expect(mockCore.setOutput).toHaveBeenCalledWith('version', '0.6.3')
    expect(mockCore.setOutput).toHaveBeenCalledWith('architecture', 'x64')
  })
})

// -----------------------------------------------------------------------------
// Tests: Error handling
// -----------------------------------------------------------------------------

describe('Error handling', () => {
  it('calls core.setFailed when run throws', async () => {
    mockCore.getInput.mockImplementation((name: string) => {
      if (name === 'version') return '0.6.3'
      if (name === 'token') return 'mock-token'
      return ''
    })
    mockInstaller.getVlang.mockRejectedValue(new Error('Download failed'))

    await (main as any).run()
    expect(mockCore.setFailed).toHaveBeenCalledWith('Download failed')
  })

  it('warns when architecture is set but version is missing', async () => {
    mockCore.getInput.mockImplementation((name: string) => {
      if (name === 'version') return ''
      if (name === 'architecture') return 'x64'
      if (name === 'cache') return 'false'
      if (name === 'token') return 'mock-token'
      if (name === 'stable') return 'false'
      if (name === 'check-latest') return 'false'
      if (name === 'clean') return 'true'
      return ''
    })

    mockInstaller.getVlang.mockResolvedValue('/mock/v/bin')
    vi.spyOn(main, 'execer').mockResolvedValue({
      stdout: 'V 0.6.3\n',
      stderr: '',
    } as any)

    await (main as any).run()
    expect(mockCore.warning).toHaveBeenCalledWith(
      expect.stringContaining('architecture')
    )
  })
})
