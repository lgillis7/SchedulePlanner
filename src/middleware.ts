import { NextRequest, NextResponse } from 'next/server';
import { verifyEditorToken } from '@/lib/auth/jwt';

export async function middleware(req: NextRequest) {
  const response = NextResponse.next();

  const token = req.cookies.get('editor-token')?.value;
  let isEditor = false;

  if (token) {
    isEditor = await verifyEditorToken(token);
  }

  // Set header so server components can read auth state
  // without re-verifying the JWT
  response.headers.set('x-is-editor', isEditor ? 'true' : 'false');

  return response;
}

export const config = {
  matcher: ['/schedule/:path*', '/api/auth/:path*'],
};
