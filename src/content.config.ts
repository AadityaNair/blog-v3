import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const blogs = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/blogs" }),
  schema: z.object({
    title: z.string(),
    excerpt: z.string(),
    date: z.coerce.date(),
    tags: z.array(z.string()).default([]),
  }),
});

export const collections = { blogs };
