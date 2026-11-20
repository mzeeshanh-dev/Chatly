import type { MetadataRoute } from "next";

const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://chatly-stream.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/about", "/security", "/support", "/privacy", "/terms"].map((path) => ({
    url: `${base}${path}`,
    changeFrequency: "monthly",
    priority: path === "" ? 1 : 0.6,
  }));
}
