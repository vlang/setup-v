import * as core from '@actions/core'
import * as cp from 'child_process'
import * as installer from './installer'
import * as path from 'path'
import * as tc from '@actions/tool-cache'
import * as util from 'util'
import {URL} from 'url'
import fs from 'fs'
import os from 'os'

export const execer = util.promisify(cp.exec)

async function run(): Promise<void> {
  try {
    //
    // Version is optional.  If supplied, install / use from the tool cache
    // If not supplied then task is still used to setup proxy, auth, etc...
    //
    const version = resolveVersionInput()

    let arch = core.getInput('architecture')

    // if architecture supplied but node-version is not
    // if we don't throw a warning, the already installed x64 node will be used which is not probably what user meant.
    if (arch && !version) {
      core.warning(
        '`architecture` is provided but `node-version` is missing. In this configuration, the version/architecture of Node will not be changed. To fix this, provide `architecture` in combination with `node-version`'
      )
    }

    if (!arch) {
      arch = os.arch()
    }

    const token = core.getInput('token')
    const auth = !token || isGhes() ? undefined : `token ${token}`
    const stable = (core.getInput('stable') || 'true').toUpperCase() === 'TRUE'
    const checkLatest =
      (core.getInput('check-latest') || 'false').toUpperCase() === 'TRUE'
    const binPath = await installer.getVlang(
      version,
      stable,
      checkLatest,
      auth,
      arch
    )

    core.info('Adding v to the cache..')
    const installedVersion = await getVersion(binPath)
    const cachedPath = await tc.cacheDir(binPath, 'v', installedVersion)
    core.info(`Cached v to: ${cachedPath}`)

    core.addPath(cachedPath)
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

function isGhes(): boolean {
  const ghUrl = new URL(
    process.env['GITHUB_SERVER_URL'] || 'https://github.com'
  )
  return ghUrl.hostname.toUpperCase() !== 'GITHUB.COM'
}

function resolveVersionInput(): string {
  let version = core.getInput('version')
  const versionFileInput = core.getInput('version-file')

  if (version && versionFileInput) {
    core.warning(
      'Both version and version-file inputs are specified, only version will be used'
    )
  }

  if (version) {
    return version
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
    version = parseVersionFile(fs.readFileSync(versionFilePath, 'utf8'))
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

export async function getVersion(binPath: string): Promise<string> {
  const pathToBin = path.join(binPath, 'v')

  const {stdout, stderr} = await execer(`${pathToBin} version`)

  if (stderr !== '') {
    throw new Error(`Unable to get version from ${pathToBin}`)
  }

  if (stdout !== '') {
    return stdout.trim().split(' ')[1]
  }

  core.warning('Unable to get version from v executable.')
  return '0.0.0'
}

run()
