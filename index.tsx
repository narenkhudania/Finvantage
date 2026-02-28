import React, { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const AdminPage = lazy(() => import('./components/admin/AdminPage'));
const BlogIndexPage = lazy(() => import('./components/blog/BlogIndexPage'));
const BlogPostPage = lazy(() => import('./components/blog/BlogPostPage'));

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
const pathname = window.location.pathname.replace(/\/+$/, '') || '/';

const Entry: React.ComponentType =
  pathname.startsWith('/admin')
    ? AdminPage
    : pathname === '/blog' || pathname === '/blogs'
    ? BlogIndexPage
    : pathname.startsWith('/blog/')
    ? (() => <BlogPostPage slug={decodeURIComponent(pathname.replace('/blog/', ''))} />)
    : pathname.startsWith('/blogs/')
    ? (() => <BlogPostPage slug={decodeURIComponent(pathname.replace('/blogs/', ''))} />)
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
