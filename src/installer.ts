import * as core from '@actions/core'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import {downloadRepository} from './github-api-helper'

const VLANG_GITHUB_OWNER = 'vlang'
const VLANG_GITHUB_REPO = 'v'

export async function getVlang(
  versionSpec: string,
  stable: boolean,
  checkLatest: boolean,
  authToken = '',
  arch: string = os.arch()
): Promise<string> {
  const osPlat: string = os.platform()
  const osArch: string = translateArchToDistUrl(arch)

  const repositoryPath = path.join(
    process.env.GITHUB_WORKSPACE!,
    'vlang',
    `v${versionSpec}`,
    `vlang_${osPlat}_${osArch}`
  )

  const binPath = path.join(repositoryPath, 'v')

  if (fs.existsSync(repositoryPath)) {
    return repositoryPath
  }

  if (checkLatest) {
    await downloadRepository(
      authToken,
      VLANG_GITHUB_OWNER,
      VLANG_GITHUB_REPO,
      '',
      '',
      repositoryPath
    )
  }

  fs.readdir(repositoryPath, function (err, files) {
    if (err) {
      return core.warning(`Unable to scan directory: ${err}`)
    }

    for (const file of files) {
      core.info(file)
    }
  })

  return binPath
}

function translateArchToDistUrl(arch: string): string {
  const platformMap: Record<string, string> = {
    darwin: 'macos',
    win32: 'windows'
  }

  return platformMap[arch.toString()] || arch
}
