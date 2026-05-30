import { NextRequest, NextResponse } from "next/server";

// Lightweight access gate for public deployments.
//
// If APP_ACCESS_USER and APP_ACCESS_PASSWORD are set (e.g. on Vercel), the whole
// app — including the /api routes that can move funds — requires HTTP Basic Auth.
// If they're unset (e.g. local dev), the gate is disabled so nothing is blocked.
export function middleware(req: NextRequest) {
  const user = process.env.APP_ACCESS_USER;
  const pass = process.env.APP_ACCESS_PASSWORD;

  // Gate disabled when credentials aren't configured.
  if (!user || !pass) return NextResponse.next();

  const header = req.headers.get("authorization");
  if (header?.startsWith("Basic ")) {
    try {
      const decoded = atob(header.slice(6));
      const i = decoded.indexOf(":");
      const u = decoded.slice(0, i);
      const p = decoded.slice(i + 1);
      if (u === user && p === pass) return NextResponse.next();
    } catch {
      /* fall through to 401 */
    }
  }

  return new NextResponse("Authentication required.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Custody Ops Console"' },
  });
}

export const config = {
  // Gate everything except Next's static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
