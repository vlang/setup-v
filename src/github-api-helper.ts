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
  repositoryPath: string,
  ref?: string,
  commit?: string
): Promise<void> {
  // Determine the default branch
  if (!ref && !commit) {
    core.info('Determining the default branch')
    ref = await getDefaultBranch(authToken, owner, repo)
  }

  // create directory if not exists
  if (!fs.existsSync(repositoryPath)) {
    core.info(`Creating directory: ${repositoryPath}`)
    fs.mkdirSync(repositoryPath, {recursive: true})
  }

  // Download the archive
  let archiveData = await retryHelper.execute(async () => {
    core.info('Downloading the archive')
    return await downloadArchive(authToken, owner, repo, ref, commit)
  })

  // Write archive to disk
  core.info('Writing archive to disk')
  const uniqueId = uuid()
  const archivePath = path.join(repositoryPath, `${uniqueId}.tar.gz`)
  await fs.promises.writeFile(archivePath, archiveData)
  archiveData = Buffer.from('') // Free memory

  // Extract archive
  core.info('Extracting the archive')
  const extractPath = path.join(repositoryPath, uniqueId)
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
  const tempRepositoryPath = path.join(extractPath, archiveVersion)

  // Move the files
  for (const fileName of await fs.promises.readdir(tempRepositoryPath)) {
    const sourcePath = path.join(tempRepositoryPath, fileName)
    const targetPath = path.join(repositoryPath, fileName)
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
  let result: string

  const octokit = github.getOctokit(authToken)
  const params = {
    owner,
    repo
  }

  const response = await octokit.rest.repos.getLatestRelease(params)

  result = response.data.tag_name

  core.info(`Latest release '${result}'`)

  // Prefix with 'refs/tags'
  if (!result.startsWith('refs/')) {
    result = `refs/tags/${result}`
  }

  return result
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

  if (IS_WINDOWS) {
    const response = await octokit.rest.repos.downloadZipballArchive(params)

    // @ts-ignore https://github.com/octokit/types.ts/issues/211
    return Buffer.from(response.data)
  }

  const response = await octokit.rest.repos.downloadTarballArchive(params)

  // @ts-ignore https://github.com/octokit/types.ts/issues/211
  return Buffer.from(response.data)
}
