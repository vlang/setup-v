import * as core from '@actions/core'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import {downloadRepository} from './github-api-helper'
import {execSync} from 'child_process'

const VLANG_GITHUB_OWNER = 'vlang'
const VLANG_GITHUB_REPO = 'v'

export interface GetVlangRequest {
  authToken: string
  version: string
  stable: boolean
  checkLatest: boolean
  ref?: string
  commit?: string
  arch?: string
}

export async function getVlang({
  authToken,
  version,
  checkLatest,
  ref,
  commit,
  arch = os.arch()
}: GetVlangRequest): Promise<string> {
  const osPlat: string = os.platform()
  const osArch: string = translateArchToDistUrl(arch)

  const repositoryPath = path.join(
    process.env.GITHUB_WORKSPACE!,
    'vlang',
    `v${version}`,
    `vlang_${osPlat}_${osArch}`
  )

  const vBinPath = path.join(repositoryPath, 'v')

  if (fs.existsSync(repositoryPath)) {
    return repositoryPath
  }

  let nextRef = ref
  let nextCommit = commit

  if (checkLatest) {
    nextRef = ''
    nextCommit = ''
  }

  await downloadRepository(
    authToken,
    VLANG_GITHUB_OWNER,
    VLANG_GITHUB_REPO,
    repositoryPath,
    nextRef,
    nextCommit
  )

  if (!fs.existsSync(vBinPath)) {
    core.info('Running make...')
    execSync(`make`, {cwd: repositoryPath})
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
