import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

/**
 * File-based content. Every markdown file in src/content/projects is a project:
 * just a title and an ordered set of screens, shown in the homepage gallery.
 * Display order is controlled by filename (numeric prefix, e.g. 01-bleam.md).
 */
const projects = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/projects" }),
  schema: ({ image }) => {
    // An image can be a local upload (optimized by Astro) OR a remote URL —
    // the CMS image widget can produce either, so we accept both.
    const imageSource = z.union([image(), z.string().url()]);

    return z.object({
      title: z.string(),
      images: z.array(imageSource).min(1),
    });
  },
});

export const collections = { projects };
