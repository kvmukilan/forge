import NextAuth from 'next-auth'
import { authConfig } from './auth.config'
import { NextResponse } from 'next/server'

const { auth } = NextAuth(authConfig)

const PUBLIC_PATHS = ['/login', '/api/auth']

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some(p => pathname.startsWith(p))
}

export default auth((req) => {
  const { pathname } = req.nextUrl

  if (process.env.NODE_ENV !== 'development' && pathname.startsWith('/debug')) {
    return new NextResponse('Not Found', { status: 404 })
  }

  const isAuthenticated = !!req.auth

  if (!isAuthenticated && !isPublicPath(pathname)) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (isAuthenticated && pathname.startsWith('/login')) {
    return NextResponse.redirect(new URL('/', req.url))
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|icons|manifest.json|sw.js|favicon.ico|.*\\.png$|.*\\.jpg$|.*\\.svg$).*)',
  ],
}
