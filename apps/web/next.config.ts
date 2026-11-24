import type { NextConfig } from "next";

const developmentEval = process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : "";

const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  {
    key: "Content-Security-Policy",
    value: `default-src 'self'; img-src 'self' data: https://www.google-analytics.com https://www.googletagmanager.com https://www.google.com https://connect.facebook.net https://www.facebook.com https://px.ads.linkedin.com; font-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' https://apis.google.com https://www.googletagmanager.com https://connect.facebook.net https://snap.licdn.com https://checkout.razorpay.com${developmentEval}; connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://apis.google.com https://accounts.google.com https://www.google-analytics.com https://region1.google-analytics.com https://www.googletagmanager.com https://www.google.com https://www.facebook.com https://px.ads.linkedin.com https://api.razorpay.com; frame-src 'self' https://checkout.razorpay.com https://api.razorpay.com https://apis.google.com https://accounts.google.com https://successpro-staging-1706786b.firebaseapp.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`,
  },
];

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  allowedDevOrigins: ["127.0.0.1"],
  transpilePackages: ["@successpro/contracts", "@successpro/domain"],
  serverExternalPackages: ["pdf-parse", "@napi-rs/canvas"],
  poweredByHeader: false,
  output: "standalone",
  async rewrites() {
    // Firebase requires the OAuth helper to be served on the same origin as
    // the application before authDomain can move to the customer domain.
    return [{ source: "/__/auth/:path*", destination: "https://successpro-staging-1706786b.firebaseapp.com/__/auth/:path*" }];
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
