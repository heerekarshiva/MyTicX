import 'server-only';
/** Manual seller-confirmed UPI is only a dev/fallback flow. With a real gateway it must be unreachable. */
export const manualPaymentsEnabled = () => process.env.PAYMENT_PROVIDER !== 'phonepe';
