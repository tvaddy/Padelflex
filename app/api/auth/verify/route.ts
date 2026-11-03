import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, authenticateInput } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, code, password } = body;

    if (token) {
      const result = verifyToken(token);
      if (result.valid) {
        return NextResponse.json({
          valid: true,
          role: result.role,
          accessCode: result.accessCode,
          isAdmin: result.role === 'admin',
        });
      }
    }

    const input = code || password;
    if (input) {
      const result = authenticateInput(input);
      if (result.valid) {
        return NextResponse.json({
          valid: true,
          role: result.role,
          accessCode: result.accessCode,
          isAdmin: result.role === 'admin',
        });
      }
    }

    return NextResponse.json({ valid: false }, { status: 401 });
  } catch (error) {
    return NextResponse.json({ valid: false }, { status: 500 });
  }
}

