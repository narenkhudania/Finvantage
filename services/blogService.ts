import { supabase } from './supabase';

export type BlogStatus = 'draft' | 'scheduled' | 'published' | 'archived';

export interface BlogSeoCheck {
  id: string;
  label: string;
  passed: boolean;
  tip: string;
}

export interface BlogSeoAssessment {
  score: number;
  wordCount: number;
  readMinutes: number;
  checks: BlogSeoCheck[];
}

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  contentMarkdown: string;
  status: BlogStatus;
  publishedAt: string | null;
  scheduledFor: string | null;
  targetKeyword: string;
  secondaryKeywords: string[];
  tags: string[];
  metaTitle: string;
  metaDescription: string;
  canonicalUrl: string;
  ogImageUrl: string;
  ctaText: string;
  ctaUrl: string;
  internalLinkTargets: string[];
  externalReferences: string[];
  schemaType: string;
  faqSchema: Record<string, unknown>[];
  promotionChecklist: Record<string, boolean>;
  organicScore: number;
  wordCount: number;
  estimatedReadMinutes: number;
  isFeatured: boolean;
  createdAt: string;
  updatedAt: string;
  performance30d?: {
    impressions: number;
    clicks: number;
    ctr: number;
    organicSessions: number;
    leads: number;
  };
}

export interface BlogPostInput {
  id?: string;
  title: string;
  slug?: string;
  excerpt?: string;
  contentMarkdown?: string;
  status: BlogStatus;
  publishedAt?: string | null;
  scheduledFor?: string | null;
  targetKeyword?: string;
  secondaryKeywords?: string[];
  tags?: string[];
  metaTitle?: string;
  metaDescription?: string;
  canonicalUrl?: string;
  ogImageUrl?: string;
  ctaText?: string;
  ctaUrl?: string;
  internalLinkTargets?: string[];
  externalReferences?: string[];
  schemaType?: string;
  faqSchema?: Record<string, unknown>[];
  promotionChecklist?: Record<string, boolean>;
  isFeatured?: boolean;
}

const num = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
};

const toObject = (value: unknown): Record<string, boolean> => {
  if (!value || typeof value !== 'object') return {};
  const out: Record<string, boolean> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    out[key] = Boolean(raw);
  }
  return out;
};

const isMissingRelationError = (error: unknown) => {
  const code = (error as { code?: string } | null)?.code;
  return code === '42P01' || code === 'PGRST205' || code === 'PGRST204';
};

const mapBlogPost = (row: Record<string, any>): BlogPost => ({
  id: String(row.id),
  title: String(row.title || ''),
  slug: String(row.slug || ''),
  excerpt: String(row.excerpt || ''),
  contentMarkdown: String(row.content_markdown || ''),
  status: String(row.status || 'draft') as BlogStatus,
  publishedAt: row.published_at || null,
  scheduledFor: row.scheduled_for || null,
  targetKeyword: String(row.target_keyword || ''),
  secondaryKeywords: toStringArray(row.secondary_keywords),
  tags: toStringArray(row.tags),
  metaTitle: String(row.meta_title || ''),
  metaDescription: String(row.meta_description || ''),
  canonicalUrl: String(row.canonical_url || ''),
  ogImageUrl: String(row.og_image_url || ''),
  ctaText: String(row.cta_text || ''),
  ctaUrl: String(row.cta_url || ''),
  internalLinkTargets: toStringArray(row.internal_link_targets),
  externalReferences: toStringArray(row.external_references),
  schemaType: String(row.schema_type || 'Article'),
  faqSchema: Array.isArray(row.faq_schema) ? row.faq_schema : [],
  promotionChecklist: toObject(row.promotion_checklist),
  organicScore: num(row.organic_score),
  wordCount: num(row.word_count),
  estimatedReadMinutes: num(row.estimated_read_minutes, 3),
  isFeatured: Boolean(row.is_featured),
  createdAt: String(row.created_at || new Date().toISOString()),
  updatedAt: String(row.updated_at || row.created_at || new Date().toISOString()),
});

export const slugify = (raw: string) =>
  raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 90) || `post-${Date.now()}`;

