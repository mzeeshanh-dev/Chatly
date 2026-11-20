import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// Firebase Auth/Firestore/FCM, Vercel Analytics and Cloudinary are the only
// third-party origins the app talks to.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://apis.google.com https://va.vercel-scripts.com`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https://res.cloudinary.com https://lh3.googleusercontent.com",
  "media-src 'self' blob: https://res.cloudinary.com",
  "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://firebaseinstallations.googleapis.com https://fcmregistrations.googleapis.com https://va.vercel-scripts.com https://vitals.vercel-insights.com",
  "frame-src 'self' https://*.firebaseapp.com https://accounts.google.com",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

// The FCM service worker importScripts() the Firebase SDK from gstatic and calls
// Google APIs, so it needs its own policy (a worker is governed by the CSP of
// its own script response, not the page's).
const swCsp = [
  "default-src 'self'",
  "script-src 'self' https://www.gstatic.com",
  "connect-src 'self' https://*.googleapis.com https://www.gstatic.com",
  "img-src 'self' data: https:",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=(self), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    remotePatterns: [{ protocol: "https", hostname: "res.cloudinary.com" }],
  },
  serverExternalPackages: ["firebase-admin"],
  async headers() {
    return [
      // Negative lookahead: every route except the service worker gets the page CSP.
      { source: "/((?!firebase-messaging-sw\.js).*)", headers: securityHeaders },
      {
        source: "/firebase-messaging-sw.js",
        headers: [
          ...securityHeaders.filter((h) => h.key !== "Content-Security-Policy"),
          { key: "Content-Security-Policy", value: swCsp },
          { key: "Cache-Control", value: "no-cache" },
        ],
      },
      // Private and auth-related pages must stay out of search indexes.
      {
        source: "/:section(chat|admin|login|register|forgot-password)/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      {
        source: "/:section(chat|admin|login|register|forgot-password)",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      // API responses are per-user and must not be cached.
      { source: "/api/:path*", headers: [{ key: "Cache-Control", value: "no-store" }] },
    ];
  },
};

export default nextConfig;
