import { createWrappedCode } from '@/lib/oauth'

export async function GET(req: Request) {
  const url = new URL(req.url)

  const googleCode = url.searchParams.get('code')
  const stateParam = url.searchParams.get('state')
  const error = url.searchParams.get('error')

  if (error) {
    // Google returned an error
    return new Response(`OAuth Error: ${error}`, { status: 400 })
  }

  if (!googleCode || !stateParam) {
    return new Response('Missing code or state parameter', { status: 400 })
  }

  // Decode our state to get ChatGPT's original params
  let originalState: {
    redirect_uri: string
    state: string
    code_challenge: string
    code_challenge_method: string
    client_id: string
  }

  try {
    originalState = JSON.parse(Buffer.from(stateParam, 'base64url').toString())
  } catch {
    return new Response('Invalid state parameter', { status: 400 })
  }

  // Wrap Google's code with PKCE metadata into our own opaque code
  const wrappedCode = createWrappedCode(
    googleCode,
    originalState.code_challenge,
    originalState.code_challenge_method,
  )

  // Redirect back to ChatGPT's redirect_uri with our wrapped code
  const redirectUrl = new URL(originalState.redirect_uri)
  redirectUrl.searchParams.set('code', wrappedCode)
  if (originalState.state) {
    redirectUrl.searchParams.set('state', originalState.state)
  }

  return Response.redirect(redirectUrl.toString(), 302)
}
