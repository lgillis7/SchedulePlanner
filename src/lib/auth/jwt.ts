/**
 * JWT signing and verification for editor tokens.
 *
 * Uses jose library for edge-compatible JWT operations.
 * Tokens are Supabase-compatible with role: 'authenticated'.
 */

import { SignJWT, jwtVerify } from 'jose';

function getSecret(): Uint8Array {
  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!secret) {
    throw new Error('SUPABASE_JWT_SECRET environment variable is not set');
  }
  return new TextEncoder().encode(secret);
}

/**
 * Signs a Supabase-compatible JWT with editor claims.
 * The token uses role: 'authenticated' which satisfies
 * RLS policies checking auth.role() = 'authenticated'.
 */
export async function signEditorToken(): Promise<string> {
  const secret = getSecret();

  return new SignJWT({
    role: 'authenticated',
    sub: 'editor',
    aud: 'authenticated',
    iss: 'supabase',
    editor: true,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('365d')
    .sign(secret);
}

/**
 * Verifies a JWT signature and checks for the editor: true claim.
 * Returns false (rather than throwing) for invalid/expired tokens.
 */
export async function verifyEditorToken(token: string): Promise<boolean> {
  try {
    const secret = getSecret();
    const { payload } = await jwtVerify(token, secret);
    return payload.editor === true;
  } catch {
    return false;
  }
}
