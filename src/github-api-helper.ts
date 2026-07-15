import * as assert from 'assert'
import * as core from '@actions/core'
import * as fs from 'fs'
import * as github from '@actions/github'
import * as io from '@actions/io'
import * as path from 'path'
import * as retryHelper from './retry-helper'
import * as toolCache from '@actions/tool-cache'
import {v4 as uuid} from 'uuid'

const IS_WINDOWS = process.platform === 'win32'

export async function downloadRepository(
  authToken: string,
  owner: string,
  repo: string,
  installDir: string,
  ref?: string,
  commit?: string
): Promise<void> {
  // Determine the default branch
  if (!ref && !commit) {
    core.info('Determining the default branch')
    ref = await getDefaultBranch(authToken, owner, repo)
  }

  // create directory if not exists
  if (!fs.existsSync(installDir)) {
    core.info(`Creating directory: ${installDir}`)
    fs.mkdirSync(installDir, {recursive: true})
  }

  // Download the archive
  let archiveData = await retryHelper.execute(async () => {
    core.info('Downloading the archive')
    return await downloadArchive(authToken, owner, repo, ref, commit)
  })

  // Write archive to disk
  core.info('Writing archive to disk')
  const uniqueId = uuid()
  const archivePath = path.join(installDir, `${uniqueId}.tar.gz`)
  await fs.promises.writeFile(archivePath, archiveData)
  archiveData = Buffer.from('') // Free memory

  // Extract archive
  core.info('Extracting the archive')
  const extractPath = path.join(installDir, uniqueId)
  await io.mkdirP(extractPath)
  if (IS_WINDOWS) {
    await toolCache.extractZip(archivePath, extractPath)
  } else {
    await toolCache.extractTar(archivePath, extractPath)
  }
  await io.rmRF(archivePath)

  // Determine the path of the repository content. The archive contains
  // a top-level folder and the repository content is inside.
  const archiveFileNames = await fs.promises.readdir(extractPath)
  assert.ok(
    archiveFileNames.length === 1,
    'Expected exactly one directory inside archive'
  )
  const archiveVersion = archiveFileNames[0] // The top-level folder name includes the short SHA
  core.info(`Resolved version ${archiveVersion}`)
  const tempInstallDir = path.join(extractPath, archiveVersion)

  // Move the files
  for (const fileName of await fs.promises.readdir(tempInstallDir)) {
    const sourcePath = path.join(tempInstallDir, fileName)
    const targetPath = path.join(installDir, fileName)
    if (IS_WINDOWS) {
      await io.cp(sourcePath, targetPath, {recursive: true}) // Copy on Windows (Windows Defender may have a lock)
    } else {
      await io.mv(sourcePath, targetPath)
    }
  }
  await io.rmRF(extractPath)
}

export async function getLatestRelease(
  authToken: string,
  owner: string,
  repo: string
): Promise<string> {
  core.info('Retrieving the latest release')
  const octokit = github.getOctokit(authToken)
  const params = {
    owner,
    repo
  }

  const response = await octokit.rest.repos.getLatestRelease(params)

  const result = response.data.tag_name

  core.info(`Latest release '${result}'`)

  return result
}

/**
 * Maps a (platform, arch) pair to the name of V's prebuilt release asset.
 *
 * V publishes per-release assets named `v_<os>[_arch].zip`. Not every
 * combination has a prebuilt (e.g. windows/arm64), in which case `undefined`
 * is returned and the caller should fall back to building from source.
 */
export function resolvePrebuiltAssetName(
  platform: string,
  arch: string
): string | undefined {
  const map: Record<string, string> = {
    'win32-x64': 'v_windows.zip',
    'linux-x64': 'v_linux.zip',
    'linux-arm64': 'v_linux_arm64.zip',
    'darwin-arm64': 'v_macos_arm64.zip',
    'darwin-x64': 'v_macos_x86_64.zip'
  }
  return map[`${platform}-${arch}`]
}

/**
 * Downloads the prebuilt V binary for a tagged release and extracts it into
 * `installDir`. Returns `true` when a matching asset was found and extracted,
 * or `false` when no prebuilt is available (caller should build from source).
 */
