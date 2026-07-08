import { corsHeaders } from '@/lib/oauth'

export async function POST(req: Request) {
  try {
    const body = await req.json()

    // Accept any client registration - return stable credentials
    const clientId = `mcp-client-${Date.now()}`

    return new Response(
      JSON.stringify({
        client_id: clientId,
        client_secret: clientId, // Not actually used for validation
        client_name: body.client_name || 'MCP Client',
        redirect_uris: body.redirect_uris || [],
        grant_types: ['authorization_code'],
        response_types: ['code'],
        token_endpoint_auth_method: 'none',
      }),
      {
        status: 201,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders(),
        },
      },
    )
  } catch {
    return new Response(JSON.stringify({ error: 'invalid_request' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() })
}
