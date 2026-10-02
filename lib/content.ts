// Shared marketing copy so the landing page, /faq and the FAQPage JSON-LD never drift apart.
// Every statement here mirrors real app behaviour (pricing rules, UPI flow, event cutoff).
export const FAQ: { q: string; a: string }[] = [
  {
    q: 'What is MyTICX?',
    a: 'MyTICX (Tickets In Connected eXchange) is a marketplace where people resell movie tickets they cannot use, and where organizers run event registrations with QR entry passes.'
  },
  {
    q: 'How does MyTICX check that a movie ticket is genuine?',
    a: 'Every uploaded ticket goes through a verification pipeline before it goes live. MyTICX fingerprints the booking reference and seat and hashes the uploaded file, so the same ticket cannot be listed twice. Sellers also verify their account with a one-time code.'
  },
  {
    q: 'Can the same ticket be sold to two people?',
    a: 'No. Purchases are handled atomically in the database: if two buyers click Buy at the same moment, only one order succeeds and the other is told the ticket is no longer available.'
  },
  {
    q: 'How much cheaper are resale tickets, and what are the fees?',
    a: 'Sellers must price a ticket at least ₹50 below its original price. MyTICX adds a flat platform fee of ₹10–15, shown to the buyer as a separate line before paying.'
  },
  {
    q: 'How do I pay for a ticket?',
    a: 'Payment is a direct UPI payment to the seller. After paying you enter the UTR (reference number) from your UPI app, and the seller confirms receipt before the order completes. MyTICX is not a payment gateway and cannot detect a UPI payment automatically, so only confirm payments you can see in your own bank or UPI app.'
  },
  {
    q: 'Can I chat with the seller?',
    a: 'Yes. Each listing has an in-app chat between buyer and seller. Phone numbers, emails and links are blocked in messages to keep conversations safe.'
  },
  {
    q: 'How do events work on MyTICX?',
    a: 'Organizers create a free or paid event with their own registration form. Participants register, pay by UPI for paid events, and receive a QR entry pass once registration is confirmed. Registration closes 30 minutes before the event starts, and organizers scan passes at the entrance.'
  },
  {
    q: 'Who is responsible for a resale transaction?',
    a: 'MyTICX facilitates the listing, verification and chat, but the sale is between the buyer and the seller. Buyers and sellers accept the marketplace terms before listing or purchasing.'
  }
];

export const STEPS = [
  { title: 'Sell', text: 'Search the movie, upload your ticket, set a price at least ₹50 below the original and go live after verification.' },
  { title: 'Chat', text: 'Buyers message you about the ticket only. Phone numbers, emails and links are blocked.' },
  { title: 'Review', text: 'After the sale the buyer leaves a review and the chat is cleared automatically.' }
];
