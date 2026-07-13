import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

/**
 * File-based content. Every markdown file in src/content/projects is a project.
 * The schema is typed and validated at build time — a typo in frontmatter fails
 * the build instead of silently shipping broken content.
 *
 * `image()` tells Astro to optimize the referenced image (resize, modern formats).
 * Paths are relative to the markdown file, e.g. ../../assets/uploads/foo.png
 */
const projects = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/projects" }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      description: z.string(),
      year: z.number(),
      role: z.string().optional(),
      client: z.string().optional(),
      tags: z.array(z.string()).default([]),
      thumbnail: image(),
      gallery: z.array(image()).default([]),
      url: z.string().url().optional(),
      featured: z.boolean().default(false),
      draft: z.boolean().default(false),
    }),
});

export const collections = { projects };
