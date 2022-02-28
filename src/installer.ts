import * as core from '@actions/core'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import {downloadRepository, getLatestRelease} from './github-api-helper'
import {execSync} from 'child_process'

const VLANG_GITHUB_OWNER = 'vlang'
const VLANG_GITHUB_REPO = 'v'

export interface GetVlangRequest {
  authToken: string
  version: string
  checkLatest: boolean
  stable?: boolean
  ref?: string
  arch?: string
}

export async function getVlang({
  authToken,
  version,
  checkLatest,
  stable,
  ref,
  arch = os.arch()
}: GetVlangRequest): Promise<string> {
  const osPlat: string = os.platform()
  const osArch: string = translateArchToDistUrl(arch)

  const repositoryPath = path.join(
    process.env.GITHUB_WORKSPACE!,
    'vlang',
    `vlang_${osPlat}_${osArch}`
  )

  const vBinPath = path.join(repositoryPath, 'v')

  if (fs.existsSync(repositoryPath)) {
    return repositoryPath
  }

  let correctedRef = ref

  if (version) {
    correctedRef = `refs/tags/${version}`
  }

  if (checkLatest) {
    correctedRef = ''

    if (stable) {
      const latestRelease = await getLatestRelease(
        authToken,
        VLANG_GITHUB_OWNER,
        VLANG_GITHUB_REPO
      )
      correctedRef = `refs/tags/${latestRelease}`
    }
  }

  await downloadRepository(
    authToken,
    VLANG_GITHUB_OWNER,
    VLANG_GITHUB_REPO,
    repositoryPath,
    correctedRef
  )

  if (!fs.existsSync(vBinPath)) {
    core.info('Running make...')
    // eslint-disable-next-line no-console
    console.log(execSync(`make`, {cwd: repositoryPath}).toString())
  }

  return repositoryPath
}

function translateArchToDistUrl(arch: string): string {
  const platformMap: Record<string, string> = {
    darwin: 'macos',
    win32: 'windows'
  }

  return platformMap[arch.toString()] || arch
}
