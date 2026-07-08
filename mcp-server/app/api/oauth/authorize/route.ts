import { getBaseUrl } from '@/lib/oauth'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const baseUrl = getBaseUrl(req)

  // Extract OAuth params from ChatGPT
  const clientId = url.searchParams.get('client_id')
  const redirectUri = url.searchParams.get('redirect_uri')
  const state = url.searchParams.get('state')
  const codeChallenge = url.searchParams.get('code_challenge')
  const codeChallengeMethod =
    url.searchParams.get('code_challenge_method') || 'S256'
  const scope = url.searchParams.get('scope') || 'openid email profile'

  if (!redirectUri) {
    return new Response(
      JSON.stringify({
        error: 'invalid_request',
        error_description: 'redirect_uri is required',
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }

  // Encode ChatGPT's params into our state for the Google redirect
  const ourState = Buffer.from(
    JSON.stringify({
      redirect_uri: redirectUri,
      state: state || '',
      code_challenge: codeChallenge || '',
      code_challenge_method: codeChallengeMethod,
      client_id: clientId || '',
    }),
  ).toString('base64url')

  // Build Google OAuth URL
  const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  googleAuthUrl.searchParams.set('client_id', process.env.GOOGLE_CLIENT_ID!)
  googleAuthUrl.searchParams.set(
    'redirect_uri',
    `${baseUrl}/api/oauth/callback`,
  )
  googleAuthUrl.searchParams.set('response_type', 'code')
  googleAuthUrl.searchParams.set('scope', scope)
  googleAuthUrl.searchParams.set('state', ourState)
  googleAuthUrl.searchParams.set('access_type', 'offline')
  googleAuthUrl.searchParams.set('prompt', 'consent')

  return Response.redirect(googleAuthUrl.toString(), 302)
}
