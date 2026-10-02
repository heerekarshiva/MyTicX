// Listing pages are public (SEO). Indexing is decided per listing in app/listing/[id]/layout.tsx:
// available tickets are indexable, sold/expired ones are not.
export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
