import { useEffect, useRef, useState } from 'react';

// "Continue with Google". Google Identity Services (loaded in index.html)
// returns a signed ID token in the browser and the API verifies it, so no
// password or client secret is involved. Google's own button is rendered
// (required by their branding rules). Renders nothing when no client ID
// is configured.
export default function GoogleSignInButton({ onCredential, onError }) {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const containerRef = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!clientId) return;

    let cancelled = false;
    // The Google script loads async, so wait for it if it is not ready yet.
    function trySetup() {
      if (cancelled) return;
      if (!window.google?.accounts?.id) {
        setTimeout(trySetup, 100);
        return;
      }
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => {
          if (response?.credential) onCredential(response.credential);
          else onError?.('Google did not return a credential');
        },
      });
      if (containerRef.current) {
        window.google.accounts.id.renderButton(containerRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          shape: 'pill',
          text: 'continue_with',
          width: containerRef.current.offsetWidth || 320,
        });
      }
      setReady(true);
    }
    trySetup();
    return () => {
      cancelled = true;
    };
  }, [clientId, onCredential, onError]);

  if (!clientId) return null;

  return (
    <div className="w-full flex justify-center">
      {/* Google sizes its button from this box at mount, so it needs a real width. */}
      <div ref={containerRef} className={ready ? '' : 'h-10'} style={{ width: '100%', maxWidth: 320 }} />
    </div>
  );
}
