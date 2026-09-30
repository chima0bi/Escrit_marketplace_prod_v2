import { ShieldCheckIcon } from './icons.jsx';

// Explains, in plain language, who resolves a dispute and how. `compact`
// drops the heading where the surrounding text already sets the context.
export default function DisputePolicyNote({ compact = false }) {
  return (
    <div className="text-xs text-ink/60 certificate p-3 flex items-start gap-2">
      <ShieldCheckIcon width={14} height={14} className="shrink-0 mt-0.5 text-seal" />
      <div className="space-y-1">
        {!compact && <p className="font-medium text-ink/80">How this gets resolved</p>}
        <p className="break-words">
          A person on Escrit&#39;s dispute team reviews every dispute. The reason is recorded on the
          order, both sides can be asked for more detail, and the payment stays held throughout. The
          outcome and a written reason are then shown to the buyer and the seller.
        </p>
      </div>
    </div>
  );
}
