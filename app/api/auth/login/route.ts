import { NextRequest, NextResponse } from 'next/server';
import { authenticateInput } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input = body.code || body.password || body.accessCode;

    if (!input || typeof input !== 'string' || !input.trim()) {
      return NextResponse.json(
        { success: false, error: 'Vennligst oppgi en tilgangskode eller admin-passord' },
        { status: 400 }
      );
    }

    const authResult = authenticateInput(input);

    const response = NextResponse.json({
      success: true,
      token: authResult.token,
      role: authResult.role,
      accessCode: authResult.accessCode,
      isAdmin: authResult.role === 'admin',
      message: authResult.role === 'admin' ? 'Innlogget som administrator (Full tilgang)' : `Profil aktivert: ${authResult.accessCode}`,
    });

    // Set secure HTTP-only-compatible cookies for Next.js Server Components and Actions
    response.cookies.set('padelflex_token', authResult.token, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365, // 1 year
      sameSite: 'lax',
      httpOnly: false, // accessible to client as well
    });

    response.cookies.set('padelflex_code', authResult.accessCode, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
      httpOnly: false,
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { success: false, error: 'Innlogging feilet' },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';
