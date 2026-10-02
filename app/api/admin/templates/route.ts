import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAdminCtx, sameOrigin, fail, json } from '@/lib/events/server';

const schema = z.object({
  id: z.string().uuid().optional(), event_type_id: z.string().uuid(), name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(300).nullish(), is_default: z.boolean().default(false),
  allow_customization: z.boolean().default(true), is_active: z.boolean().default(true),
  fields: z.array(z.object({ field_definition_id: z.string().uuid(), is_required: z.boolean() })).max(60)
});

export async function GET() {
  const g = await requireAdminCtx(); if ('res' in g) return g.res;
  const [t, f] = await Promise.all([
    g.ctx.admin.from('event_templates').select('*').order('created_at'),
    g.ctx.admin.from('event_template_fields').select('*').order('sort_order')
  ]);
  return json({ items: (t.data ?? []).map(x => ({ ...x, fields: (f.data ?? []).filter(y => y.template_id === x.id) })) });
}

// Create or update (when id is present). Fields are replaced wholesale, order = array order.
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return fail('Bad origin.', 403);
  const g = await requireAdminCtx(); if ('res' in g) return g.res;
  const p = schema.safeParse(await req.json().catch(() => null));
  if (!p.success) return fail(p.error.issues[0]?.message ?? 'Invalid input');
  const { id, fields, ...row } = p.data;
  const a = g.ctx.admin;
  if (row.is_default) await a.from('event_templates').update({ is_default: false }).eq('event_type_id', row.event_type_id);
  const res = id ? await a.from('event_templates').update(row).eq('id', id).select().single() : await a.from('event_templates').insert(row).select().single();
  if (res.error || !res.data) return fail('Could not save the template.', 500);
  await a.from('event_template_fields').delete().eq('template_id', res.data.id);
  if (fields.length) await a.from('event_template_fields').insert(fields.map((f, i) => ({ ...f, template_id: res.data.id, sort_order: i })));
  return json({ item: res.data });
}

export async function DELETE(req: NextRequest) {
  if (!sameOrigin(req)) return fail('Bad origin.', 403);
  const g = await requireAdminCtx(); if ('res' in g) return g.res;
  const id = z.string().uuid().safeParse(new URL(req.url).searchParams.get('id'));
  if (!id.success) return fail('Missing id.');
  await g.ctx.admin.from('events').update({ template_id: null }).eq('template_id', id.data);
  const { error } = await g.ctx.admin.from('event_templates').delete().eq('id', id.data);
  return error ? fail('Could not delete.', 500) : json({ ok: true });
}
