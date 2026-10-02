import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: { 900: '#071B36', 800: '#0E2647', 700: '#16345C' },
        // "brand-blue" is the historical name for this app's single accent
        // color (focus rings, links, active-tab text, CTA gradient) — kept
        // as-is here so every existing className in the app still resolves,
        // but its VALUE is now TICX orange (#FF7A00), per the brand palette:
        // navy = trust/professionalism (primary), orange = energy/action.
        brand: {
          blue: '#FF7A00',
          bluedark: '#E56A00',
          purple: '#FF7A00',
          purpledark: '#E56A00'
        },
        ticx: {
          bg: '#F7F9FC',
          text: '#101828',
          textmuted: '#667085',
          border: '#E4E7EC',
          success: '#12B76A'
        }
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #071B36 0%, #FF7A00 100%)',
        'brand-gradient-soft': 'linear-gradient(135deg, rgba(7,27,54,0.06) 0%, rgba(255,122,0,0.10) 100%)'
      },
      borderRadius: { xl2: '1.25rem' },
      boxShadow: { soft: '0 8px 30px rgba(20, 30, 70, 0.08)' }
    }
  },
  plugins: []
};
export default config;
