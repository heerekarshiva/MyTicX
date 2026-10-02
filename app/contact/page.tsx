import { StaticPage } from '@/components/StaticPage';
import { pageMeta } from '@/lib/seo';
import { SITE } from '@/lib/site';

export const metadata = pageMeta({
  title: 'Contact MyTICX Support',
  description: 'Get help with a ticket, an order or an event registration on MyTICX.',
  path: '/contact'
});

export default function ContactPage() {
  return (
    <StaticPage title="Contact us" path="/contact" intro="Questions about a ticket, an order or an event? We’re here to help.">
      {SITE.supportEmail
        ? <p>Email us at <a href={`mailto:${SITE.supportEmail}`}>{SITE.supportEmail}</a>. Please include your order or registration ID so we can find it quickly.</p>
        : <p>Support contact details will be published here soon. For an order issue, use the in-app chat on your order page.</p>}
      <h2>Before you write</h2>
      <ul>
        <li>For a payment that has not been confirmed, contact the seller or organizer first through the in-app chat.</li>
        <li>Never share OTP codes or UPI PINs with anyone, including people claiming to be MyTICX.</li>
      </ul>
    </StaticPage>
  );
}
