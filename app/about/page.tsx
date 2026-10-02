import { StaticPage } from '@/components/StaticPage';
import { pageMeta } from '@/lib/seo';

export const metadata = pageMeta({
  title: 'About MyTICX – Tickets In Connected eXchange',
  description: 'MyTICX helps people resell unused movie tickets safely and helps organizers run event registrations with QR entry passes.',
  path: '/about'
});

export default function AboutPage() {
  return (
    <StaticPage title="About MyTICX" path="/about" intro="MyTICX stands for Tickets In Connected eXchange: a trusted place to buy, sell and experience.">
      <p>Plans change, and a ticket you cannot use should not go to waste. MyTICX lets sellers recover part of the cost and lets buyers watch a film for less, with checks that make sure the ticket is real and can only be sold once.</p>
      <p>The same platform also powers event registration for colleges and communities: organizers publish an event, collect registrations and payments, and check people in with a QR pass.</p>
      <h2>What we care about</h2>
      <ul>
        <li><strong>Trust:</strong> verification before listing, atomic purchases, and an acceptance record for buyers and sellers.</li>
        <li><strong>Fair prices:</strong> a minimum discount for every resale and a small flat fee shown up front.</li>
        <li><strong>Privacy:</strong> chat that blocks personal contact details, and QR passes that carry no personal data.</li>
      </ul>
    </StaticPage>
  );
}
