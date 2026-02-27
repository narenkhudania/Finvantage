interface SeoPayload {
  title: string;
  description: string;
  canonicalUrl?: string;
  imageUrl?: string;
  type?: 'website' | 'article';
  keywords?: string[];
  robots?: string;
  jsonLd?: Record<string, unknown>;
}

const upsertMeta = (selector: string, attributes: Record<string, string>, content: string) => {
  let tag = document.head.querySelector<HTMLMetaElement>(selector);
  if (!tag) {
    tag = document.createElement('meta');
    Object.entries(attributes).forEach(([key, value]) => tag!.setAttribute(key, value));
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
};

const removeMeta = (selector: string) => {
  const tag = document.head.querySelector(selector);
  if (tag) tag.remove();
};

const upsertCanonical = (href?: string) => {
  if (!href) return;
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }
  link.setAttribute('href', href);
};

const upsertJsonLd = (jsonLd?: Record<string, unknown>) => {
  const id = 'finvantage-seo-jsonld';
  const existing = document.getElementById(id);
  if (!jsonLd) {
    if (existing) existing.remove();
    return;
  }

  const script = existing || document.createElement('script');
  script.id = id;
  script.setAttribute('type', 'application/ld+json');
  script.textContent = JSON.stringify(jsonLd);
  if (!existing) document.head.appendChild(script);
};

export const applySeoMeta = ({
  title,
  description,
  canonicalUrl,
  imageUrl,
  type = 'website',
  keywords,
  robots,
  jsonLd,
}: SeoPayload) => {
  document.title = title;

  upsertMeta('meta[name="description"]', { name: 'description' }, description);
  upsertMeta('meta[property="og:title"]', { property: 'og:title' }, title);
  upsertMeta('meta[property="og:description"]', { property: 'og:description' }, description);
  upsertMeta('meta[property="og:type"]', { property: 'og:type' }, type);
  upsertMeta('meta[name="twitter:card"]', { name: 'twitter:card' }, imageUrl ? 'summary_large_image' : 'summary');
  upsertMeta('meta[name="twitter:title"]', { name: 'twitter:title' }, title);
  upsertMeta('meta[name="twitter:description"]', { name: 'twitter:description' }, description);
  upsertMeta('meta[property="og:url"]', { property: 'og:url' }, canonicalUrl || window.location.href);

  if (Array.isArray(keywords) && keywords.length) {
    upsertMeta('meta[name="keywords"]', { name: 'keywords' }, keywords.join(', '));
  }

  if (robots) {
    upsertMeta('meta[name="robots"]', { name: 'robots' }, robots);
  } else {
    removeMeta('meta[name="robots"]');
  }

  if (imageUrl) {
    upsertMeta('meta[property="og:image"]', { property: 'og:image' }, imageUrl);
    upsertMeta('meta[name="twitter:image"]', { name: 'twitter:image' }, imageUrl);
  } else {
    removeMeta('meta[property="og:image"]');
    removeMeta('meta[name="twitter:image"]');
  }

  upsertCanonical(canonicalUrl);
  upsertJsonLd(jsonLd);
};
