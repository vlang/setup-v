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
  installPath?: string
}

export function getInstallDir(
  arch: string = os.arch(),
  customPath?: string
): string {
  if (customPath) {
    return path.resolve(customPath)
  }
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
  arch = os.arch(),
  installPath
}: GetVlangRequest): Promise<string> {
  const installDir = getInstallDir(arch, installPath)
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

export function getWindowsBuildCommand(
  installDir: string,
  useGcc = false
): string {
  const gccFlag = useGcc ? ' -gcc' : ''
  if (fs.existsSync(path.join(installDir, 'makev.bat'))) {
    return `.\\makev.bat${gccFlag}`
  }
  if (fs.existsSync(path.join(installDir, 'make.bat'))) {
    return `.\\make.bat${gccFlag}`
  }
  throw new Error(`No Windows build script found in ${installDir}`)
}

function buildV(installDir: string): void {
  if (process.platform === 'win32') {
    // GHA Windows runners ship MSVC (Visual Studio Build Tools), which
    // provides the POSIX-compatible headers V needs to bootstrap. MinGW
    // (-gcc) lacks sys/mman.h, termios.h and pthread types, so try MSVC
    // first and fall back to GCC only if the MSVC build fails.
    try {
      const msvcCommand = getWindowsBuildCommand(installDir, false)
      core.info(`Running ${msvcCommand} (MSVC)...`)
      // eslint-disable-next-line no-console
      console.log(
        execSync(msvcCommand, {
          cwd: installDir,
          shell: process.env.ComSpec ?? 'cmd.exe',
          stdio: 'pipe'
        }).toString()
      )
    } catch (msvcError) {
      const msvcMessage =
        msvcError instanceof Error ? msvcError.message : String(msvcError)
      core.warning(
        `MSVC build failed (${msvcMessage}), falling back to GCC (MinGW)...`
      )
      const gccCommand = getWindowsBuildCommand(installDir, true)
      core.info(`Running ${gccCommand} (GCC)...`)
      // eslint-disable-next-line no-console
      console.log(
        execSync(gccCommand, {
          cwd: installDir,
          shell: process.env.ComSpec ?? 'cmd.exe',
          stdio: 'pipe'
        }).toString()
      )
    }
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
