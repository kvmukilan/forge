import { NextResponse } from 'next/server'
import path from 'path'
import { eq } from 'drizzle-orm'
import { getDb } from '@/lib/db'
import { avatars } from '@/lib/db/schema'
import { ALLOWED_AVATAR_EXTENSIONS } from '@/lib/avatar'

// Avatars are stored in the database. The UI requests /api/avatars/<id>.<ext>
// (the last segment of the stored avatarPath).
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: pathSegments } = await Promise.resolve(params)
  if (!pathSegments || pathSegments.length !== 1) {
    return NextResponse.json({ error: 'Invalid avatar path' }, { status: 400 })
  }

  let segment: string
  try {
    segment = decodeURIComponent(pathSegments[0])
  } catch {
    return NextResponse.json({ error: 'Invalid avatar path' }, { status: 400 })
  }

  const ext = path.extname(segment).toLowerCase()
  if (!ALLOWED_AVATAR_EXTENSIONS.has(ext)) {
    return NextResponse.json({ error: 'Unsupported avatar type' }, { status: 400 })
  }

  const id = segment.slice(0, -ext.length)
  if (!id || id.includes('/') || id.includes('\\')) {
    return NextResponse.json({ error: 'Invalid avatar path' }, { status: 400 })
  }

  const db = await getDb()
  const rows = await db.select().from(avatars).where(eq(avatars.id, id)).limit(1)
  if (!rows[0]) {
    return NextResponse.json({ error: 'Avatar not found' }, { status: 404 })
  }

  return new NextResponse(new Uint8Array(rows[0].data), {
    headers: {
      'Content-Type': rows[0].mimeType,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}
