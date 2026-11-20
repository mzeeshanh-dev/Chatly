import type { MetadataRoute } from "next";

const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://chatly-stream.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/chat", "/admin", "/api"] }],
    sitemap: `${base}/sitemap.xml`,
  };
}
