import { getBaseUrl, corsHeaders } from '@/lib/oauth';

export async function GET(req: Request) {
  const baseUrl = getBaseUrl(req);

  const metadata = {
    resource: baseUrl,
    authorization_servers: [baseUrl],
    bearer_methods_supported: ['header'],
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
