// @ts-check
import { defineConfig } from "astro/config";
import { rm } from "node:fs/promises";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";

// Remove the local-only CMS admin from the production build so it isn't public.
// Runs as part of `astro build`, regardless of how the build is invoked.
function excludeAdmin() {
  return {
    name: "exclude-admin",
    hooks: {
      "astro:build:done": async ({ dir }) => {
        await rm(new URL("./admin", dir), { recursive: true, force: true });
      },
    },
  };
}

// https://astro.build/config
export default defineConfig({
  // Update this to your real domain before going live (used for sitemap/SEO).
  site: "https://suthan.design",
  integrations: [
    mdx(),
    sitemap({
      filter: (page) => !page.includes("/admin") && !page.includes("/styleguide"),
    }),
    excludeAdmin(),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
