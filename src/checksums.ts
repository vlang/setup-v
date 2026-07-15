/**
 * Pinned SHA-256 checksums for V's official prebuilt release assets.
 *
 * These are used to verify the integrity of downloaded archives before they
 * are extracted (see issue #32). The map is keyed by V version, then by asset
 * name. New entries are added as V publishes new releases.
 *
 * To regenerate, download each asset from the GitHub release and compute its
 * SHA-256, e.g. `sha256sum v_linux.zip`.
 */
export const KNOWN_PREBUILT_CHECKSUMS: Record<
  string,
  Record<string, string>
> = {
  '0.5.1': {
    'v_linux.zip':
      '0c35c79343b308e0415619d8e6d8da340c6a24c18331123553cc686ffb18abf4',
    'v_linux_arm64.zip':
      '3e1c290faffbe98b54337301d1f65045cd0f1618a7bf20fd4b4c820de52e1951',
    'v_macos_arm64.zip':
      '226c96c63d8caa6909fc91a8026e8fbffa30264fec4dc0495b9e1536a98f6c7c',
    'v_macos_x86_64.zip':
      '04918d73d41ae16ec49d5169ea737ea61c0e0bf28d023bd6661d06b708c806eb',
    'v_windows.zip':
      '705bda7f87ccf1fbd24657a3d5767196c44a3d963ff647d7ca6d9beace2b619f'
  },
  '0.5.2': {
    'v_linux.zip':
      '86caf9e70c3342d48ef19eb4f6c47b709f18c90ae86255520d5c29df6b482e23',
    'v_linux_arm64.zip':
      '7e102f0ecc722bc59fea83ab1c99ae49c2f7be8f30abee9443220e452a439ed3',
    'v_macos_arm64.zip':
      'e539a8dc3aeea47267f3cf00c25c4f0a364d8037fb13f5379d2a574a7abac8ee',
    'v_macos_x86_64.zip':
      'de19ef02874aec502f091b75e504e4836da38f627ddf7f7f9ecf6e8cf262f9d0',
    'v_windows.zip':
      '5f1d619b6b04a2b54b4ad21826a25bdcba2acf75a941c8f72fc95672b6b064ca'
  }
}

/**
 * Returns the expected SHA-256 for a prebuilt asset, or `undefined` when the
 * requested version/asset is not yet pinned (caller should warn, not trust).
 */
export function getExpectedChecksum(
  version: string,
  assetName: string
): string | undefined {
  return KNOWN_PREBUILT_CHECKSUMS[version]?.[assetName]
}
