import type { MetadataRoute } from "next";

// The two sites previously had no robots.txt at all; the admin adds the first reason to have
// one. /admin is already gated by the proxy and by every route's own guard - this keeps it
// out of search results as well.

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/api"],
      },
    ],
  };
}
