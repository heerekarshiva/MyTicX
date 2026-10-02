import { StaticPage } from '@/components/StaticPage';
import { pageMeta } from '@/lib/seo';

export const metadata = pageMeta({
  title: 'Privacy Policy',
  description: 'What personal data MyTICX collects, why we collect it, and the choices you have.',
  path: '/privacy'
});

export default function PrivacyPage() {
  return (
    <StaticPage title="Privacy Policy" path="/privacy" intro="Last updated: October 2026. This policy explains how MyTICX handles your information.">
      <h2>Information we collect</h2>
      <ul>
        <li><strong>Account data:</strong> name, email address and sign-in details.</li>
        <li><strong>Listing data:</strong> ticket details and the uploaded ticket file, stored privately and used only for verification and dispute handling.</li>
        <li><strong>Transaction data:</strong> orders, UPI reference numbers you submit, chat messages and reviews.</li>
        <li><strong>Event data:</strong> your answers to an organizer’s registration form, visible to you and to that event’s organizer only.</li>
      </ul>
      <h2>How we use it</h2>
      <p>To run the marketplace and events, verify tickets, prevent fraud and duplicate listings, record your acceptance of terms, send service notifications and keep the platform secure.</p>
      <h2>What we do not do</h2>
      <p>We do not sell your personal data. Public pages never show participant data, organizer emails or payment details. QR entry passes contain a random token, not personal information.</p>
      <h2>Sharing</h2>
      <p>We share data with infrastructure providers that host the service (such as our database and hosting providers) and when required by law. A buyer and seller see only what is needed to complete a sale.</p>
      <h2>Retention and your choices</h2>
      <p>Chat for a sold ticket is cleared after the sale. You can ask us to access, correct or delete your data through the <a href="/contact">contact page</a>, subject to records we must keep for fraud prevention and legal reasons.</p>
    </StaticPage>
  );
}
