import { useState } from 'react';
import { optimizeImageUrl } from '../lib/cloudinary.js';

// Item image that never shows a broken-image icon: if the URL cannot be
// loaded it renders `fallback` (nothing by default). No-referrer avoids
// hosts that block images requested from other sites.
export default function ItemPhoto({ src, alt, width = 1000, className = '', fallback = null, onLoad, onError }) {
  const [failedSrc, setFailedSrc] = useState(null);

  if (!src) return null;
  if (failedSrc === src) return fallback;

  return (
    <img
      src={optimizeImageUrl(src, width)}
      alt={alt}
      decoding="async"
      referrerPolicy="no-referrer"
      className={className}
      onLoad={onLoad}
      onError={() => {
        setFailedSrc(src);
        onError?.();
      }}
    />
  );
}
