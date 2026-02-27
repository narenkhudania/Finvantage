import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Clock3 } from 'lucide-react';
import { applySeoMeta } from '../../services/seoMeta';
import { getPublishedBlogPostBySlug, listPublishedBlogPosts, type BlogPost } from '../../services/blogService';

interface BlogPostPageProps {
  slug: string;
}

const DATE_FMT = new Intl.DateTimeFormat('en-IN', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

const renderInline = (line: string, keyPrefix: string) => {
  const nodes: React.ReactNode[] = [];
  const regex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let lastIdx = 0;
  let match: RegExpExecArray | null;
  let part = 0;

  while ((match = regex.exec(line)) !== null) {
    if (match.index > lastIdx) {
      nodes.push(<span key={`${keyPrefix}-txt-${part++}`}>{line.slice(lastIdx, match.index)}</span>);
    }

    const text = match[1];
    const href = match[2];
    const isExternal = /^https?:\/\//i.test(href);

    nodes.push(
      <a
        key={`${keyPrefix}-lnk-${part++}`}
        href={href}
        target={isExternal ? '_blank' : undefined}
        rel={isExternal ? 'noopener noreferrer' : undefined}
        className="font-bold text-teal-700 underline decoration-teal-200 underline-offset-2 hover:text-teal-900"
      >
        {text}
      </a>
    );

    lastIdx = regex.lastIndex;
  }

  if (lastIdx < line.length) {
    nodes.push(<span key={`${keyPrefix}-txt-${part++}`}>{line.slice(lastIdx)}</span>);
  }

  return nodes;
};

const renderMarkdown = (content: string) => {
  const blocks = content
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  return blocks.map((block, index) => {
    if (block.startsWith('### ')) {
      return (
        <h3 key={`h3-${index}`} className="mt-8 text-xl font-black tracking-tight text-slate-900">
          {block.replace(/^###\s+/, '')}
        </h3>
      );
    }

    if (block.startsWith('## ')) {
      return (
        <h2 key={`h2-${index}`} className="mt-8 text-2xl font-black tracking-tight text-slate-900">
          {block.replace(/^##\s+/, '')}
        </h2>
      );
    }

    if (block.startsWith('# ')) {
      return (
        <h1 key={`h1-${index}`} className="mt-8 text-3xl font-black tracking-tight text-slate-900">
          {block.replace(/^#\s+/, '')}
        </h1>
      );
    }

    const lines = block.split('\n').map((line) => line.trim()).filter(Boolean);
    const isList = lines.length > 1 && lines.every((line) => line.startsWith('- '));

    if (isList) {
      return (
        <ul key={`ul-${index}`} className="mt-5 list-disc space-y-2 pl-5 text-base font-semibold leading-7 text-slate-700">
          {lines.map((line, i) => (
            <li key={`li-${index}-${i}`}>{renderInline(line.replace(/^-\s+/, ''), `li-${index}-${i}`)}</li>
          ))}
        </ul>
      );
    }

    return (
      <p key={`p-${index}`} className="mt-5 text-base font-semibold leading-7 text-slate-700">
        {renderInline(lines.join(' '), `p-${index}`)}
      </p>
    );
  });
};

const BlogPostPage: React.FC<BlogPostPageProps> = ({ slug }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [post, setPost] = useState<BlogPost | null>(null);
  const [related, setRelated] = useState<BlogPost[]>([]);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const [found, all] = await Promise.all([
          getPublishedBlogPostBySlug(slug),
          listPublishedBlogPosts(12),
        ]);

        if (!mounted) return;

        setPost(found);
        setRelated((all || []).filter((item) => item.slug !== slug).slice(0, 4));

        if (!found) {
          applySeoMeta({
            title: 'Blog Post Not Found | FinVantage',
            description: 'The requested article is unavailable or unpublished.',
            canonicalUrl: `${window.location.origin}/blog/${slug}`,
            robots: 'noindex,nofollow',
          });
          return;
        }

        const canonicalUrl = found.canonicalUrl || `${window.location.origin}/blog/${found.slug}`;

        applySeoMeta({
          title: found.metaTitle || `${found.title} | FinVantage Blog`,
          description: found.metaDescription || found.excerpt || 'Financial planning and investing guidance from FinVantage.',
          canonicalUrl,
          imageUrl: found.ogImageUrl || undefined,
          type: 'article',
          keywords: [found.targetKeyword, ...found.secondaryKeywords, ...found.tags].filter(Boolean),
          robots: 'index,follow',
          jsonLd: {
            '@context': 'https://schema.org',
            '@type': found.schemaType || 'Article',
            headline: found.metaTitle || found.title,
            description: found.metaDescription || found.excerpt,
            datePublished: found.publishedAt,
            dateModified: found.updatedAt,
            mainEntityOfPage: canonicalUrl,
            author: {
              '@type': 'Organization',
              name: 'FinVantage',
            },
            publisher: {
              '@type': 'Organization',
              name: 'FinVantage',
            },
            image: found.ogImageUrl || undefined,
          },
        });
      } catch (err) {
        if (!mounted) return;
        setError((err as Error).message || 'Could not load blog post.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void load();

    return () => {
      mounted = false;
    };
  }, [slug]);

  const markdownBody = useMemo(() => {
    if (!post?.contentMarkdown) return null;
    return renderMarkdown(post.contentMarkdown);
  }, [post?.contentMarkdown]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/30 px-4 py-8 md:px-8 md:py-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-4">
          <a
            href="/blog"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-black uppercase tracking-[0.14em] text-slate-700 transition hover:bg-slate-50"
          >
            <ArrowLeft size={13} /> Back to Blog
          </a>
        </div>

        {loading && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm font-semibold text-slate-500">Loading article...</div>
        )}

        {error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm font-semibold text-rose-700">{error}</div>
        )}

        {!loading && !error && !post && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm font-semibold text-slate-500">
            This article is unavailable.
          </div>
        )}

        {!loading && !error && post && (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">
            <article className="rounded-[2rem] border border-teal-100 bg-white/95 p-6 shadow-[0_25px_45px_-35px_rgba(15,23,42,0.55)] md:p-8">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-teal-600">FinVantage Blog</p>
              <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-900 md:text-5xl">{post.title}</h1>
              {!!post.excerpt && <p className="mt-4 text-lg font-semibold leading-7 text-slate-600">{post.excerpt}</p>}

              <div className="mt-5 flex flex-wrap items-center gap-3 text-xs font-bold text-slate-500">
                <span>{DATE_FMT.format(new Date(post.publishedAt || post.createdAt))}</span>
                <span className="inline-flex items-center gap-1"><Clock3 size={13} /> {post.estimatedReadMinutes} min read</span>
                {post.targetKeyword && <span className="rounded-full bg-teal-50 px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-teal-700">{post.targetKeyword}</span>}
              </div>

              <div className="mt-8 border-t border-slate-100 pt-3">{markdownBody}</div>

              {(post.ctaText && post.ctaUrl) && (
                <div className="mt-9 rounded-2xl border border-teal-100 bg-teal-50 p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-teal-700">Next Step</p>
                  <a
                    href={post.ctaUrl}
                    className="mt-2 inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-[11px] font-black uppercase tracking-[0.14em] text-white transition hover:bg-teal-700"
                  >
                    {post.ctaText} <ArrowRight size={12} />
                  </a>
                </div>
              )}
            </article>

            <aside className="space-y-4">
              <div className="rounded-3xl border border-slate-200 bg-white/95 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Organic Snapshot (30d)</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-2.5">
                    <p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">Impressions</p>
                    <p className="mt-1 text-sm font-black text-slate-900">{post.performance30d?.impressions || 0}</p>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-2.5">
                    <p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">Clicks</p>
                    <p className="mt-1 text-sm font-black text-slate-900">{post.performance30d?.clicks || 0}</p>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-2.5">
                    <p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">CTR</p>
                    <p className="mt-1 text-sm font-black text-slate-900">{post.performance30d?.ctr || 0}%</p>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-2.5">
                    <p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">Leads</p>
                    <p className="mt-1 text-sm font-black text-slate-900">{post.performance30d?.leads || 0}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white/95 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Related Reads</p>
                <div className="mt-3 space-y-3">
                  {related.map((item) => (
                    <a
                      key={item.id}
                      href={`/blog/${item.slug}`}
                      className="block rounded-2xl border border-slate-100 bg-slate-50 p-3 transition hover:border-teal-200 hover:bg-teal-50"
                    >
                      <p className="text-sm font-black text-slate-900">{item.title}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-600 line-clamp-3">{item.excerpt}</p>
                    </a>
                  ))}
                  {!related.length && (
                    <p className="text-xs font-semibold text-slate-500">No related posts yet.</p>
                  )}
                </div>
              </div>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
};

export default BlogPostPage;
