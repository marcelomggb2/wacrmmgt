import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MG Team Mobile",
    short_name: "MG Mobile",
    description: "Inbox mobile para WhatsApp, Instagram, leads e agenda.",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    background_color: "#020617",
    theme_color: "#7c3aed",
    orientation: "portrait",
    categories: ["business", "productivity"],
    icons: [
      {
        src: "/pwa/icon-192",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/pwa/icon-512",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/pwa/icon-512",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
