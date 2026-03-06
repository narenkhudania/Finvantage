import React, { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const AdminPage = lazy(() => import('./components/admin/AdminPage'));
const BlogIndexPage = lazy(() => import('./components/blog/BlogIndexPage'));
const BlogPostPage = lazy(() => import('./components/blog/BlogPostPage'));
const SupportDeskPage = lazy(async () => ({
  default: (await import('./components/site/PublicInfoPages')).SupportDeskPage,
}));
const StaticInfoPage = lazy(async () => ({
  default: (await import('./components/site/PublicInfoPages')).StaticInfoPage,
}));
const BillingResultPage = lazy(async () => ({
  default: (await import('./components/site/BillingPages')).BillingResultPage,
}));

const BillingSuccessEntry: React.FC = () => <BillingResultPage status="success" />;
const BillingFailedEntry: React.FC = () => <BillingResultPage status="failed" />;
const BillingCancelledEntry: React.FC = () => <BillingResultPage status="cancelled" />;

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
const pathname = window.location.pathname.replace(/\/+$/, '') || '/';
const normalizedPath = pathname.toLowerCase();
const hostname = window.location.hostname.toLowerCase();
const isLocalHost =
  hostname === 'localhost' ||
  hostname === '127.0.0.1' ||
  hostname === '0.0.0.0' ||
  hostname.endsWith('.local');
const isAdminHost = hostname.startsWith('admin.');
const wantsAdminPath = normalizedPath.startsWith('/admin');
const useAdminSurface = isAdminHost || (isLocalHost && wantsAdminPath);

// Enforce app-surface split:
// - admin host => always admin control plane
// - customer host => /admin is blocked in production hosts
if (isAdminHost && normalizedPath !== '/admin') {
  window.history.replaceState({}, '', '/admin');
}
if (!useAdminSurface && wantsAdminPath) {
  window.history.replaceState({}, '', '/');
}

const pathParts = pathname.split('/').filter(Boolean);
const blogSlug = pathParts.length >= 2 ? pathParts.slice(1).join('/') : '';

const Entry: React.ComponentType =
  useAdminSurface
    ? AdminPage
    : normalizedPath === '/support' || normalizedPath === '/contact' || normalizedPath === '/contact-us'
    ? SupportDeskPage
    : normalizedPath === '/billing/manage' || normalizedPath === '/settings/billing' || normalizedPath === '/pricing' || normalizedPath === '/data-and-trust'
    ? App
    : normalizedPath === '/billing/success'
    ? BillingSuccessEntry
    : normalizedPath === '/billing/failed'
    ? BillingFailedEntry
    : normalizedPath === '/billing/cancelled'
    ? BillingCancelledEntry
    : normalizedPath === '/subscription-terms' || normalizedPath === '/legal/terms' ||
      normalizedPath === '/refund-policy' || normalizedPath === '/legal/refund-policy' ||
      normalizedPath === '/cancellation-policy' || normalizedPath === '/legal/cancellation-policy'
    ? App
    : normalizedPath === '/faq'
    ? (() => <StaticInfoPage page="faq" />)
    : normalizedPath === '/privacy-policy' || normalizedPath === '/privacy'
    ? (() => <StaticInfoPage page="privacy" />)
    : normalizedPath === '/terms-and-condition' || normalizedPath === '/terms-and-conditions' || normalizedPath === '/terms'
    ? (() => <StaticInfoPage page="terms" />)
    : normalizedPath === '/legal'
    ? (() => <StaticInfoPage page="legal" />)
    : normalizedPath === '/site-map' || normalizedPath === '/sitemap'
    ? (() => <StaticInfoPage page="sitemap" />)
    : normalizedPath === '/about'
    ? (() => <StaticInfoPage page="about" />)
    : normalizedPath === '/blog' || normalizedPath === '/blogs'
    ? BlogIndexPage
    : normalizedPath.startsWith('/blog/')
    ? (() => <BlogPostPage slug={decodeURIComponent(blogSlug)} />)
    : normalizedPath.startsWith('/blogs/')
    ? (() => <BlogPostPage slug={decodeURIComponent(blogSlug)} />)
    : App;

root.render(
  <React.StrictMode>
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center space-y-3">
            <div className="w-10 h-10 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-slate-500 text-xs font-black uppercase tracking-widest">Loading experience...</p>
          </div>
        </div>
      }
    >
      <Entry />
    </Suspense>
  </React.StrictMode>
);
