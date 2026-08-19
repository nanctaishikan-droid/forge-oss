import type { MetadataRoute } from "next";

const base =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:4040");

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ["", "/features", "/setup", "/specs"];
  return routes.map((r) => ({
    url: `${base}${r}`,
    changeFrequency: "monthly",
    priority: r === "" ? 1 : 0.8,
  }));
}
