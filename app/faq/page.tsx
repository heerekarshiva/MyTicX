import { StaticPage } from '@/components/StaticPage';
import { FAQ } from '@/lib/content';
import { pageMeta } from '@/lib/seo';

export const metadata = pageMeta({
  title: 'FAQ – Buying, Selling Tickets & Events on MyTICX',
  description: 'Answers about verified resale movie tickets, fees, UPI payments, chat safety and how event registration works on MyTICX.',
  path: '/faq'
});

export default function FaqPage() {
  const schema = [{ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: FAQ.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) }];
  return (
    <StaticPage title="Frequently asked questions" path="/faq" intro="Everything you need to know about buying and selling tickets and running events on MyTICX." schema={schema}>
      <div className="divide-y divide-ticx-border rounded-2xl border border-ticx-border bg-white">
        {FAQ.map(f => (
          <details key={f.q} className="group p-5">
            <summary className="cursor-pointer list-none font-semibold text-navy-900 marker:hidden">{f.q}</summary>
            <p className="mt-2 text-slate-600">{f.a}</p>
          </details>
        ))}
      </div>
    </StaticPage>
  );
}
