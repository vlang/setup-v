import os from 'os'

export async function getVlang(
  versionSpec: string,
  stable: boolean,
  checkLatest: boolean,
  auth: string | undefined,
  arch: string = os.arch()
): Promise<string> {
  let osPlat: string = os.platform()
  let osArch: string = translateArchToDistUrl(arch)

  return ''
}

function translateArchToDistUrl(arch: string): string {
  const platformMap: Record<string, string> = {
    darwin: 'macos',
    win32: 'windows'
  }

  return platformMap[arch.toString()] || arch
}
