export type TicketStatus =
  | 'UPLOADED' | 'VERIFYING' | 'VERIFIED' | 'LISTED' | 'RESERVED'
  | 'SOLD' | 'TRANSFERRED' | 'REJECTED' | 'EXPIRED' | 'CANCELLED' | 'BLOCKED';

export type VerificationStatus = 'UNVERIFIED' | 'PENDING' | 'DOCUMENT_VERIFIED' | 'PROVIDER_VERIFIED' | 'REJECTED';

export type ListingStatus = 'PENDING_VERIFICATION' | 'ACTIVE' | 'RESERVED' | 'SOLD' | 'EXPIRED' | 'REJECTED' | 'CANCELLED';

export interface VerificationStepResult {
  step: string;
  label: string;
  passed: boolean;
  detail?: string;
}

export interface VerificationPipelineResult {
  overallStatus: VerificationStatus;
  ticketStatus: TicketStatus;
  steps: VerificationStepResult[];
  rejectionReason?: string;
}

export interface MarketplaceListing {
  id: string;
  movieTitle: string;
  theatreName: string;
  location: string;
  showDate: string;
  showTime: string;
  seatLabel: string | null;
  originalPrice: number;
  resalePrice: number;
  platformFee: number;
  discountPct: number;
  verificationStatus: VerificationStatus;
  sellerVerified: boolean;
  status: ListingStatus;
}