const countWords = (text: string) => {
  const cleaned = text.replace(/[#*_`>\-]/g, ' ').replace(/\s+/g, ' ').trim();
  return cleaned ? cleaned.split(' ').length : 0;
};

const estimateReadMinutes = (wordCount: number) => Math.max(1, Math.ceil(wordCount / 220));

export const evaluateBlogSeo = (payload: {
  title: string;
  excerpt?: string;
  contentMarkdown?: string;
  targetKeyword?: string;
  metaTitle?: string;
  metaDescription?: string;
  ctaText?: string;
  ctaUrl?: string;
  ogImageUrl?: string;
}) => {
  const title = (payload.title || '').trim();
  const excerpt = (payload.excerpt || '').trim();
  const content = (payload.contentMarkdown || '').trim();
  const keyword = (payload.targetKeyword || '').trim().toLowerCase();
  const metaTitle = (payload.metaTitle || '').trim();
  const metaDescription = (payload.metaDescription || '').trim();
  const ctaText = (payload.ctaText || '').trim();
  const ctaUrl = (payload.ctaUrl || '').trim();
  const ogImageUrl = (payload.ogImageUrl || '').trim();

  const wordCount = countWords(content);
  const readMinutes = estimateReadMinutes(wordCount);

  const earlyContent = content.slice(0, 850).toLowerCase();
  const contentLower = content.toLowerCase();

  const checks: BlogSeoCheck[] = [
    {
      id: 'title-length',
      label: 'Search-ready title (40-65 chars)',
      passed: title.length >= 40 && title.length <= 65,
      tip: 'Keep title concise with benefit + intent keyword.',
    },
    {
      id: 'meta-title',
      label: 'Meta title is optimized (50-60 chars)',
      passed: metaTitle.length >= 50 && metaTitle.length <= 60,
      tip: 'Use a compelling value proposition in meta title.',
    },
    {
      id: 'meta-description',
      label: 'Meta description is optimized (140-160 chars)',
      passed: metaDescription.length >= 140 && metaDescription.length <= 160,
      tip: 'Describe who this is for and what they gain.',
    },
    {
      id: 'primary-keyword',
      label: 'Primary keyword appears in title and intro',
      passed: Boolean(keyword) && title.toLowerCase().includes(keyword) && earlyContent.includes(keyword),
      tip: 'Place the target keyword in title and first 100-150 words.',
    },
    {
      id: 'content-depth',
      label: 'Content depth is strong (>= 900 words)',
      passed: wordCount >= 900,
      tip: 'Long-form educational content ranks better for high-intent queries.',
    },
    {
      id: 'internal-link',
      label: 'Includes internal links',
      passed: /\]\((\/|https?:\/\/[^)]*finvantage[^)]*)\)/i.test(contentLower),
      tip: 'Add 2-4 internal links to related planning tools/blogs.',
    },
    {
      id: 'cta',
      label: 'Has a clear CTA for conversion',
      passed: Boolean(ctaText) && Boolean(ctaUrl),
      tip: 'Add a next action like “Run your risk profile”.',
    },
    {
      id: 'og-image',
      label: 'Open Graph image is provided',
      passed: Boolean(ogImageUrl),
      tip: 'Use a social preview image for better CTR in shares.',
    },
    {
      id: 'excerpt',
      label: 'Excerpt is concise and clear (120-220 chars)',
      passed: excerpt.length >= 120 && excerpt.length <= 220,
      tip: 'Write a one-paragraph preview that mirrors search intent.',
    },
  ];

  const passed = checks.filter((item) => item.passed).length;
  const score = Math.round((passed / checks.length) * 100);

  return {
    score,
    wordCount,
    readMinutes,
    checks,
  } as BlogSeoAssessment;
};

export const listAdminBlogPosts = async (params?: {
  status?: BlogStatus | 'all';
  search?: string;
  limit?: number;
}): Promise<BlogPost[]> => {
  let query = supabase
    .from('blog_posts')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(Math.max(5, Math.min(params?.limit || 120, 500)));

  if (params?.status && params.status !== 'all') {
    query = query.eq('status', params.status);
  }

  if (params?.search?.trim()) {
    const q = params.search.trim();
    query = query.or(`title.ilike.%${q}%,slug.ilike.%${q}%,target_keyword.ilike.%${q}%`);
  }

  const { data, error } = await query;
  if (error) {
    if (isMissingRelationError(error)) return [];
    throw error;
  }

  const posts = (data || []).map((row: any) => mapBlogPost(row));
  const perf = await getBlogPerformance30d(posts.map((item) => item.id));

  return posts.map((post) => ({
    ...post,
    performance30d: perf.get(post.id) || {
      impressions: 0,
      clicks: 0,
      ctr: 0,
      organicSessions: 0,
      leads: 0,
    },
  }));
};

export const getAdminBlogPost = async (id: string): Promise<BlogPost | null> => {
  const { data, error } = await supabase.from('blog_posts').select('*').eq('id', id).maybeSingle();
  if (error) {
    if (isMissingRelationError(error)) return null;
    throw error;
  }
  return data ? mapBlogPost(data as any) : null;
};

