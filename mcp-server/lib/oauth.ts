import { createHash, randomBytes } from 'crypto'

/**
 * Get the public-facing base URL from a request.
 */
export function getBaseUrl(req: Request): string {
  const forwardedHost = req.headers.get('x-forwarded-host')
  const forwardedProto = req.headers.get('x-forwarded-proto') || 'https'
  if (forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`
  }
  const url = new URL(req.url)
  return url.origin
}

/**
 * Wrap a Google authorization code + PKCE metadata into a single opaque code.
 */
export function createWrappedCode(
  googleCode: string,
  codeChallenge?: string,
  codeChallengeMethod?: string,
): string {
  const payload = JSON.stringify({
    gc: googleCode,
    cc: codeChallenge || '',
    cm: codeChallengeMethod || '',
  })
  return Buffer.from(payload).toString('base64url')
}

/**
 * Unwrap our opaque code back into its components.
 */
export function unwrapCode(wrappedCode: string): {
  googleCode: string
  codeChallenge: string
  codeChallengeMethod: string
} {
  const payload = JSON.parse(Buffer.from(wrappedCode, 'base64url').toString())
  return {
    googleCode: payload.gc,
    codeChallenge: payload.cc || '',
    codeChallengeMethod: payload.cm || '',
  }
}

/**
 * Validate PKCE code_verifier against code_challenge.
 */
export function validatePKCE(
  codeVerifier: string,
  codeChallenge: string,
  method: string,
): boolean {
  if (!codeChallenge) return true // No challenge = no PKCE
  if (method === 'S256') {
    const hash = createHash('sha256').update(codeVerifier).digest('base64url')
    return hash === codeChallenge
  }
  // plain
  return codeVerifier === codeChallenge
}

/**
 * Generate a random client ID for dynamic client registration.
 */
export function generateClientId(): string {
  return `mcp-client-${randomBytes(16).toString('hex')}`
}

/**
 * CORS headers for OAuth metadata endpoints.
 */
export function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Cache-Control': 'no-store',
  }
}
