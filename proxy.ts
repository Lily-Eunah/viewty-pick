import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/admin/status')) {
    const adminUser = process.env.ADMIN_STATUS_USER;
    const adminPass = process.env.ADMIN_STATUS_PASSWORD;

    // Fail closed if environment variables are not configured or are placeholder values
    const isConfigured =
      adminUser &&
      adminUser !== 'placeholder' &&
      adminUser.trim() !== '' &&
      adminPass &&
      adminPass !== 'placeholder' &&
      adminPass.trim() !== '';

    if (!isConfigured) {
      console.error('[Admin Auth] Basic Auth credentials are not configured or are placeholders. Gating closed.');
      return new NextResponse('Authentication Required (Server Configuration Error)', {
        status: 401,
        headers: {
          'WWW-Authenticate': 'Basic realm="ViewtyPick Admin"',
        },
      });
    }

    const authHeader = request.headers.get('authorization');
    if (authHeader) {
      try {
        const parts = authHeader.split(' ');
        if (parts.length === 2 && parts[0].toLowerCase() === 'basic') {
          const credentials = parts[1];
          const decoded = atob(credentials);
          const colonIdx = decoded.indexOf(':');
          if (colonIdx !== -1) {
            const user = decoded.substring(0, colonIdx);
            const pass = decoded.substring(colonIdx + 1);
            if (user === adminUser && pass === adminPass) {
              return NextResponse.next();
            }
          }
        }
      } catch {
        // Safe fail-closed without throwing
      }
    }

    return new NextResponse('Authentication Required', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="ViewtyPick Admin"',
      },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/status', '/admin/status/:path*'],
};
