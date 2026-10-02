import { z } from 'zod';
import { adminCrud } from '@/lib/events/admin-crud';

export const { GET, POST, PATCH, DELETE } = adminCrud({
  table: 'event_types', order: 'sort_order',
  usedBy: [{ table: 'events', column: 'event_type_id' }],
  schema: z.object({
    key: z.string().trim().regex(/^[a-z0-9_]{2,40}$/, 'Key: lowercase letters, numbers, underscores'),
    name: z.string().trim().min(2).max(60), description: z.string().trim().max(300).nullish(),
    icon: z.string().trim().max(30).default('calendar'), collect_college_name: z.boolean().default(false),
    allow_paid: z.boolean().default(true), allow_custom_fields: z.boolean().default(true),
    allow_field_editing: z.boolean().default(true), is_active: z.boolean().default(true), sort_order: z.coerce.number().int().default(0)
  })
});
