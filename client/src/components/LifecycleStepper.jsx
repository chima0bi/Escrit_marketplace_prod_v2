// "Where is the money right now" stepper. Buyer and seller see the same
// track, so "held" means the same thing on both sides. Pass no status to
// show the track with nothing active yet.
const NORMAL_TRACK = [
  { key: 'CREATED', label: 'Paid in' },
  { key: 'PAID_HELD', label: 'Held' },
  { key: 'RELEASED', label: 'Released' },
];

const DISPUTE_TRACK = [
  { key: 'CREATED', label: 'Paid in' },
  { key: 'PAID_HELD', label: 'Held' },
  { key: 'DISPUTED', label: 'Disputed' },
  { key: 'RESOLVED', label: 'Resolved' },
];

export default function LifecycleStepper({ status }) {
  if (status === 'DIRECT_PAID' || status === 'DIRECT_COMPLETED') return null;
  const isDisputeTrack =
    status === 'DISPUTED' || status === 'RESOLVED_RELEASED' || status === 'RESOLVED_REFUNDED' || status === 'RESOLVED_CREDITED';
  const track = isDisputeTrack ? DISPUTE_TRACK : NORMAL_TRACK;

  let currentIndex;
  if (!status) {
    currentIndex = -1;
  } else if (isDisputeTrack) {
    currentIndex = status === 'DISPUTED' ? 2 : 3;
  } else {
    currentIndex = status === 'CREATED' ? 0 : status === 'PAID_HELD' ? 1 : 2;
  }

  return (
    <div className="flex items-center" aria-label={`Escrow status: ${track[currentIndex]?.label ?? 'not started'}`}>
      {track.map((step, i) => {
        const isDone = i < currentIndex;
        const isActive = i === currentIndex;
        return (
          <div key={step.key} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <span
                className={`lifecycle-dot ${isDone ? 'is-done' : ''} ${isActive ? 'is-active' : ''} ${
                  isActive && step.key === 'DISPUTED' ? 'animate-pulse-soft-dispute' : ''
                } ${isActive && step.key !== 'DISPUTED' ? 'animate-pulse-soft' : ''}`}
              />
              <span
                className={`text-[11px] whitespace-nowrap ${
                  isActive ? 'text-ink font-medium' : isDone ? 'text-released' : 'text-ink/40'
                }`}
              >
                {status === 'RESOLVED_REFUNDED' && step.key === 'RESOLVED' ? 'Refunded' : status === 'RESOLVED_CREDITED' && step.key === 'RESOLVED' ? 'Credits issued' : step.label}
              </span>
            </div>
            {i < track.length - 1 && <span className={`lifecycle-line ${isDone ? 'is-done' : ''}`} />}
          </div>
        );
      })}
    </div>
  );
}
