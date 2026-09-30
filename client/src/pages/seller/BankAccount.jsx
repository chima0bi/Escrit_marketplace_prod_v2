import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { api } from '../../lib/api.js';
import { useAuthContext } from '../../lib/AuthContext.jsx';
import { BankIcon, ShieldCheckIcon, CheckCircleIcon } from '../../components/icons.jsx';
import { usePageTitle } from '../../lib/usePageTitle.js';
import SpotlightTour from '../../components/SpotlightTour.jsx';

const TOUR_STEPS = [
  {
    selector: '[data-tour="bank-form"]',
    title: 'Add your payout account',
    body: 'Choose your bank and enter your 10-digit account number. The configured provider resolves the account name; buyers see the verified name before checkout.',
  },
];

// Payout setup, the first step for every seller: the bank account is
// verified with the configured payment provider, and its registered name is shown to buyers.
// Reachable from the nav and from any action blocked without an account.
export default function BankAccount() {
  usePageTitle('Bank account');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const nextPath = searchParams.get('next') || '/dashboard';
  const { seller, refreshSeller } = useAuthContext();

  const [banks, setBanks] = useState(null);
  const [banksError, setBanksError] = useState(null);
  const [form, setForm] = useState({ bankCode: '', accountNumber: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(null); // resolved account, once saved

  useEffect(() => {
    api
      .listBanks()
      .then((d) => setBanks(d.banks))
      .catch((err) => setBanksError(err.message));
  }, []);

  const alreadyHasAccount = Boolean(seller?.bankAccount) && !saved;

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const bank = banks?.find((b) => b.code === form.bankCode);
      const { seller: updated } = await api.saveBankAccount({
        accountNumber: form.accountNumber,
        bankCode: form.bankCode,
        bankName: bank?.name || '',
      });
      await refreshSeller();
      setSaved(updated.bankAccount);
    } catch (err) {
      // Usually a bank/account-number mismatch; shown as-is so the seller can fix it.
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="animate-fade-in-up">
      <div className="flex items-center gap-2 mb-1 text-seal">
        <BankIcon />
        <span className="text-xs font-medium uppercase tracking-wide">Payout destination</span>
      </div>
      <h1 className="font-display text-2xl mb-1">Where should we send your money?</h1>
      <p className="text-ink/60 mb-6 max-w-md">
        The configured provider checks this account with your bank before we save it. The registered name is shown to every
        buyer before they pay, so a fake account cannot collect their money.
      </p>

      {saved ? (
        <div
          data-tour="bank-saved"
          className="certificate p-6 animate-pop-in border-released/40 bg-released-soft"
        >
          <div className="flex items-center gap-2 text-released mb-3">
            <CheckCircleIcon />
            <span className="font-medium">Account verified</span>
          </div>
          <dl className="text-sm space-y-1.5">
            <Row label="Bank" value={saved.bankName} />
            <Row label="Account number" value={maskAccount(saved.accountNumber)} />
            <Row label="Verified name" value={saved.resolvedAccountName} strong />
          </dl>
          <p className="text-xs text-ink/50 mt-4">
            Buyers see this verified name as proof your payout account is real.
          </p>
          <button
            onClick={() => navigate(nextPath)}
            className="w-full mt-5 bg-ink text-paper py-3 font-medium hover:bg-ink/90 transition-colors rounded-lg"
          >
            Continue
          </button>
        </div>
      ) : (
        <>
          {alreadyHasAccount && (
            <div className="certificate p-4 mb-6 bg-released-soft border-released/40 flex items-start gap-3 animate-fade-in-up">
              <ShieldCheckIcon className="text-released shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-released">
                  You already have a verified account on file
                </p>
                <dl className="mt-1 space-y-0.5 text-ink/70">
                  <Row label="Bank" value={seller.bankAccount.bankName} compact />
                  <Row label="Verified name" value={seller.bankAccount.resolvedAccountName} compact />
                </dl>
                <p className="mt-2 text-ink/50">Saving a new account below will replace it.</p>
              </div>
            </div>
          )}

          {banksError && (
            <p className="text-dispute text-sm mb-4">
              Couldn't load the bank list ({banksError}). Refresh to try again.
            </p>
          )}

          <form onSubmit={onSubmit} className="space-y-4" data-tour="bank-form">
            <label className="block">
              <span className="text-sm text-ink/70">Bank</span>
              {!banks && !banksError ? (
                <div className="skeleton h-10 w-full mt-1" />
              ) : (
                <select
                  required
                  value={form.bankCode}
                  onChange={(e) => setForm({ ...form, bankCode: e.target.value })}
                  className="mt-1 w-full border border-line px-3 py-2 bg-input focus:border-ink/50 rounded-lg"
                >
                  <option value="" disabled>
                    Select your bank
                  </option>
                  {banks?.map((b, i) => (
                    <option key={`${b.code}-${b.id ?? i}`} value={b.code}>
                      {b.name}
                    </option>
                  ))}
                </select>
              )}
            </label>

            <label className="block">
              <span className="text-sm text-ink/70">Account number</span>
              <input
                required
                inputMode="numeric"
                pattern="\d{10}"
                maxLength={10}
                title="10-digit NUBAN account number"
                value={form.accountNumber}
                onChange={(e) =>
                  setForm({ ...form, accountNumber: e.target.value.replace(/\D/g, '') })
                }
                placeholder="10-digit account number"
                className="mt-1 w-full border border-line px-3 py-2 bg-input focus:border-ink/50 rounded-lg font-mono tracking-wide"
              />
            </label>

            {error && (
              <p className="text-dispute text-sm animate-fade-in-up" role="alert">
                {error}
              </p>
            )}

            <button
              disabled={submitting || !banks}
              className="w-full bg-ink text-paper py-3 font-medium disabled:opacity-50 hover:bg-ink/90 transition-colors rounded-lg"
            >
              {submitting ? 'Checking account…' : 'Verify and save'}
            </button>
          </form>

          <p className="text-xs text-ink/50 mt-4">
            <Link to={nextPath} className="underline">
              Skip for now
            </Link>{' '}
            You can add this later, but you cannot create a payment link until you do.
          </p>
        </>
      )}
      <SpotlightTour storageKey="escrit_seller_tour_bank" steps={TOUR_STEPS} />
    </div>
  );
}

function maskAccount(num) {
  if (!num || num.length < 4) return num;
  return `••••••${num.slice(-4)}`;
}

function Row({ label, value, strong, compact }) {
  return (
    <div className={`flex justify-between gap-4 ${compact ? '' : 'py-0.5'}`}>
      <span className="text-ink/60 shrink-0">{label}</span>
      <span className={`text-right break-words min-w-0 ${strong ? 'font-display text-base' : 'font-medium font-mono text-sm'}`}>{value}</span>
    </div>
  );
}
