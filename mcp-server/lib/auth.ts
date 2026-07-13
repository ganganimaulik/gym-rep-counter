import { authenticateUser } from './firebase-client'
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js'

export interface McpUser {
  uid: string
  email: string
  displayName?: string
}

export async function resolveUser(
  _request: Request,
  bearerToken?: string,
): Promise<AuthInfo | undefined> {
  if (!bearerToken) {
    return undefined
  }

  try {
    // Authenticate directly with Firebase using the Google OAuth access token.
    // This replaces the previous two-step flow (Google userinfo → admin getUserByEmail)
    // and also authenticates the Firestore instance so security rules are enforced.
    const firebaseUser = await authenticateUser(bearerToken)

    return {
      token: bearerToken,
      clientId: 'chatgpt-mcp',
      scopes: ['read', 'write'],
      extra: {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        displayName: firebaseUser.displayName || '',
      },
    }
  } catch (error) {
    console.error('Auth resolution error:', error)
    return undefined
  }
}

/**
 * Extract McpUser from the extra.authInfo provided by MCP SDK.
 */
export function getMcpUser(extra: unknown): McpUser {
  const authInfo = (extra as { authInfo?: AuthInfo }).authInfo
  if (!authInfo?.extra) {
    throw new Error('Unauthorized: No user context found')
  }
  return authInfo.extra as unknown as McpUser
}
