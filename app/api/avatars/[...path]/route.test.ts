import { beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test'

const mockLimit = mock()
const selectChain = {
  from: () => selectChain,
  where: () => selectChain,
  limit: mockLimit,
}

mock.module('@/lib/db', () => ({
  getDb: async () => ({ select: () => selectChain }),
}))

let GET: typeof import('./route').GET

beforeAll(async () => {
  ;({ GET } = await import('./route'))
})

function makeParams(segments: string[]) {
  return { params: Promise.resolve({ path: segments }) }
}

describe('GET /api/avatars/[...path]', () => {
  beforeEach(() => {
    mockLimit.mockReset()
    mockLimit.mockResolvedValue([])
  })

  test('serves an avatar from the database', async () => {
    const payload = Buffer.from('image-bytes')
    mockLimit.mockResolvedValue([{ id: 'abc', mimeType: 'image/png', data: payload }])

    const response = await GET(new Request('http://localhost/api/avatars/abc.png'), makeParams(['abc.png']))

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('image/png')
    const body = Buffer.from(await response.arrayBuffer())
    expect(body.equals(payload)).toBe(true)
  })

  test('returns 404 when the avatar does not exist', async () => {
    const response = await GET(new Request('http://localhost/api/avatars/missing.png'), makeParams(['missing.png']))
    expect(response.status).toBe(404)
  })

  test('rejects unsupported extensions', async () => {
    const response = await GET(new Request('http://localhost/api/avatars/abc.svg'), makeParams(['abc.svg']))
    expect(response.status).toBe(400)
  })

  test('rejects nested paths', async () => {
    const response = await GET(new Request('http://localhost/api/avatars/a/b.png'), makeParams(['a', 'b.png']))
    expect(response.status).toBe(400)
  })

  test('rejects malformed percent-encoding', async () => {
    const response = await GET(new Request('http://localhost/api/avatars/%'), makeParams(['%zz.png']))
    expect(response.status).toBe(400)
  })
})
