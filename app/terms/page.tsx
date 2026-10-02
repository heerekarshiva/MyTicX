import { StaticPage } from '@/components/StaticPage';
import { pageMeta } from '@/lib/seo';

export const metadata = pageMeta({
  title: 'Terms of Service',
  description: 'The terms that apply when you buy or sell tickets, or organize and join events, on MyTICX.',
  path: '/terms'
});

export default function TermsPage() {
  return (
    <StaticPage title="Terms of Service" path="/terms" intro="Last updated: October 2026. Please read these terms before using MyTICX.">
      <h2>1. The service</h2>
      <p>MyTICX provides a platform for listing, verifying and discovering resale tickets and for organizing event registrations. MyTICX facilitates these activities but is not a party to a sale between a buyer and a seller, and does not itself sell tickets.</p>
      <h2>2. Sellers</h2>
      <ul>
        <li>You must own the ticket you list and must not use or resell it after it is sold.</li>
        <li>You must price the ticket at least ₹50 below its original price and provide accurate details.</li>
        <li>Listing a ticket that is fake, already used or already listed is prohibited and may lead to removal and account suspension.</li>
      </ul>
      <h2>3. Buyers</h2>
      <ul>
        <li>You are buying a resold ticket and accept the risks of a resale. MyTICX verifies listings but cannot guarantee entry to a venue.</li>
        <li>A platform fee is shown before you pay. Payment is made directly to the seller by UPI and must be confirmed by the seller.</li>
      </ul>
      <h2>4. Events</h2>
      <p>Organizers are responsible for their events, the accuracy of event details, and for confirming payments for paid events. Registration closes before the event starts as shown on each event page.</p>
      <h2>5. Acceptable use</h2>
      <p>Do not attempt to bypass chat safeguards, harass other users, scrape the service, or interfere with its security. We may suspend accounts that break these rules.</p>
      <h2>6. Liability</h2>
      <p>To the extent permitted by law, MyTICX is not liable for losses arising from a transaction between users, for venue or event cancellations, or for payments made outside the platform.</p>
      <h2>7. Changes and contact</h2>
      <p>We may update these terms; continued use means you accept the updated terms. See the <a href="/contact">contact page</a> for how to reach us.</p>
    </StaticPage>
  );
}
