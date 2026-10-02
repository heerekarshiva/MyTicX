import Link from 'next/link';
import { ShieldCheck, BadgeCheck, MessageCircle, Clock, Play, Film, Ticket } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { JsonLd } from '@/components/JsonLd';
import { FAQ, STEPS } from '@/lib/content';
import { pageMeta } from '@/lib/seo';
import { abs } from '@/lib/site';

export const metadata = pageMeta({
  title: 'MyTICX – Buy & Sell Verified Movie Tickets, Join & Organize Events',
  description: 'Buy discounted, verified movie tickets or sell the ones you cannot use. Register for college and community events with an instant QR pass. Safe, secure and fair priced.',
  path: '/'
});

const trust = [
  { icon: ShieldCheck, title: '100% Safe & Secure', text: 'Every ticket is checked before it goes live.' },
  { icon: BadgeCheck, title: 'Verified Sellers', text: 'Sellers confirm their account before listing.' },
  { icon: MessageCircle, title: 'Instant Messaging', text: 'Ask about the ticket, right inside MyTICX.' },
  { icon: Clock, title: 'Real-Time Updates', text: 'Sold tickets disappear the moment they sell.' }
];

export default function LandingPage() {
  return (
    <div>
      <Navbar />

      <section className="relative overflow-hidden bg-navy-900 text-white">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_80%_40%,rgba(255,122,0,0.28),transparent_55%)]" />
        <div className="container-page relative grid gap-10 py-16 md:grid-cols-2 md:items-center md:py-24">
          <div>
            <p className="text-5xl font-black tracking-tight sm:text-6xl" aria-hidden="true"><span className="mr-1 text-4xl font-bold text-white/90 sm:text-5xl">My</span>TIC<span className="text-brand-blue">X</span></p>
            <h1 className="mt-3 text-2xl font-bold sm:text-3xl">Buy &amp; sell verified movie tickets. Join and organize events.</h1>
            <p className="mt-6 text-xl font-semibold">Tickets In Connected eXchange — Buy. Sell. Experience.</p>
            <p className="mt-4 max-w-md text-white/80">
              Find the best deals on movie, event and show tickets. Sell your extra tickets. Be part of a trusted community.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/marketplace" className="rounded-full bg-brand-blue px-7 py-3 font-semibold hover:bg-brand-bluedark">Explore Tickets</Link>
              <Link href="/sell" className="rounded-full border border-white/30 px-6 py-3 font-semibold hover:bg-white/10">Sell a Ticket</Link>
              <a href="#how-it-works" className="inline-flex items-center gap-2 rounded-full border border-white/30 px-6 py-3 font-semibold hover:bg-white/10">
                <Play className="h-4 w-4 fill-white" /> How It Works
              </a>
            </div>
          </div>

          <div className="relative mx-auto flex h-72 w-full max-w-md items-center justify-center" aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/posters/oppenheimer.png" alt="" width={312} height={312} className="absolute left-0 top-10 aspect-square w-40 -rotate-6 rounded-xl border border-white/20 object-cover shadow-2xl" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/posters/interstellar.png" alt="" width={312} height={312} className="absolute left-1/2 top-0 z-10 aspect-square w-44 -translate-x-1/2 rotate-2 rounded-xl border border-white/20 object-cover shadow-2xl" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/posters/spiderverse.png" alt="" width={258} height={312} className="absolute right-0 top-8 aspect-[258/312] w-36 rotate-6 rounded-xl border border-white/20 object-cover shadow-2xl" />
            <div className="absolute bottom-2 left-1/2 z-20 flex -translate-x-1/2 rotate-[-8deg] items-center gap-2 rounded-lg bg-gradient-to-r from-amber-400 to-brand-blue px-6 py-3 text-xl font-black tracking-widest text-navy-900 shadow-xl">
              <Ticket className="h-6 w-6" /> TICKET
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-ticx-border bg-white">
        <div className="container-page grid grid-cols-2 gap-6 py-8 md:grid-cols-4">
          {trust.map(t => (
            <div key={t.title} className="flex items-start gap-3">
              <t.icon className="mt-0.5 h-7 w-7 shrink-0 text-navy-900" />
              <div><p className="text-sm font-semibold text-navy-900">{t.title}</p><p className="mt-0.5 text-xs text-ticx-textmuted">{t.text}</p></div>
            </div>
          ))}
        </div>
      </section>

      <section id="how-it-works" className="bg-ticx-bg py-16">
        <div className="container-page">
          <h2 className="text-2xl font-bold text-navy-900">How MyTICX works</h2>
          <p className="mt-2 max-w-2xl text-slate-600">Resell a movie ticket you cannot use in minutes, or find a verified one at a fair price. Organizers can also run event registrations end to end.</p>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {STEPS.map(({ title: t, text: d }) => (
              <div key={t} className="rounded-2xl border border-ticx-border bg-white p-6">
                <Film className="h-6 w-6 text-brand-blue" />
                <h3 className="mt-3 font-semibold text-navy-900">{t}</h3>
                <p className="mt-1 text-sm text-ticx-textmuted">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section id="events" className="py-16">
        <div className="container-page grid gap-8 md:grid-cols-2 md:items-center">
          <div>
            <h2 className="text-2xl font-bold text-navy-900">Run or join an event</h2>
            <p className="mt-3 text-slate-600">Colleges and communities publish events on MyTICX, collect free or paid registrations with a custom form, and check people in at the door with a one-time QR pass.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/events" className="rounded-full bg-navy-900 px-6 py-3 text-sm font-semibold text-white hover:bg-navy-800">Browse events</Link>
              <Link href="/organize-event" className="rounded-full border border-ticx-border px-6 py-3 text-sm font-semibold text-navy-900 hover:bg-ticx-bg">Organize your event</Link>
            </div>
          </div>
          <ul className="grid gap-3 text-sm text-slate-700">
            <li className="rounded-xl border border-ticx-border p-4"><strong className="text-navy-900">Registration closes 30 minutes before start</strong> so organizers can plan the entrance.</li>
            <li className="rounded-xl border border-ticx-border p-4"><strong className="text-navy-900">Each QR pass works once</strong> and carries no personal data.</li>
          </ul>
        </div>
      </section>

      <section id="faq" className="bg-ticx-bg py-16">
        <div className="container-page max-w-3xl">
          <h2 className="text-2xl font-bold text-navy-900">Frequently asked questions</h2>
          <div className="mt-6 divide-y divide-ticx-border rounded-2xl border border-ticx-border bg-white">
            {FAQ.slice(0, 5).map(f => (
              <details key={f.q} className="p-5">
                <summary className="cursor-pointer font-semibold text-navy-900">{f.q}</summary>
                <p className="mt-2 text-sm text-slate-600">{f.a}</p>
              </details>
            ))}
          </div>
          <p className="mt-4 text-sm"><Link href="/faq" className="font-medium text-brand-bluedark underline">See all questions</Link></p>
        </div>
      </section>
      <JsonLd data={{ '@context': 'https://schema.org', '@type': 'FAQPage', '@id': abs('/#faq'), mainEntity: FAQ.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) }} />
      <Footer />
    </div>
  );
}
