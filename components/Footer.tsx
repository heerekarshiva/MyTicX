import Link from 'next/link';
import { Logo } from './Logo';

export function Footer() {
  return (
    <footer className="border-t border-slate-100 bg-white" role="contentinfo">
      <div className="container-page grid gap-8 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Logo />
          <p className="mt-3 max-w-xs text-sm text-slate-500">
            Tickets In Connected eXchange. Buy. Sell. Experience.
          </p>
        </div>
        <FooterCol title="Marketplace" links={[['Browse tickets', '/marketplace'], ['Sell a ticket', '/sell'], ['Events', '/events'], ['Movie picks', '/suggestions']]} />
        <FooterCol title="Learn" links={[['How it works', '/how-it-works'], ['FAQ', '/faq'], ['Organize an event', '/organize-event']]} />
        <FooterCol title="Company" links={[['About', '/about'], ['Contact', '/contact'], ['Terms of Service', '/terms'], ['Privacy Policy', '/privacy']]} />
      </div>
      <div className="border-t border-slate-100 py-6 text-center text-xs text-slate-400">
        © {new Date().getFullYear()} MyTICX. All rights reserved.
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-navy-900">{title}</h2>
      <ul className="mt-3 space-y-2">
        {links.map(([label, href]) => (
          <li key={href}><Link href={href} className="text-sm text-slate-500 hover:text-brand-blue">{label}</Link></li>
        ))}
      </ul>
    </div>
  );
}
