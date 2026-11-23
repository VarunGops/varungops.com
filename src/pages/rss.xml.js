import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';

export async function GET(context) {
  const posts = (await getCollection('writing', e => !e.data.draft)).sort((a, b) => +b.data.date - +a.data.date);
  return rss({
    title: 'Varun Gopal Rajan: writing',
    description: 'Essays and notes by Dr Varun Gopal Rajan.',
    site: context.site,
    items: posts.map(p => ({ title: p.data.title, pubDate: p.data.date, description: p.data.summary, link: `/writing/${p.id}/` })),
  });
}
