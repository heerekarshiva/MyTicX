import Link from 'next/link';
import { StaticPage } from '@/components/StaticPage';
import { pageMeta } from '@/lib/seo';

export const metadata = pageMeta({
  title: 'How MyTICX Works – Sell, Buy and Organize',
  description: 'See how to sell an unused movie ticket, buy a verified resale ticket safely, and run an event with QR entry passes on MyTICX.',
  path: '/how-it-works'
});

export default function HowItWorksPage() {
  return (
    <StaticPage title="How MyTICX works" path="/how-it-works" intro="Three simple flows: sell a ticket you cannot use, buy one at a fair price, or run an event.">
      <h2>Selling a movie ticket</h2>
      <ul>
        <li>Search the movie, choose the show, and upload your ticket.</li>
        <li>MyTICX verifies the booking and checks the file has not been listed before.</li>
        <li>Set a price at least ₹50 below the original. Verify your account with a one-time code and publish.</li>
        <li>Buyers message you in-app. After they pay by UPI you confirm receipt and the sale completes.</li>
      </ul>
      <h2>Buying a resale ticket</h2>
      <ul>
        <li>Browse the <Link href="/marketplace">marketplace</Link> by movie, theatre, city or language.</li>
        <li>See the full price including the ₹10–15 platform fee before you commit.</li>
        <li>Pay the seller by UPI, submit the UTR reference, and receive the ticket once the seller confirms.</li>
      </ul>
      <h2>Organizing an event</h2>
      <ul>
        <li>Create a free or paid event with a custom registration form.</li>
        <li>Participants register on the <Link href="/events">events page</Link> and receive a QR entry pass once confirmed.</li>
        <li>Registration closes 30 minutes before the start. Scan passes at the gate; each pass works once.</li>
      </ul>
      <h2>Safety built in</h2>
      <p>Duplicate tickets are blocked at the database level, only one buyer can win a listing, and chat blocks phone numbers, emails and links. Read the <Link href="/faq">FAQ</Link> for more.</p>
    </StaticPage>
  );
}
