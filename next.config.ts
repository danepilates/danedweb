import type { NextConfig } from "next";

// Practical, non-breaking CSP: script-src keeps 'unsafe-inline' because
// Next.js's own hydration bootstrap script is inline and this app has no
// live browser to verify a nonce-based strict CSP against. There's no
// dangerouslySetInnerHTML or raw HTML rendering anywhere in the app, so
// the actual stored-XSS surface is already minimal (React escapes all
// interpolated text by default) — this header mainly blocks loading
// scripts/frames/connections from unexpected third-party origins.
// React's dev mode uses eval() for debugging (stack trace reconstruction
// across HMR boundaries) — never in production — so 'unsafe-eval' is only
// added outside production to keep the deployed policy strict.
const scriptSrc =
  process.env.NODE_ENV === "production"
    ? "script-src 'self' 'unsafe-inline';"
    : "script-src 'self' 'unsafe-inline' 'unsafe-eval';";

const ContentSecurityPolicy = `
  default-src 'self';
  ${scriptSrc}
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https://*.supabase.co;
  font-src 'self' data:;
  connect-src 'self' https://*.supabase.co;
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
`
  .replace(/\n/g, " ")
  .trim();

const securityHeaders = [
  { key: "Content-Security-Policy", value: ContentSecurityPolicy },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
