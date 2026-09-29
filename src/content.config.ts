import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

/**
 * File-based content. Every markdown file in src/content/projects is a project:
 * just a title and an ordered set of screens, shown in the homepage gallery.
 * Display order is controlled explicitly in the CMS with `displayOrder`.
 */
const projects = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/projects" }),
  schema: ({ image }) => {
    // Local images are optimized by Astro. Strings also allow local MP4/WebM
    // uploads and remote image/video URLs, which ProjectMedia renders safely.
    const mediaSource = z.union([image(), z.string()]);

    return z.object({
      displayOrder: z.number().int().positive(),
      title: z.string(),
      images: z.array(mediaSource).min(1),
    });
  },
});

export const collections = { projects };
