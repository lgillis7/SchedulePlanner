import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyPasscode } from '@/lib/auth/passcode';
import { signEditorToken } from '@/lib/auth/jwt';

const schema = z.object({
  passcode: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { passcode } = schema.parse(body);

    const valid = await verifyPasscode(passcode);
    if (!valid) {
      return NextResponse.json(
        { error: 'Invalid passcode' },
        { status: 401 }
      );
    }

    const token = await signEditorToken();

    const response = NextResponse.json({ success: true });
    response.cookies.set('editor-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 365, // 1 year
    });

    return response;
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }
    console.error('Auth verify error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
