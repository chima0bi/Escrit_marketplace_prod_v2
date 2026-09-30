import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthContext } from '../lib/AuthContext.jsx';
import { api } from '../lib/api.js';

export default function ServiceDealPanel({ service }) {
  const { status, seller } = useAuthContext();
  const navigate = useNavigate();
  const [price, setPrice] = useState(service.basePrice || '');
  const [criteria, setCriteria] = useState('');
  const [appointmentAt, setAppointmentAt] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const isOwner = String(seller?.id || seller?._id) === String(service.seller?._id);

  if (status !== 'authed') {
    return <Link to={`/login?intent=buyer&next=${encodeURIComponent(window.location.pathname)}`} className="mt-5 flex w-full items-center justify-center rounded-lg bg-ink px-4 py-3 text-center font-medium text-paper">Sign in to discuss this service</Link>;
  }
  if (isOwner) return <p className="mt-5 rounded-lg border border-line p-3 text-sm text-ink/60">This is your service listing. View incoming proposals from your account menu.</p>;

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { offer } = await api.createServiceOffer({
        serviceId: service._id,
        priceNaira: Number(price),
        fulfilmentCriteria: criteria,
        appointmentAt: appointmentAt ? new Date(appointmentAt).toISOString() : null,
      });
      navigate(`/account/offers/${offer._id}`);
    } catch (err) {
      setError(err.message || 'Unable to send your proposal.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-5 space-y-3 border-t border-line pt-5">
      <h2 className="text-sm font-semibold">Propose a service deal</h2>
      <label className="block text-sm text-ink/65">Your offer (₦)
        <input type="number" min="100" required value={price} onChange={(event) => setPrice(event.target.value)} className="mt-1 w-full border border-line bg-input px-3 py-2" />
      </label>
      <label className="block text-sm text-ink/65">What should the seller deliver?
        <textarea minLength={5} maxLength={2000} required rows={3} value={criteria} onChange={(event) => setCriteria(event.target.value)} className="mt-1 w-full border border-line bg-input px-3 py-2" placeholder="Describe the agreed scope, outcome, and any milestones." />
      </label>
      <label className="block text-sm text-ink/65">Preferred appointment <span className="text-ink/40">(optional)</span>
        <input type="datetime-local" value={appointmentAt} onChange={(event) => setAppointmentAt(event.target.value)} className="mt-1 w-full border border-line bg-input px-3 py-2" />
      </label>
      {error && <p role="alert" className="text-sm text-dispute">{error}</p>}
      <button disabled={busy} className="w-full rounded-lg bg-ink px-4 py-3 text-sm font-medium text-paper disabled:opacity-50">{busy ? 'Sending…' : 'Send proposal'}</button>
      <p className="text-xs leading-5 text-ink/50">Agree scope and price in chat. The buyer pays through escrow only after the proposal is accepted.</p>
    </form>
  );
}