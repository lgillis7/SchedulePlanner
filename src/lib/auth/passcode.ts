/**
 * Passcode verification using Web Crypto API.
 *
 * Hashes both input and stored passcode with SHA-256,
 * then performs constant-time byte comparison.
 */

export async function verifyPasscode(input: string): Promise<boolean> {
  const storedPasscode = process.env.SCHEDULE_PASSCODE;
  if (!storedPasscode) {
    throw new Error('SCHEDULE_PASSCODE environment variable is not set');
  }

  const encoder = new TextEncoder();
  const [inputHash, storedHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(input)),
    crypto.subtle.digest('SHA-256', encoder.encode(storedPasscode)),
  ]);

  const inputArr = new Uint8Array(inputHash);
  const storedArr = new Uint8Array(storedHash);

  // Constant-time comparison: always compare all bytes
  let mismatch = 0;
  for (let i = 0; i < inputArr.length; i++) {
    mismatch |= inputArr[i] ^ storedArr[i];
  }

  return mismatch === 0;
}
