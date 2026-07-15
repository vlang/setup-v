import {describe, expect, test, vi, beforeEach, afterEach} from 'vitest'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import * as githubApiHelper from './github-api-helper'
import * as toolCache from '@actions/tool-cache'

const mockOctokit = {
  rest: {
    repos: {
      getReleaseByTag: vi.fn()
    }
  },
  request: vi.fn()
}

vi.mock('@actions/github', () => ({
  getOctokit: vi.fn(() => mockOctokit)
}))

vi.mock('@actions/tool-cache', () => ({
  extractZip: vi.fn()
}))

vi.mock('./checksums', async importOriginal => {
  const actual = await importOriginal<typeof import('./checksums')>()
  return {...actual, getExpectedChecksum: vi.fn()}
})

describe('computeSha256', () => {
  test('matches a known SHA-256 (empty input)', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sha-'))
    const file = path.join(tmp, 'data.bin')
    fs.writeFileSync(file, Buffer.alloc(0))
    expect(githubApiHelper.computeSha256(file)).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
    )
    fs.rmSync(tmp, {recursive: true, force: true})
  })
})

describe('downloadPrebuilt checksum verification', () => {
  let tempDir = ''
  const assetBuffer = Buffer.from('pretend-v-binary-archive')

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prebuilt-verify-'))
    mockOctokit.rest.repos.getReleaseByTag.mockResolvedValue({
      data: {assets: [{name: 'v_linux.zip', id: 123}]}
    })
    mockOctokit.request.mockResolvedValue({data: assetBuffer})
    vi.mocked(toolCache.extractZip).mockImplementation(
      async (_src: string, dest: string) => {
        const top = path.join(dest, 'v')
        await fs.promises.mkdir(top, {recursive: true})
        await fs.promises.writeFile(path.join(top, 'vbinary'), '')
      }
    )
  })

  afterEach(() => {
    vi.restoreAllMocks()
    if (tempDir) {
      fs.rmSync(tempDir, {recursive: true, force: true})
    }
  })

  test('throws when the checksum does not match', async () => {
    vi.mocked(githubApiHelper.getExpectedChecksum).mockReturnValue(
      '0'.repeat(64)
    )
    await expect(
      githubApiHelper.downloadPrebuilt(
        'token',
        'vlang',
        'v',
        '0.5.1',
        'linux',
        'x64',
        tempDir
      )
    ).rejects.toThrow(/Checksum verification failed/)
  })

  test('verifies and succeeds when the checksum matches', async () => {
    const crypto = await import('crypto')
    const actual = crypto.createHash('sha256').update(assetBuffer).digest('hex')
    vi.mocked(githubApiHelper.getExpectedChecksum).mockReturnValue(actual)

    const result = await githubApiHelper.downloadPrebuilt(
      'token',
      'vlang',
      'v',
      '0.5.1',
      'linux',
      'x64',
      tempDir
    )
    expect(result).toBe(true)
    expect(githubApiHelper.getExpectedChecksum).toHaveBeenCalledWith(
      '0.5.1',
      'v_linux.zip'
    )
  })

  test('does not throw when no checksum is pinned (warns instead)', async () => {
    vi.mocked(githubApiHelper.getExpectedChecksum).mockReturnValue(undefined)
    const result = await githubApiHelper.downloadPrebuilt(
      'token',
      'vlang',
      'v',
      '0.5.1',
      'linux',
      'x64',
      tempDir
    )
    expect(result).toBe(true)
  })
})
