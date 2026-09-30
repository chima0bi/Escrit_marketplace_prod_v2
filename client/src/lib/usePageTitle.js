import { useEffect } from 'react';

// Sets a per-page browser tab title and restores the previous one on
// unmount. `suffix: false` omits " — Escrit", for pages where the item
// name alone makes a better shared-link title.
export function usePageTitle(title, { suffix = true } = {}) {
  useEffect(() => {
    const previous = document.title;
    document.title = title ? (suffix ? `${title} — Escrit` : title) : previous;
    return () => {
      document.title = previous;
    };
  }, [title, suffix]);
}
