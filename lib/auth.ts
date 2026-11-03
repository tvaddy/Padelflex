import crypto from 'crypto';
import { cookies } from 'next/headers';

export function getAdminPassword(): string {
  return process.env.ADMIN_PASSWORD || 'admin123';
}

export function normalizeAccessCode(input: string): string {
  if (!input) return 'default';
  const clean = input.trim().toLowerCase();
  return clean.length > 0 ? clean : 'default';
}

export function createAuthToken(role: 'admin' | 'user', accessCode: string = 'default'): string {
  const secret = getAdminPassword();
  const code = role === 'admin' ? 'ADMIN' : normalizeAccessCode(accessCode);
  const salt = 'padelflex_tenant_v4';
  const signature = crypto.createHmac('sha256', secret).update(`${role}:${code}:${salt}`).digest('hex');
  return `${role}:${code}:${signature}`;
}

export function verifyToken(token: string): { valid: boolean; role?: 'admin' | 'user'; accessCode?: string } {
  if (!token || typeof token !== 'string') return { valid: false };
  const parts = token.split(':');
  if (parts.length !== 3) return { valid: false };

  const [role, code, signature] = parts;
  if (role !== 'admin' && role !== 'user') return { valid: false };

  const expectedToken = createAuthToken(role as 'admin' | 'user', code);
  if (token === expectedToken) {
    return {
      valid: true,
      role: role as 'admin' | 'user',
      accessCode: role === 'admin' ? 'ADMIN' : code,
    };
  }
  return { valid: false };
}

export function authenticateInput(input: string): { valid: boolean; role: 'admin' | 'user'; accessCode: string; token: string } {
  const trimmed = input.trim();
  const adminPass = getAdminPassword();

  if (trimmed === adminPass) {
    const token = createAuthToken('admin', 'ADMIN');
    return { valid: true, role: 'admin', accessCode: 'ADMIN', token };
  }

  // Any non-empty access code is accepted as a valid tenant profile!
  const code = normalizeAccessCode(trimmed);
  const token = createAuthToken('user', code);
  return { valid: true, role: 'user', accessCode: code, token };
}

export function verifyAdmin(input: string): boolean {
  if (!input) return false;
  if (input === getAdminPassword()) return true;
  const tokenCheck = verifyToken(input);
  return tokenCheck.valid && tokenCheck.role === 'admin';
}

export async function getServerSession(): Promise<{ role: 'admin' | 'user'; accessCode: string; isAdmin: boolean }> {
  try {
    const cookieStore = await cookies();
    const tokenCookie = cookieStore.get('padelflex_token')?.value;
    const directCodeCookie = cookieStore.get('padelflex_code')?.value;

    if (tokenCookie) {
      const verified = verifyToken(tokenCookie);
      if (verified.valid && verified.role) {
        return {
          role: verified.role,
          accessCode: verified.accessCode || 'default',
          isAdmin: verified.role === 'admin',
        };
      }
    }

    if (directCodeCookie) {
      const code = normalizeAccessCode(directCodeCookie);
      return {
        role: 'user',
        accessCode: code,
        isAdmin: false,
      };
    }
  } catch (err) {
    // In environments where cookies() cannot be read synchronously
  }

  return {
    role: 'user',
    accessCode: 'default',
    isAdmin: false,
  };
}

