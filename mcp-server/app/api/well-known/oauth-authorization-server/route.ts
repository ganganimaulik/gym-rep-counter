import { getBaseUrl, corsHeaders } from '@/lib/oauth';

export async function GET(req: Request) {
  const baseUrl = getBaseUrl(req);

  const metadata = {
    issuer: baseUrl,
    authorization_endpoint: `${baseUrl}/api/oauth/authorize`,
    token_endpoint: `${baseUrl}/api/oauth/token`,
    registration_endpoint: `${baseUrl}/api/oauth/register`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code'],
    code_challenge_methods_supported: ['S256', 'plain'],
    token_endpoint_auth_methods_supported: ['client_secret_post', 'none'],
    scopes_supported: ['openid', 'email', 'profile'],
  };

  return new Response(JSON.stringify(metadata), {
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(),
    },
  });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}
