import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { api } from '../../lib/api.js';
import { useAuthContext } from '../../lib/AuthContext.jsx';
import { usePageTitle } from '../../lib/usePageTitle.js';

export default function VerifyEmail() {
  usePageTitle('Verify your email');
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next') || '/dashboard';
  const { seller, refreshSeller } = useAuthContext();

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [resent, setResent] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.verifyOtp(code);
      await refreshSeller();
      navigate(next);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function onResend() {
    setError(null);
    setResent(false);
    try {
      await api.resendOtp();
      setResent(true);
    } catch (err) {
      setError(err.message);
    }
  }

  if (seller?.emailVerified) {
    return (
      <div className="animate-fade-in-up">
        <h1 className="font-display text-2xl mb-2">You're already verified</h1>
        <p className="text-ink/60">
          <Link to={next} className="underline">Continue</Link>
        </p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up">
      <h1 className="font-display text-2xl mb-1">Verify your email</h1>
      <p className="text-ink/60 mb-6">
        Enter the 6-digit code we sent to <span className="text-ink font-medium">{seller?.email}</span>.
      </p>

      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block">
          <span className="text-sm text-ink/70">Verification code</span>
          <input
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            required
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            className="mt-1 w-full border border-line px-3 py-2 bg-input focus:border-ink/50 rounded-lg tracking-[0.3em] text-center font-mono text-lg"
            placeholder="000000"
          />
        </label>

        {error && <p className="text-dispute text-sm animate-fade-in-up" role="alert">{error}</p>}
        {resent && <p className="text-released text-sm animate-fade-in-up">A new code is on its way.</p>}

        <button disabled={loading || code.length !== 6} className="w-full bg-ink text-paper py-3 font-medium disabled:opacity-50 hover:bg-ink/90 transition-colors rounded-lg">
          {loading ? 'Verifying…' : 'Verify'}
        </button>
      </form>

      <p className="text-sm text-ink/60 mt-4">
        Didn't get a code?{' '}
        <button type="button" onClick={onResend} className="underline underline-offset-2">
          Resend it
        </button>
      </p>
      <p className="text-xs text-ink/50 mt-6">
        <Link to={next} className="underline">Skip for now</Link>
      </p>
    </div>
  );
}
