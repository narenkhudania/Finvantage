import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Search } from 'lucide-react';
import { listPublishedBlogPosts, type BlogPost } from '../../services/blogService';
import { applySeoMeta } from '../../services/seoMeta';

const DATE_FMT = new Intl.DateTimeFormat('en-IN', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

const BlogIndexPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [query, setQuery] = useState('');

  useEffect(() => {
    applySeoMeta({
      title: 'FinVantage Blog | Financial Planning, Investing, and Wealth Growth',
      description:
        'Actionable personal finance guides on goal planning, risk profiling, insurance, tax optimization, and long-term investing.',
      canonicalUrl: `${window.location.origin}/blog`,
      type: 'website',
      keywords: [
        'financial planning blog',
        'investment strategy',
        'risk profile',
        'retirement planning india',
        'insurance planning',
      ],
      robots: 'index,follow',
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'Blog',
        name: 'FinVantage Blog',
        url: `${window.location.origin}/blog`,
      },
    });
  }, []);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const rows = await listPublishedBlogPosts(120);
        if (!mounted) return;
        setPosts(rows);
      } catch (err) {
        if (!mounted) return;
        setError((err as Error).message || 'Could not load blog posts.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void load();

    return () => {
      mounted = false;
    };
  }, []);

  const topTags = useMemo(() => {
    const counts = new Map<string, number>();
    posts.forEach((post) => {
      post.tags.forEach((tag) => {
        counts.set(tag, (counts.get(tag) || 0) + 1);
      });
    });

    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([tag]) => tag);
  }, [posts]);

  const filteredPosts = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return posts;
    return posts.filter((post) =>
      [post.title, post.excerpt, post.targetKeyword, post.tags.join(' ')].join(' ').toLowerCase().includes(q)
    );
  }, [posts, query]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-teal-50/40 px-4 py-8 md:px-8 md:py-10">
      <div className="mx-auto max-w-6xl">
        <header className="rounded-[2rem] border border-teal-100 bg-white/90 p-6 shadow-[0_25px_45px_-35px_rgba(13,148,136,0.55)] md:p-8">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-teal-600">FinVantage Insights</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-900 md:text-5xl">
            SEO-first financial education for long-term wealth decisions.
          </h1>
          <p className="mt-3 max-w-3xl text-sm font-semibold text-slate-600 md:text-base">
            Read practical playbooks on goals, insurance, risk, and investing. Every article is built to be actionable for real households.
          </p>

          <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex w-full items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 md:max-w-lg">
              <Search size={16} className="text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by topic, keyword, or use case"
                className="w-full bg-transparent text-sm font-semibold text-slate-700 outline-none"
              />
            </div>

            <a
              href="/"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-[11px] font-black uppercase tracking-[0.14em] text-slate-700 transition hover:bg-slate-50"
            >
              Open App <ArrowRight size={13} />
            </a>
          </div>

          {topTags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {topTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => setQuery(tag)}
                  className="rounded-full border border-teal-100 bg-teal-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.13em] text-teal-700"
                >
                  {tag}
                </button>
              ))}
            </div>
          )}
        </header>

        <section className="mt-6">
          {loading && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm font-semibold text-slate-500">
              Loading posts...
            </div>
          )}

          {error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm font-semibold text-rose-700">{error}</div>
          )}

          {!loading && !error && filteredPosts.length === 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm font-semibold text-slate-500">
              No posts found for this query.
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredPosts.map((post) => (
              <article
                key={post.id}
                className="rounded-3xl border border-teal-100 bg-white/95 p-5 shadow-[0_20px_40px_-35px_rgba(15,23,42,0.6)]"
              >
                <div className="flex items-center justify-between gap-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                  <span>{DATE_FMT.format(new Date(post.publishedAt || post.createdAt))}</span>
                  <span>{post.estimatedReadMinutes} min read</span>
                </div>
                <h2 className="mt-3 text-xl font-black tracking-tight text-slate-900">{post.title}</h2>
                <p className="mt-2 text-sm font-semibold text-slate-600">{post.excerpt || 'No excerpt available yet.'}</p>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {post.tags.slice(0, 3).map((tag) => (
                    <span
                      key={`${post.id}-${tag}`}
                      className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-slate-600"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                <a
                  href={`/blog/${post.slug}`}
                  className="mt-5 inline-flex items-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-3.5 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-teal-700 transition hover:bg-teal-100"
                >
                  Read Article <ArrowRight size={12} />
                </a>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default BlogIndexPage;
