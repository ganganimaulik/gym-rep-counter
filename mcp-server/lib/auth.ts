import { getFirebaseAdmin } from './firebase-admin'
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
    // Use the access token to get user info from Google
    const response = await fetch(
      'https://www.googleapis.com/oauth2/v3/userinfo',
      {
        headers: { Authorization: `Bearer ${bearerToken}` },
      },
    )

    if (!response.ok) {
      console.error('Failed to validate Google token:', response.status)
      return undefined
    }

    const userInfo = await response.json()
    const email = userInfo.email as string | undefined

    if (!email) {
      console.error('No email in Google user info')
      return undefined
    }

    // Look up Firebase user by email
    const { auth } = getFirebaseAdmin()
    try {
      const firebaseUser = await auth.getUserByEmail(email)
      return {
        token: bearerToken,
        clientId: 'chatgpt-mcp',
        scopes: ['read', 'write'],
        extra: {
          uid: firebaseUser.uid,
          email: firebaseUser.email || email,
          displayName: firebaseUser.displayName || userInfo.name,
        },
      }
    } catch (err: unknown) {
      const code = (err as { code?: string }).code
      console.error('User not found in Firebase Auth:', email, code)
      return undefined
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
