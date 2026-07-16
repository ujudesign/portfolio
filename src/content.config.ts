import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

/**
 * File-based content. Every markdown file in src/content/projects is a project.
 *
 * A case study is an ordered list of `blocks`. Each block is either:
 *   - text:    an optional heading + markdown body
 *   - gallery: a set of images with a layout (2-up, 3-up, or full-width)
 *
 * Because it's an ordered list, you can interleave them freely:
 * text → gallery → text → gallery → …  The Sveltia admin lets you add,
 * choose the type of, and drag-reorder these blocks visually.
 */
const projects = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/projects" }),
  schema: ({ image }) => {
    // An image can be a local upload (optimized by Astro) OR a remote URL —
    // the CMS image widget can produce either, so we accept both.
    const imageSource = z.union([image(), z.string().url()]);

    // Treat an empty string (what the CMS writes for a blank field) as "unset",
    // and auto-add https:// so a value like "www.google.com" is still valid.
    const optionalUrl = z.preprocess((v) => {
      if (v === "" || v == null) return undefined;
      if (typeof v === "string" && !/^https?:\/\//i.test(v)) return `https://${v}`;
      return v;
    }, z.string().url().optional());

    const textBlock = z.object({
      type: z.literal("text"),
      heading: z.string().optional(),
      body: z.string(),
    });

    const galleryBlock = z.object({
      type: z.literal("gallery"),
      layout: z.enum(["grid-2", "grid-3", "full"]).default("grid-2"),
      images: z.array(imageSource).default([]),
      caption: z.string().optional(),
    });

    // A custom URL slug (overrides the filename). Blank falls back to the file
    // name. Whatever's typed is normalized to a URL-safe form.
    const optionalSlug = z.preprocess((v) => {
      if (typeof v !== "string" || !v.trim()) return undefined;
      return v
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
    }, z.string().optional());

    return z.object({
      title: z.string(),
      slug: optionalSlug,
      description: z.string(),
      year: z.number(),
      role: z.string().optional(),
      agency: z.string().optional(),
      client: z.string().optional(),
      tags: z.array(z.string()).default([]),
      thumbnail: imageSource,
      thumbnailHover: imageSource.optional(),
      url: optionalUrl,
      featured: z.boolean().default(false),
      draft: z.boolean().default(false),
      // Ordered, interleaved content. Optional — a project can also just use
      // the markdown body below the frontmatter as a simple write-up.
      blocks: z
        .array(z.discriminatedUnion("type", [textBlock, galleryBlock]))
        .default([]),
    });
  },
});

export const collections = { projects };
