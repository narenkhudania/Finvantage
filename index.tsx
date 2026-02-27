
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import AdminPage from './components/admin/AdminPage';
import BlogIndexPage from './components/blog/BlogIndexPage';
import BlogPostPage from './components/blog/BlogPostPage';

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
    <Entry />
  </React.StrictMode>
);
