import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL && !process.env.NEXT_PUBLIC_APP_URL.includes("localhost")
    ? process.env.NEXT_PUBLIC_APP_URL
    : "https://successpro.ai";

  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/pricing",
          "/contact",
          "/login",
          "/signup",
          "/terms",
          "/privacy-policy",
          "/cookie-policy",
          "/cancellation-policy",
          "/refund-policy",
          "/data-policy",
          "/delivery-policy",
        ],
        disallow: [
          "/api/",
          "/dashboard",
          "/dashboard/",
          "/review",
          "/review/",
          "/documents",
          "/documents/",
          "/jobs",
          "/jobs/",
          "/goals",
          "/goals/",
          "/learning",
          "/learning/",
          "/linkedin",
          "/linkedin/",
          "/salary",
          "/salary/",
          "/feed",
          "/feed/",
          "/network",
          "/network/",
          "/messages",
          "/messages/",
          "/notifications",
          "/notifications/",
          "/opportunities",
          "/opportunities/",
          "/settings",
          "/settings/",
          "/billing",
          "/billing/",
          "/admin",
          "/admin/",
          "/recruiter",
          "/recruiter/",
          "/mentor",
          "/mentor/",
          "/profile",
          "/profile/",
          "/p/",
          "/_next/",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
