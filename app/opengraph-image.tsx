import { ImageResponse } from 'next/og';

export const alt = 'MyTICX – Buy, sell and experience: verified movie tickets and events';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// Default social-share card used by every page that doesn't set its own image.
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 80, background: 'linear-gradient(135deg, #071B36 0%, #0E2647 60%, #FF7A00 160%)', color: '#fff' }}>
        <div style={{ display: 'flex', fontSize: 150, fontWeight: 900, letterSpacing: -4 }}>
          My<span style={{ color: "#fff" }}>TIC</span><span style={{ color: "#FF7A00" }}>X</span>
        </div>
        <div style={{ fontSize: 44, fontWeight: 700, marginTop: 8 }}>Tickets In Connected eXchange</div>
        <div style={{ fontSize: 34, marginTop: 36, color: 'rgba(255,255,255,0.85)' }}>Buy verified movie tickets · Sell the ones you can’t use · Join events</div>
      </div>
    ),
    size
  );
}
