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

export interface GetVlangResult {
  installDir: string
  resolvedVersion: string
}

export async function getVlang({
  authToken,
  version,
  checkLatest,
  stable,
  arch = os.arch()
}: GetVlangRequest): Promise<GetVlangResult> {
  const osPlat: string = os.platform()
  const osArch: string = translateArchToDistUrl(arch)
  const vlangDir = path.join(os.homedir(), 'vlang')
  const installDir = path.join(vlangDir, `vlang_${osPlat}_${osArch}`)

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

  const resolvedVersion = await downloadRepository(
    authToken,
    VLANG_GITHUB_OWNER,
    VLANG_GITHUB_REPO,
    installDir,
    correctedRef
  )

  const vBinPath = path.join(installDir, 'v')
  if (!fs.existsSync(vBinPath)) {
    core.info('Running make...')
    // eslint-disable-next-line no-console
    console.log(execSync(`make`, {cwd: installDir}).toString())
  }

  return {installDir, resolvedVersion}
}

function translateArchToDistUrl(arch: string): string {
  const platformMap: Record<string, string> = {
    darwin: 'macos',
    win32: 'windows'
  }

  return platformMap[arch.toString()] || arch
}
