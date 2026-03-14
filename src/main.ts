import * as cache from '@actions/cache'
import * as core from '@actions/core'
import * as cp from 'child_process'
import * as fs from 'fs'
import * as installer from './installer'
import * as os from 'os'
import * as path from 'path'
import * as tc from '@actions/tool-cache'
import * as util from 'util'
import {IS_POST} from './state-helper'
import {
  getDefaultBranch,
  getLatestRelease,
  getRefCommitSha
} from './github-api-helper'

export const execer = util.promisify(cp.exec)

async function run(): Promise<void> {
  try {
    const version = resolveVersionInput()

    let arch = core.getInput('architecture')

    // if architecture supplied but version is not
    // if we don't throw a warning, the already installed x64 node will be used which is not probably what user meant.
    if (arch && !version) {
      core.warning(
        '`architecture` is provided but `version` is missing. In this configuration, the version/architecture of Node will not be changed. To fix this, provide `architecture` in combination with `version`'
      )
    }

    if (!arch) {
      arch = os.arch()
    }

    const token = core.getInput('token', {required: true})
    const stable = strToBoolean(core.getInput('stable') || 'false')
    const checkLatest = strToBoolean(core.getInput('check-latest') || 'false')

    // Resolve the ref we will use so we can compute a deterministic cache key
    // before touching the network for the actual archive download.
    let resolvedRef = version
    if (checkLatest && stable) {
      resolvedRef = await getLatestRelease(token, 'vlang', 'v')
    }
    if (!resolvedRef) {
      // No version specified — use the default branch (e.g. master)
      const fullRef = await getDefaultBranch(token, 'vlang', 'v')
      resolvedRef = fullRef.replace(/^refs\/heads\//, '')
    }

    const shortSha = await getRefCommitSha(token, 'vlang', 'v', resolvedRef)
    const resolvedVersion = `vlang-v-${shortSha}`
    const cacheKey = `setup-v-${os.platform()}-${arch}-${resolvedVersion}`
    const installDir = installer.getInstallDir(arch)
    const vBinPath = path.join(installDir, 'v')

    // ── Try to restore from GitHub Actions cache (persists across jobs) ──────
    let cacheHit = false
    if (cache.isFeatureAvailable()) {
      core.info('Checking GitHub Actions cache...')
      const restoredKey = await cache.restoreCache([installDir], cacheKey)
      if (restoredKey && fs.existsSync(vBinPath)) {
        core.info(`Cache hit — restored v from cache (key: ${restoredKey})`)
        cacheHit = true
      } else if (restoredKey) {
        // Partial/corrupt restore — wipe so the download starts clean
        core.warning('Cache restored but v binary not found; re-downloading.')
        fs.rmSync(installDir, {recursive: true, force: true})
      }
    }

    // ── Download + build on cache miss ───────────────────────────────────────
    if (!cacheHit) {
      await installer.getVlang({
        authToken: token,
        version,
        checkLatest,
        stable,
        arch,
        resolvedRef
      })

      if (cache.isFeatureAvailable()) {
        core.info('Saving v to GitHub Actions cache...')
        try {
          await cache.saveCache([installDir], cacheKey)
          core.info(`Saved v to cache (key: ${cacheKey})`)
        } catch (err) {
          // Another parallel job may have already saved the same key — not fatal
          if (err instanceof Error) core.warning(err.message)
        }
      }
    }

    // ── Register in the within-job tool cache so tc.find() works too ─────────
    let cachedPath = tc.find('v', resolvedVersion, arch)
    if (!cachedPath) {
      cachedPath = await tc.cacheDir(installDir, 'v', resolvedVersion)
    }

    core.addPath(cachedPath)

    const installedVersion = await getVersion(installDir)
    core.setOutput('bin-path', cachedPath)
    core.setOutput('v-bin-path', path.join(cachedPath, 'v'))
    core.setOutput('version', installedVersion)
    core.setOutput('architecture', arch)
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

export async function cleanup(): Promise<void> {
  // @todo: implement
}

function resolveVersionInput(): string {
  let version = core.getInput('version')
  const versionFileInput = core.getInput('version-file')

  if (version && versionFileInput) {
    core.warning(
      'Both version and version-file inputs are specified, only version will be used'
    )
  }

  if (versionFileInput) {
    const versionFilePath = path.join(
      process.env.GITHUB_WORKSPACE!,
      versionFileInput
    )
    if (!fs.existsSync(versionFilePath)) {
      throw new Error(
        `The specified v version file at: ${versionFilePath} does not exist`
      )
    }
    version = fs.readFileSync(versionFilePath, 'utf8')
  }

  version = parseVersionFile(version)
  if (versionFileInput) {
    core.info(`Resolved ${versionFileInput} as ${version}`)
  }

  return version
}

function parseVersionFile(contents: string): string {
  let version = contents.trim()

  if (/^v\d/.test(version)) {
    version = version.substring(1)
  }

  return version
}

function strToBoolean(str: string): boolean {
  const falsyValues = ['false', 'no', '0', '', 'undefined', 'null']

  return !falsyValues.includes(str.toLowerCase())
}

async function getVersion(binPath: string): Promise<string> {
  const vBinPath = path.join(binPath, 'v')

  const {stdout, stderr} = await execer(`${vBinPath} version`)

  if (stderr !== '') {
    throw new Error(`Unable to get version from ${vBinPath}`)
  }

  if (stdout !== '') {
    return stdout.trim().split(' ')[1]
  }

  core.warning('Unable to get version from v executable.')
  return '0.0.0'
}

if (IS_POST) {
  cleanup()
} else {
  run()
}
