export const dynamic = 'force-dynamic'

// Liveness must not initialize the database or contact external services.
export function GET() {
  return Response.json({ status: 'ok' }, { headers: { 'Cache-Control': 'no-store' } })
}
