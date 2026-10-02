export const LANGUAGES = [
  'Hindi', 'English', 'Telugu', 'Tamil', 'Kannada', 'Malayalam',
  'Marathi', 'Bengali', 'Punjabi', 'Gujarati', 'Other'
] as const;
export type Language = (typeof LANGUAGES)[number];
