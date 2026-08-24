import type { MetadataRoute } from "next";

// Authenticated app routes (booking, profile, admin, etc.) have nothing
// for a crawler to index and no SEO value, so they're disallowed. AI
// crawlers are explicitly welcomed onto the public pages — this is a
// business that wants to be found, not content to protect from training.
const publicPaths = ["/", "/login", "/signup"];
const privatePaths = [
  "/book",
  "/my-bookings",
  "/profile",
  "/admin",
  "/admin/*",
  "/update-password",
  "/auth/*",
  "/calendar/*",
];

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  return {
    rules: [
      { userAgent: "*", allow: publicPaths, disallow: privatePaths },
      { userAgent: "GPTBot", allow: publicPaths, disallow: privatePaths },
      { userAgent: "ChatGPT-User", allow: publicPaths, disallow: privatePaths },
      { userAgent: "ClaudeBot", allow: publicPaths, disallow: privatePaths },
      { userAgent: "Claude-Web", allow: publicPaths, disallow: privatePaths },
      { userAgent: "PerplexityBot", allow: publicPaths, disallow: privatePaths },
      { userAgent: "Google-Extended", allow: publicPaths, disallow: privatePaths },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
