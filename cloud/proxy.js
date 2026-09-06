import { NextResponse } from "next/server";
import { getAuth } from "./lib/auth/server";

export default async function proxy(request) {
  const auth = getAuth();
  if (!auth) return NextResponse.redirect(new URL("/entrar?unavailable=1", request.url));
  return auth.middleware({ loginUrl: "/entrar" })(request);
}

export const config = { matcher: ["/conta/:path*", "/chat/:path*"] };
