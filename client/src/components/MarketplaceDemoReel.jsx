import { useEffect, useState } from 'react';
import { ArrowRightIcon, CheckIcon } from './icons.jsx';

const DEMOS = [
  {
    label: 'SEARCH & SHOP',
    title: 'Find the right tool faster',
    body: 'Search by a goal and compare products, experts, and short courses in one view.',
    videoSrc: '',
    image: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=900&q=85',
    steps: ['Search “launch a podcast”', 'Compare a microphone and expert', 'Save or add the product to cart'],
  },
  {
    label: 'LEARN IN SMALL STEPS',
    title: 'Open a course and start learning',
    body: 'Preview a practical module, see the curriculum, and unlock short lessons after purchase.',
    videoSrc: '',
    image: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=900&q=85',
    steps: ['Preview the first lesson', 'Check the creator and curriculum', 'Learn at your own pace'],
  },
  {
    label: 'BOOK WITH CONTEXT',
    title: 'Meet the right service provider',
    body: 'Review the brief, agree the scope in chat, and keep the booking details with the order.',
    videoSrc: '',
    image: 'https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=900&q=85',
    steps: ['Choose a verified provider', 'Agree the brief and time', 'Track the booking to completion'],
  },
];

export default function MarketplaceDemoReel() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setActive((current) => (current + 1) % DEMOS.length), 6500);
    return () => window.clearInterval(timer);
  }, []);

  const demo = DEMOS[active];
  return (
    <section className="border-y border-line bg-forest-950 text-white" aria-labelledby="demo-reel-title">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
        <div>
          <p className="eyebrow !text-ochre">SEE ESCRIT IN MOTION</p>
          <h2 id="demo-reel-title" className="mt-2 font-display text-3xl sm:text-4xl">A marketplace built around how people actually decide.</h2>
          <p className="mt-4 max-w-lg text-sm leading-6 text-white/65">Short walkthroughs of the real journeys Escrit brings together: finding something useful, learning a skill, and booking someone who can help.</p>
          <div className="mt-7 flex flex-wrap gap-2" role="tablist" aria-label="Escrit usage demos">
            {DEMOS.map((entry, index) => <button key={entry.label} type="button" role="tab" aria-selected={active === index} onClick={() => setActive(index)} className={`rounded-full border px-3 py-2 text-xs font-medium transition-colors ${active === index ? 'border-ochre bg-ochre text-forest-950' : 'border-white/20 text-white/70 hover:border-white/50'}`}>{entry.label}</button>)}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_15rem]">
          <div className="relative aspect-video overflow-hidden rounded-xl border border-white/15 bg-black shadow-card-lg">
            {demo.videoSrc ? <video src={demo.videoSrc} autoPlay muted loop playsInline controls={false} className="absolute inset-0 h-full w-full object-cover opacity-65" /> : <img src={demo.image} alt="" className="absolute inset-0 h-full w-full object-cover opacity-65" />}
            <div className="absolute inset-0 bg-gradient-to-t from-forest-950 via-forest-950/35 to-transparent" />
            <div className="relative flex h-full flex-col justify-between p-5 sm:p-7"><div className="flex items-center justify-between text-[10px] font-semibold tracking-[0.18em] text-white/70"><span>{demo.label}</span><span className="rounded-full bg-white/15 px-2 py-1 tracking-normal">ESCRIT DEMO</span></div><div><h3 className="max-w-md font-display text-2xl sm:text-3xl">{demo.title}</h3><p className="mt-2 max-w-md text-sm leading-5 text-white/70">{demo.body}</p><div className="mt-5 h-1 overflow-hidden rounded-full bg-white/20"><span className="block h-full w-1/2 rounded-full bg-ochre transition-all duration-700" style={{ width: `${((active + 1) / DEMOS.length) * 100}%` }} /></div></div></div>
          </div>
          <div className="rounded-xl border border-white/15 bg-white/10 p-4"><p className="text-xs font-semibold uppercase tracking-wider text-ochre">Journey</p><ol className="mt-4 space-y-4">{demo.steps.map((step) => <li key={step} className="flex gap-2 text-sm leading-5 text-white/75"><CheckIcon width={15} height={15} className="mt-0.5 shrink-0 text-ochre" />{step}</li>)}</ol><button type="button" onClick={() => setActive((active + 1) % DEMOS.length)} className="mt-6 inline-flex items-center gap-1 text-xs font-semibold text-white underline underline-offset-4">Next demo <ArrowRightIcon width={14} height={14} /></button></div>
        </div>
      </div>
    </section>
  );
}