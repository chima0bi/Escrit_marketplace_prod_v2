import { LockIcon, ClockIcon, CheckCircleIcon, AlertIcon } from './icons.jsx';

// One shared status vocabulary for buyers and sellers: same words, colours
// and icons everywhere, so meaning never depends on colour alone.
const STYLES = {
  CREATED: { label: 'Awaiting payment', Icon: LockIcon, className: 'border-line bg-line/20 text-ink/60' },
  PAID_HELD: { label: 'Held in escrow', Icon: ClockIcon, className: 'border-seal/40 bg-seal-soft text-seal animate-pulse-soft' },
  DIRECT_PAID: { label: 'Paid directly', Icon: CheckCircleIcon, className: 'border-released/40 bg-released-soft text-released' },
  DIRECT_COMPLETED: { label: 'Service complete · direct pay', Icon: CheckCircleIcon, className: 'border-released/40 bg-released-soft text-released' },
  RELEASED: { label: 'Released', Icon: CheckCircleIcon, className: 'border-released/40 bg-released-soft text-released' },
  DISPUTED: { label: 'Disputed', Icon: AlertIcon, className: 'border-dispute/40 bg-dispute-soft text-dispute animate-pulse-soft-dispute' },
  RESOLVED_RELEASED: { label: 'Resolved — released', Icon: CheckCircleIcon, className: 'border-released/40 bg-released-soft text-released' },
  RESOLVED_CREDITED: { label: 'Resolved — credits issued', Icon: CheckCircleIcon, className: 'border-released/40 bg-released-soft text-released' },
  RESOLVED_REFUNDED: { label: 'Resolved — refunded', Icon: AlertIcon, className: 'border-dispute/40 bg-dispute-soft text-dispute' },
};

export default function StatusBadge({ status }) {
  const style = STYLES[status] || STYLES.CREATED;
  const { Icon } = style;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition-colors duration-300 ${style.className}`}
    >
      <Icon width={13} height={13} className="shrink-0" />
      {style.label}
    </span>
  );
}
