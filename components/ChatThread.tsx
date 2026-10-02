'use client';
import { useEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import { Button } from './ui/Button';
import { cn } from '@/lib/utils';

interface ChatMessage {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
}

/**
 * Lightweight, Instagram-DM-style chat between a buyer and seller for a
 * specific listing. Backed by the `messages` table + /api/messages route;
 * RLS ensures only the two participants can ever read a thread. Contact
 * numbers are intentionally never auto-shared here — see spec §18.
 */
export function ChatThread({ listingId, currentUserId, otherUserId, otherUserLabel }: {
  listingId: string;
  currentUserId: string;
  otherUserId: string;
  otherUserLabel: string;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [blockedNotice, setBlockedNotice] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function load() {
    const res = await fetch(`/api/messages?listingId=${listingId}&withUserId=${otherUserId}`);
    if (res.ok) setMessages((await res.json()).messages ?? []);
  }

  useEffect(() => { load(); const interval = setInterval(load, 4000); return () => clearInterval(interval); }, [listingId, otherUserId]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length]);

  async function send() {
    const body = draft.trim();
    if (!body) return;
    setSending(true);
    setBlockedNotice(null);
    const res = await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listingId, recipientId: otherUserId, body })
    });
    if (res.ok) {
      setDraft('');
      await load();
    } else {
      const data = await res.json().catch(() => null);
      setBlockedNotice(data?.error ?? "This message couldn't be sent.");
    }
    setSending(false);
  }

  return (
    <div className="flex h-[420px] flex-col rounded-xl2 border border-slate-100 bg-white shadow-soft">
      <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-navy-900">{otherUserLabel}</div>
      <div className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
        {messages.length === 0 && <p className="mt-6 text-center text-sm text-slate-400">Say hello — ask about the seat, timing, or anything else before you buy.</p>}
        {messages.map(m => (
          <div key={m.id} className={cn('flex', m.sender_id === currentUserId ? 'justify-end' : 'justify-start')}>
            <div className={cn(
              'max-w-[75%] rounded-2xl px-3.5 py-2 text-sm',
              m.sender_id === currentUserId ? 'bg-brand-gradient text-white' : 'bg-slate-100 text-navy-900'
            )}>
              {m.body}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="flex items-center gap-2 border-t border-slate-100 p-3">
        <div className="flex-1">
          {blockedNotice && <p className="mb-1.5 text-xs text-rose-600">{blockedNotice}</p>}
          <input
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') send(); }}
            placeholder="Ask about the ticket…"
            className="min-h-[40px] w-full rounded-full border border-slate-200 px-4 text-sm outline-none focus:border-brand-blue"
          />
        </div>
        <Button size="sm" onClick={send} disabled={sending || !draft.trim()} aria-label="Send">
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
