import 'server-only';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAdminCtx, sameOrigin, fail, json } from './server';

/** Tiny generic admin CRUD factory: list / create / update / delete(safe). */
export function adminCrud(opts: {
  table: string; order?: string; schema: z.ZodTypeAny; usedBy?: { table: string; column: string }[];
}) {
  const GET = async () => {
    const g = await requireAdminCtx(); if ('res' in g) return g.res;
    const { data, error } = await g.ctx.admin.from(opts.table).select('*').order(opts.order ?? 'created_at');
    return error ? fail('Could not load. Has migration 0008 been run?', 500) : json({ items: data ?? [] });
  };
  const POST = async (req: NextRequest) => {
    if (!sameOrigin(req)) return fail('Bad origin.', 403);
    const g = await requireAdminCtx(); if ('res' in g) return g.res;
    const p = opts.schema.safeParse(await req.json().catch(() => null));
    if (!p.success) return fail(p.error.issues[0]?.message ?? 'Invalid input');
    const { data, error } = await g.ctx.admin.from(opts.table).insert(p.data).select().single();
    if (error) return fail(error.code === '23505' ? 'That key/name already exists.' : 'Could not save.', error.code === '23505' ? 409 : 500);
    return json({ item: data });
  };
  const PATCH = async (req: NextRequest) => {
    if (!sameOrigin(req)) return fail('Bad origin.', 403);
    const g = await requireAdminCtx(); if ('res' in g) return g.res;
    const body = await req.json().catch(() => null);
    const id = z.string().uuid().safeParse(body?.id);
    if (!id.success) return fail('Missing id.');
    const p = (opts.schema as z.ZodObject<any>).partial().safeParse(body.values ?? {});
    if (!p.success) return fail(p.error.issues[0]?.message ?? 'Invalid input');
    const { data, error } = await g.ctx.admin.from(opts.table).update(p.data).eq('id', id.data).select().single();
    return error ? fail('Could not update.', 500) : json({ item: data });
  };
  const DELETE = async (req: NextRequest) => {
    if (!sameOrigin(req)) return fail('Bad origin.', 403);
    const g = await requireAdminCtx(); if ('res' in g) return g.res;
    const id = z.string().uuid().safeParse(new URL(req.url).searchParams.get('id'));
    if (!id.success) return fail('Missing id.');
    for (const u of opts.usedBy ?? []) {
      const { count } = await g.ctx.admin.from(u.table).select('id', { count: 'exact', head: true }).eq(u.column, id.data);
      if (count) return fail(`In use by ${count} ${u.table.replace('_', ' ')} record(s). Disable it instead of deleting.`, 409);
    }
    const { error } = await g.ctx.admin.from(opts.table).delete().eq('id', id.data);
    return error ? fail('Could not delete.', 500) : json({ ok: true });
  };
  return { GET, POST, PATCH, DELETE };
}
