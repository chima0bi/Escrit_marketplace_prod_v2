import { useState } from 'react';
import StatusBadge from './StatusBadge.jsx';
import LifecycleStepper from './LifecycleStepper.jsx';
import { ShieldCheckIcon } from './icons.jsx';

const PRICE = '₦18,500';

// Demo stage -> the real escrow status it represents.
const STATUS = { held: 'PAID_HELD', delivered: 'PAID_HELD', released: 'RELEASED', disputed: 'DISPUTED' };

const MESSAGE = {
  held: `${PRICE} is held in escrow. The seller cannot touch it yet.`,
  delivered: 'The seller marked this order delivered. Review the delivery, then confirm or raise a dispute.',
  released: `${PRICE} was sent to the seller's bank account.`,
  disputed: 'Release is frozen. The payment stays held while the team reviews it.',
};

// Interactive walk-through of the buyer's side, using the same badge and
// stepper as the real app. It is local state only: no money moves.
export default function EscrowDemo({ compact = false }) {
  const [stage, setStage] = useState('idle'); // idle | held | released | disputed
  const status = STATUS[stage];

  return (
    <div className="w-full max-w-md mx-auto lg:mx-0 lg:ml-auto">
      <div className="certificate p-4 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-display text-base break-words sm:text-xl">Vintage denim jacket, size M</p>
            <p className="mt-0.5 hidden text-sm text-ink/60 sm:block">Lightly worn, no marks. Ships from Lagos.</p>
          </div>
          {status && <StatusBadge status={status} />}
        </div>

        <p className="my-2 font-mono text-2xl font-medium sm:my-4 sm:text-3xl">{PRICE}</p>

        <div className={`${compact ? 'hidden sm:block' : ''} mb-4`}>
          <LifecycleStepper status={status} />
        </div>

        <div className={`${compact ? 'hidden sm:block' : ''} border-t border-line pt-4 text-sm`}>
          <p className="text-ink/60">Seller</p>
          <p className="font-medium">Adaeze Fashion House</p>
          <p className="text-ink/60 mt-1 flex items-start gap-1.5">
            <ShieldCheckIcon width={14} height={14} className="text-released shrink-0 mt-0.5" />
            <span>
              Bank-verified as <span className="text-ink font-medium">ADAEZE OKAFOR</span>
            </span>
          </p>
        </div>

        <div className="mt-3 min-h-[8rem] sm:mt-5 sm:min-h-[11rem]" aria-live="polite">
          {stage === 'idle' && (
            <div className="space-y-3">
              <button
                onClick={() => setStage('held')}
                className="w-full bg-ink text-paper py-3 font-medium rounded-lg hover:bg-ink/90 transition-colors animate-pulse-soft"
              >
                Pay {PRICE} into escrow
              </button>
              <p className="text-xs text-ink/50 text-center">
                Your payment is held, not sent to the seller, until you confirm.
              </p>
            </div>
          )}

          {stage === 'held' && (
            <div className="space-y-3 animate-fade-in">
              <p className="text-sm text-ink/70">{MESSAGE.held}</p>
              <p className="text-xs text-ink/50">The seller adds tracking updates while your payment stays held.</p>
              <button
                onClick={() => setStage('delivered')}
                className="w-full border border-line py-3 font-medium rounded-lg hover:border-ink transition-colors"
              >
                Seller marks item delivered
              </button>
            </div>
          )}

          {stage === 'delivered' && (
            <div className="space-y-3 animate-fade-in">
              <p className="text-sm text-ink/70">{MESSAGE.delivered}</p>
              <button
                onClick={() => setStage('released')}
                className="w-full bg-released text-paper py-3 font-medium rounded-lg hover:bg-released/90 transition-colors"
              >
                Confirm delivery and release payment
              </button>
              <button
                onClick={() => setStage('disputed')}
                className="w-full border border-dispute text-dispute py-3 font-medium rounded-lg hover:bg-dispute hover:text-paper transition-colors"
              >
                Something is wrong
              </button>
            </div>
          )}

          {(stage === 'released' || stage === 'disputed') && (
            <div className="space-y-3 animate-fade-in">
              <p className="text-sm text-ink/70">{MESSAGE[stage]}</p>
              <button
                onClick={() => setStage('idle')}
                className="text-sm font-medium underline underline-offset-2 hover:text-ink/70"
              >
                Start over
              </button>
            </div>
          )}
        </div>
      </div>
      <p className="text-xs text-ink/45 mt-3 text-center lg:text-right">Interactive demo. No real money moves.</p>
    </div>
  );
}
