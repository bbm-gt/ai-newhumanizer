import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const url = request.nextUrl;
  const hostname = request.headers.get('host') || '';

  // Exclude public files and api routes
  if (
    url.pathname.startsWith('/_next') ||
    url.pathname.startsWith('/api') ||
    url.pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  if (hostname.includes('bypassaicheck.com')) {
    return NextResponse.rewrite(new URL(`/bypassaicheck${url.pathname}`, request.url));
  }

  if (hostname.includes('draftpolish.com')) {
    return NextResponse.rewrite(new URL(`/draftpolish${url.pathname}`, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
