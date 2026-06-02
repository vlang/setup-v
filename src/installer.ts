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

export function getInstallDir(arch: string = os.arch()): string {
  const osPlat: string = os.platform()
  const osArch: string = translateArchToDistUrl(arch)
  const vlangDir = path.join(os.homedir(), 'vlang')
  return path.join(vlangDir, `vlang_${osPlat}_${osArch}`)
}

export function getVExecutable(installDir: string): string {
  const executable = process.platform === 'win32' ? 'v.exe' : 'v'
  return path.join(installDir, executable)
}

export function isVInstalled(installDir: string): boolean {
  return fs.existsSync(getVExecutable(installDir))
}

export async function resolveVersionRef(
  authToken: string,
  version: string,
  checkLatest: boolean,
  stable?: boolean
): Promise<string> {
  if (version) {
    return version
  }

  if (stable) {
    core.info('Checking latest stable release...')
    return await getLatestRelease(
      authToken,
      VLANG_GITHUB_OWNER,
      VLANG_GITHUB_REPO
    )
  }

  if (checkLatest) {
    core.info('Checking latest commit from default branch...')
    return ''
  }

  return version
}

export async function getVlang({
  authToken,
  version,
  checkLatest,
  stable,
  arch = os.arch()
}: GetVlangRequest): Promise<string> {
  const installDir = getInstallDir(arch)
  const vBinPath = getVExecutable(installDir)

  if (fs.existsSync(installDir)) {
    if (isVInstalled(installDir)) {
      core.info(`V already installed at ${installDir}`)
      return installDir
    }

    core.warning(
      `Install directory exists but V executable is missing at ${installDir}. Re-downloading...`
    )
    fs.rmSync(installDir, {recursive: true, force: true})
  }

  const correctedRef = await resolveVersionRef(
    authToken,
    version,
    checkLatest,
    stable
  )

  core.info(`Downloading vlang ${correctedRef || 'default branch'}...`)

  await downloadRepository(
    authToken,
    VLANG_GITHUB_OWNER,
    VLANG_GITHUB_REPO,
    installDir,
    correctedRef
  )

  if (!fs.existsSync(vBinPath)) {
    buildV(installDir)
  }

  return installDir
}

function buildV(installDir: string): void {
  if (process.platform === 'win32') {
    // vlang/v CI builds Windows with makev.bat, not GNU make (see windows_ci_gcc.yml).
    core.info('Running makev.bat -gcc...')
    // eslint-disable-next-line no-console
    console.log(
      execSync('makev.bat -gcc', {
        cwd: installDir,
        shell: process.env.ComSpec ?? 'cmd.exe',
        stdio: 'pipe'
      }).toString()
    )
    return
  }

  core.info('Running make...')
  // eslint-disable-next-line no-console
  console.log(execSync('make', {cwd: installDir, stdio: 'pipe'}).toString())
}

function translateArchToDistUrl(arch: string): string {
  const platformMap: Record<string, string> = {
    darwin: 'macos',
    win32: 'windows'
  }

  return platformMap[arch.toString()] || arch
}
