import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const month = z.string().regex(/^\d{4}-\d{2}$/);

const experience = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/experience' }),
  schema: z.object({ title: z.string(), place: z.string(), start: month, end: z.union([month, z.literal('present')]).optional(), order: z.number().int(), described: z.boolean() }),
});
const research = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/research' }),
  schema: z.object({ title: z.string(), status: z.enum(['published', 'in progress', 'presented']), when: z.string(), venue: z.string().optional(), doi: z.string().optional(), order: z.number().int() }),
});
const teaching = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/teaching' }),
  schema: z.object({ title: z.string(), place: z.string().optional(), when: z.string().optional(), order: z.number().int() }),
});
const writing = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/writing' }),
  schema: z.object({ title: z.string(), date: z.coerce.date(), summary: z.string(), draft: z.boolean() }),
});
const sections = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content' }),
  schema: z.object({ heading: z.string(), draft: z.boolean().optional(), updated: month.optional(), facts: z.string().optional() }),
});

export const collections = { experience, research, teaching, writing, sections };
