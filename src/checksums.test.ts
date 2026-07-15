import {describe, expect, test} from 'vitest'
import {KNOWN_PREBUILT_CHECKSUMS, getExpectedChecksum} from './checksums'

describe('checksums', () => {
  test('returns pinned hashes for known version/asset', () => {
    expect(getExpectedChecksum('0.5.1', 'v_linux.zip')).toBe(
      '0c35c79343b308e0415619d8e6d8da340c6a24c18331123553cc686ffb18abf4'
    )
    expect(getExpectedChecksum('0.5.2', 'v_windows.zip')).toBe(
      '705bda7f87ccf1fbd24657a3d5767196c44a3d963ff647d7ca6d9beace2b619f'
    )
  })

  test('returns undefined for unknown version or asset', () => {
    expect(getExpectedChecksum('9.9.9', 'v_linux.zip')).toBeUndefined()
    expect(getExpectedChecksum('0.5.1', 'v_nonexistent.zip')).toBeUndefined()
  })

  test('every pinned entry is a 64-char lowercase hex string', () => {
    for (const [version, assets] of Object.entries(KNOWN_PREBUILT_CHECKSUMS)) {
      expect(version).toBeTruthy()
      for (const [asset, hash] of Object.entries(assets)) {
        expect(asset).toMatch(/^v_.*\.zip$/)
        expect(hash).toMatch(/^[a-f0-9]{64}$/)
      }
    }
  })
})
