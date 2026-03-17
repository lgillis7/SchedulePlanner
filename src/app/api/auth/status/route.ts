import { NextRequest, NextResponse } from 'next/server';
import { verifyEditorToken } from '@/lib/auth/jwt';

export async function GET(req: NextRequest) {
  const token = req.cookies.get('editor-token')?.value;

  if (!token) {
    return NextResponse.json({ authenticated: false });
  }

  const valid = await verifyEditorToken(token);
  return NextResponse.json({ authenticated: valid });
}
