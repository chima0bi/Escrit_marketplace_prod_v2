import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';

// Always-visible reminder of which payment mode the platform is in. Test mode
// tells visitors (and judges) that no real money moves; live mode is loud on purpose.
export default function PaymentModeRibbon() {
  const [mode, setMode] = useState(null);

  useEffect(() => {
    let active = true;
    const load = () => api.getPublicConfig().then((config) => active && setMode(config.paymentMode)).catch(() => {});
    load();
    const onChanged = (event) => (event.detail ? setMode(event.detail) : load());
    window.addEventListener('escrit:payment-mode-changed', onChanged);
    return () => { active = false; window.removeEventListener('escrit:payment-mode-changed', onChanged); };
  }, []);

  if (!mode) return null;
  const live = mode === 'live';
  return (
    <div role="status" className={`px-4 py-1.5 text-center text-xs font-medium ${live ? 'bg-dispute text-white' : 'bg-seal-soft text-seal'}`}>
      {live ? 'LIVE payments: real money is being charged and paid out.' : 'Test mode: no real money moves. Pay with a Paystack test card.'}
    </div>
  );
}
