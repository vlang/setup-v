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
  arch?: string
}

export async function getVlang({
  authToken,
  version,
  checkLatest,
  stable,
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

  let correctedRef = version

  if (checkLatest) {
    core.info('Checking latest release...')
    correctedRef = ''

    if (stable) {
      core.info('Checking latest stable release...')
      correctedRef = await getLatestRelease(
        authToken,
        VLANG_GITHUB_OWNER,
        VLANG_GITHUB_REPO
      )
    }
  }

  core.info(`Downloading vlang ${correctedRef}...`)

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
