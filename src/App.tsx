import React from 'react';
import Home from './pages/Home';
import ApiPage from './pages/api';
import FeaturesPage from './pages/features';

export default function App() {
  const [path, setPath] = React.useState(window.location.pathname);

  React.useEffect(() => {
    const onPopState = () => setPath(window.location.pathname);
    window.addEventListener('popstate', onPopState);

    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest('a') as HTMLAnchorElement | null;
      if (!anchor) return;

      const href = anchor.getAttribute('href');
      const targetAttr = anchor.getAttribute('target');

      if (!href || href.startsWith('http') || href.startsWith('#') || targetAttr === '_blank') return;
      event.preventDefault();
      window.history.pushState({}, '', href);
      setPath(window.location.pathname);
      window.scrollTo({ top: 0, behavior: 'auto' });
    };

    document.addEventListener('click', onClick);

    return () => {
      window.removeEventListener('popstate', onPopState);
      document.removeEventListener('click', onClick);
    };
  }, []);

  if (path === '/api') {
    return <ApiPage />;
  }

  if (path === '/features') {
    return <FeaturesPage />;
  }

  return <Home />;
}
