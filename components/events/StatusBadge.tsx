import { Badge } from '@/components/ui/Badge';
import { STATUS_LABEL } from '@/lib/events/lifecycle';

const tone: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  REGISTRATION_OPEN: 'success', PUBLISHED: 'info', REGISTRATION_CLOSED: 'warning', ONGOING: 'info', COMPLETED: 'neutral', CANCELLED: 'danger', SUSPENDED: 'danger', DRAFT: 'neutral'
};
export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={tone[status] ?? 'neutral'}>{STATUS_LABEL[status] ?? status}</Badge>;
}
export function PaymentBadge({ status }: { status: string }) {
  const t = status === 'PAID' || status === 'FREE' ? 'success' : status === 'PAYMENT_FAILED' || status === 'CANCELLED' ? 'danger' : status === 'PAYMENT_PROCESSING' ? 'warning' : 'neutral';
  return <Badge tone={t}>{status.replace('_', ' ')}</Badge>;
}
