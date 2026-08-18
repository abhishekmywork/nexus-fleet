import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/public-map", "/verify-account", "/login"],
        disallow: [
          "/",
          "/dashboard",
          "/vehicles",
          "/drivers",
          "/events",
          "/geofences",
          "/gps-devices",
          "/telemetry",
          "/analytics",
          "/reports",
          "/users",
          "/roles",
          "/tenants",
          "/settings",
          "/products",
          "/serving-areas",
          "/activity-logs",
          "/subscriptions",
          "/subscription-plans",
          "/my-subscription",
          "/nearest-vehicle",
        ],
      },
    ],
    sitemap: "https://mstechind.com/sitemap.xml",
  };
}
