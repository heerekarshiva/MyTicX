export function PriceBreakdown({ ticketPrice, platformFee }: { ticketPrice: number; platformFee: number }) {
  const total = ticketPrice + platformFee;
  return (
    <div className="space-y-2 rounded-xl bg-slate-50 p-4 text-sm">
      <Row label="Ticket price" value={ticketPrice} />
      <Row label="MyTICX fee" value={platformFee} />
      <div className="my-1 border-t border-slate-200" />
      <Row label="Total" value={total} bold />
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? 'font-semibold text-navy-900' : 'text-slate-600'}`}>
      <span>{label}</span>
      <span>₹{value.toFixed(2)}</span>
    </div>
  );
}