export async function downloadPrebuilt(
  authToken: string,
  owner: string,
  repo: string,
  version: string,
  platform: string,
  arch: string,
  installDir: string
): Promise<boolean> {
  const assetName = resolvePrebuiltAssetName(platform, arch)
  if (!assetName) {
    core.info(
      `No prebuilt binary for ${platform}-${arch}; falling back to source build`
    )
    return false
  }

  const octokit = github.getOctokit(authToken)

  let assetId: number
  try {
    const release = await octokit.rest.repos.getReleaseByTag({
      owner,
      repo,
      tag: version
    })
    const asset = release.data.assets.find(a => a.name === assetName)
    if (!asset) {
      core.info(
        `Prebuilt asset ${assetName} not found for ${version}; falling back to source build`
      )
      return false
    }
    assetId = asset.id
  } catch (err) {
    core.info(
      `Could not resolve release ${version} (${String(
        err
      )}); falling back to source build`
    )
    return false
  }

  if (!fs.existsSync(installDir)) {
    core.info(`Creating directory: ${installDir}`)
    fs.mkdirSync(installDir, {recursive: true})
  }

  const archiveData = await retryHelper.execute(async () => {
    core.info(`Downloading prebuilt ${assetName} for ${version}...`)
    const response = await octokit.request(
      'GET /repos/{owner}/{repo}/releases/assets/{asset_id}',
      {
        owner,
        repo,
        asset_id: assetId,
        headers: {Accept: 'application/octet-stream'}
      }
    )
    const raw = response.data as unknown
    if (Buffer.isBuffer(raw)) {
      return raw
    }
    if (typeof raw === 'string') {
      return Buffer.from(raw)
    }
    return Buffer.from(raw as ArrayBuffer)
  })

  const uniqueId = uuid()
  const archivePath = path.join(installDir, `${uniqueId}.zip`)
  await fs.promises.writeFile(archivePath, archiveData)
  const extractPath = path.join(installDir, uniqueId)
  await io.mkdirP(extractPath)
  await toolCache.extractZip(archivePath, extractPath)
  await io.rmRF(archivePath)

  // V prebuilt zips wrap their contents in a single top-level folder (e.g. "v").
  const archiveFileNames = await fs.promises.readdir(extractPath)
  const topLevel =
    archiveFileNames.length === 1
      ? path.join(extractPath, archiveFileNames[0])
      : extractPath

  for (const fileName of await fs.promises.readdir(topLevel)) {
    const sourcePath = path.join(topLevel, fileName)
    const targetPath = path.join(installDir, fileName)
    if (IS_WINDOWS) {
      await io.cp(sourcePath, targetPath, {recursive: true})
    } else {
      await io.mv(sourcePath, targetPath)
    }
  }
  await io.rmRF(extractPath)

  return true
}

/**
 * Looks up the default branch name
 */
export async function getDefaultBranch(
  authToken: string,
  owner: string,
  repo: string
): Promise<string> {
  return await retryHelper.execute(async () => {
    core.info('Retrieving the default branch name')
    const octokit = github.getOctokit(authToken)
    let result: string
    try {
      // Get the default branch from the repo info
      const response = await octokit.rest.repos.get({owner, repo})
      result = response.data.default_branch
      assert.ok(result, 'default_branch cannot be empty')
    } catch (err) {
      // Handle .wiki repo
      if (
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (err as any)?.status === 404 &&
        repo.toUpperCase().endsWith('.WIKI')
      ) {
        result = 'master'
      }
      // Otherwise error
      else {
        throw err
      }
    }

    // Print the default branch
    core.info(`Default branch '${result}'`)

    // Prefix with 'refs/heads'
    if (!result.startsWith('refs/')) {
      result = `refs/heads/${result}`
    }

    return result
  })
}

async function downloadArchive(
  authToken: string,
  owner: string,
  repo: string,
  ref = '',
  commit = ''
): Promise<Buffer> {
  const octokit = github.getOctokit(authToken)
  const params = {
    owner,
    repo,
    ref: commit || ref
  }

  const download = IS_WINDOWS
    ? octokit.rest.repos.downloadZipballArchive
    : octokit.rest.repos.downloadTarballArchive

  const response = await download(params)

  core.info(`Downloaded archive '${response.url}'`)

  // @ts-ignore https://github.com/octokit/types.ts/issues/211
  return Buffer.from(response.data)
}