export const saveAdminBlogPost = async (input: BlogPostInput): Promise<BlogPost> => {
  const title = input.title.trim();
  if (!title) {
    throw new Error('Blog title is required.');
  }

  const slug = slugify(input.slug?.trim() || title);
  const assessment = evaluateBlogSeo({
    title,
    excerpt: input.excerpt,
    contentMarkdown: input.contentMarkdown,
    targetKeyword: input.targetKeyword,
    metaTitle: input.metaTitle,
    metaDescription: input.metaDescription,
    ctaText: input.ctaText,
    ctaUrl: input.ctaUrl,
    ogImageUrl: input.ogImageUrl,
  });

  const { data: authData } = await supabase.auth.getUser();
  const actorId = authData.user?.id || null;
  const nowIso = new Date().toISOString();

  const status = input.status || 'draft';
  const isPublished = status === 'published';

  const payload = {
    title,
    slug,
    excerpt: input.excerpt?.trim() || null,
    content_markdown: input.contentMarkdown || '',
    status,
    published_at: isPublished ? input.publishedAt || nowIso : null,
    scheduled_for: status === 'scheduled' ? input.scheduledFor || null : null,
    author_user_id: actorId,
    target_keyword: input.targetKeyword?.trim() || null,
    secondary_keywords: (input.secondaryKeywords || []).map((item) => item.trim()).filter(Boolean),
    tags: (input.tags || []).map((item) => item.trim()).filter(Boolean),
    meta_title: input.metaTitle?.trim() || null,
    meta_description: input.metaDescription?.trim() || null,
    canonical_url: input.canonicalUrl?.trim() || null,
    og_image_url: input.ogImageUrl?.trim() || null,
    cta_text: input.ctaText?.trim() || null,
    cta_url: input.ctaUrl?.trim() || null,
    internal_link_targets: (input.internalLinkTargets || []).map((item) => item.trim()).filter(Boolean),
    external_references: (input.externalReferences || []).map((item) => item.trim()).filter(Boolean),
    schema_type: input.schemaType || 'Article',
    faq_schema: input.faqSchema || [],
    promotion_checklist: input.promotionChecklist || {},
    organic_score: assessment.score,
    word_count: assessment.wordCount,
    estimated_read_minutes: assessment.readMinutes,
    is_featured: Boolean(input.isFeatured),
    updated_by: actorId,
    updated_at: nowIso,
  };

  if (input.id) {
    const { data, error } = await supabase
      .from('blog_posts')
      .update(payload)
      .eq('id', input.id)
      .select('*')
      .single();

    if (error) throw error;
    return mapBlogPost(data as any);
  }

  const { data, error } = await supabase
    .from('blog_posts')
    .insert({ ...payload, created_by: actorId })
    .select('*')
    .single();

  if (error) throw error;
  return mapBlogPost(data as any);
};

export const setAdminBlogPostStatus = async (
  id: string,
  status: BlogStatus
): Promise<void> => {
  const patch: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (status === 'published') {
    patch.published_at = new Date().toISOString();
  }

  const { error } = await supabase.from('blog_posts').update(patch).eq('id', id);
  if (error) throw error;
};

export const deleteAdminBlogPost = async (id: string): Promise<void> => {
  const { error } = await supabase.from('blog_posts').delete().eq('id', id);
  if (error) throw error;
};

export const listPublishedBlogPosts = async (limit = 30): Promise<BlogPost[]> => {
  const { data, error } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('status', 'published')
    .lte('published_at', new Date().toISOString())
    .order('published_at', { ascending: false })
    .limit(Math.max(5, Math.min(limit, 120)));

  if (error) {
    if (isMissingRelationError(error)) return [];
    throw error;
  }

  const posts = (data || []).map((row: any) => mapBlogPost(row));
  const perf = await getBlogPerformance30d(posts.map((item) => item.id));
  return posts.map((post) => ({ ...post, performance30d: perf.get(post.id) }));
};

export const getPublishedBlogPostBySlug = async (slug: string): Promise<BlogPost | null> => {
  const { data, error } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'published')
    .lte('published_at', new Date().toISOString())
    .maybeSingle();

  if (error) {
    if (isMissingRelationError(error)) return null;
    throw error;
  }

  return data ? mapBlogPost(data as any) : null;
};

export const getBlogPerformance30d = async (postIds: string[]) => {
  const map = new Map<string, { impressions: number; clicks: number; ctr: number; organicSessions: number; leads: number }>();
  if (!postIds.length) return map;

  const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from('blog_post_performance_snapshots')
    .select('post_id, impressions, clicks, ctr, organic_sessions, leads, snapshot_date')
    .in('post_id', postIds)
    .gte('snapshot_date', startDate);

  if (error) {
    if (isMissingRelationError(error)) return map;
    throw error;
  }

  (data || []).forEach((row: any) => {
    const key = String(row.post_id);
    const current = map.get(key) || { impressions: 0, clicks: 0, ctr: 0, organicSessions: 0, leads: 0 };
    current.impressions += num(row.impressions);
    current.clicks += num(row.clicks);
    current.organicSessions += num(row.organic_sessions);
    current.leads += num(row.leads);
    map.set(key, current);
  });

  for (const [key, value] of map.entries()) {
    map.set(key, {
      ...value,
      ctr: value.impressions > 0 ? Number(((value.clicks / value.impressions) * 100).toFixed(2)) : 0,
    });
  }

  return map;
};
