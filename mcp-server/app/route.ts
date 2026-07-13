import { createMcpHandler, experimental_withMcpAuth } from 'mcp-handler'
import { resolveUser } from '@/lib/auth'
import { corsHeaders } from '@/lib/oauth'
import { registerSummaryTools } from '@/lib/tools/summary'
import { registerWorkoutTools } from '@/lib/tools/workouts'
import { registerNutritionTools } from '@/lib/tools/nutrition'
import { registerJournalTools } from '@/lib/tools/journal'
import { registerAnalyticsTools } from '@/lib/tools/analytics'

const handler = createMcpHandler(
  (server) => {
    // Register all 14 tool groups
    registerSummaryTools(server)
    registerWorkoutTools(server)
    registerNutritionTools(server)
    registerJournalTools(server)
    registerAnalyticsTools(server)
  },
  {
    capabilities: {
      tools: {},
    },
  },
  {
    streamableHttpEndpoint: '/',
    sseEndpoint: '/sse',
    sseMessageEndpoint: '/message',
    maxDuration: 60,
    verboseLogs: true,
  },
)

// Wrap with Google OAuth authentication
const authHandler = experimental_withMcpAuth(handler, resolveUser, {
  required: true,
})

export { authHandler as GET, authHandler as POST, authHandler as DELETE }

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() })
}
