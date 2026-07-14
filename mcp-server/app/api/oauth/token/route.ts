import { unwrapCode, validatePKCE, corsHeaders, getBaseUrl } from '@/lib/oauth'

export async function POST(req: Request) {
  const baseUrl = getBaseUrl(req)

  let body: Record<string, string>
  const contentType = req.headers.get('content-type') || ''

  if (contentType.includes('application/x-www-form-urlencoded')) {
    const text = await req.text()
    body = Object.fromEntries(new URLSearchParams(text))
  } else if (contentType.includes('application/json')) {
    body = await req.json()
  } else {
    // Try form-urlencoded as fallback
    const text = await req.text()
    body = Object.fromEntries(new URLSearchParams(text))
  }

  const { grant_type, code, code_verifier } = body

  if (grant_type !== 'authorization_code') {
    return new Response(JSON.stringify({ error: 'unsupported_grant_type' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders() },
    })
  }

  if (!code) {
    return new Response(
      JSON.stringify({
        error: 'invalid_request',
        error_description: 'code is required',
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders() },
      },
    )
  }

  // Unwrap our code to get Google's code + PKCE metadata
  let googleCode: string
  let codeChallenge: string
  let codeChallengeMethod: string

  try {
    const unwrapped = unwrapCode(code)
    googleCode = unwrapped.googleCode
    codeChallenge = unwrapped.codeChallenge
    codeChallengeMethod = unwrapped.codeChallengeMethod
  } catch {
    return new Response(
      JSON.stringify({
        error: 'invalid_grant',
        error_description: 'Invalid authorization code',
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders() },
      },
    )
  }

  // Validate PKCE if code_challenge was present
  if (codeChallenge && code_verifier) {
    if (!validatePKCE(code_verifier, codeChallenge, codeChallengeMethod)) {
      return new Response(
        JSON.stringify({
          error: 'invalid_grant',
          error_description: 'PKCE validation failed',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders() },
        },
      )
    }
  }

  // Exchange Google's code for tokens
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: googleCode,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: `${baseUrl}/api/oauth/callback`,
      grant_type: 'authorization_code',
    }),
  })

  if (!tokenResponse.ok) {
    const errorData = await tokenResponse.text()
    console.error('Google token exchange failed:', errorData)
    return new Response(
      JSON.stringify({
        error: 'invalid_grant',
        error_description: 'Token exchange failed',
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders() },
      },
    )
  }

  const googleTokens = await tokenResponse.json()
  console.log(
    'googleTokens keys:',
    Object.keys(googleTokens),
    'has id_token:',
    !!googleTokens.id_token,
  )

  // Return Google's access token to ChatGPT
  return new Response(
    JSON.stringify({
      access_token: googleTokens.access_token,
      token_type: googleTokens.token_type || 'Bearer',
      expires_in: googleTokens.expires_in || 3600,
      scope: 'email profile',
      ...(googleTokens.refresh_token
        ? { refresh_token: googleTokens.refresh_token }
        : {}),
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders(),
      },
    },
  )
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() })
}
