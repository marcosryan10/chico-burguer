// Keep navigation native for this server-rendered, progressively enhanced storefront.
// Hash links scroll locally; page links perform a full load so each page's script initializes.
document.addEventListener(
  'click',
  (event) => {
    const anchor = event.target.closest?.('a[href]');
    if (
      !anchor ||
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      anchor.hasAttribute('download') ||
      (anchor.target && anchor.target !== '_self')
    )
      return;
    const url = new URL(anchor.href, location.href);
    if (url.origin !== location.origin) return;
    event.preventDefault();
    event.stopPropagation();
    if (
      url.pathname === location.pathname &&
      url.search === location.search &&
      anchor.getAttribute('href').includes('#')
    ) {
      const id = decodeURIComponent(url.hash.slice(1));
      const element = id ? document.getElementById(id) : document.documentElement;
      element?.scrollIntoView({
        block: 'start',
        behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      });
      return;
    }
    location.assign(url.href);
  },
  true,
);
