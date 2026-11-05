import { NextResponse, type NextRequest } from "next/server";

// Fast redirect for signed-out visitors. The API checks every request itself; this only saves a round trip.
export function proxy(req: NextRequest) {
  if (!req.cookies.get("nexus_session")) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(req.nextUrl.pathname)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/projects/:path*", "/admin/:path*", "/account/:path*", "/workbench/:path*", "/strategy", "/strategy-module/:path*"] };
