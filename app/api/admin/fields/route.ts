import { z } from 'zod';
import { adminCrud } from '@/lib/events/admin-crud';
import { FIELD_TYPES } from '@/lib/events/fields';

export const { GET, POST, PATCH, DELETE } = adminCrud({
  table: 'field_definitions', order: 'sort_order',
  usedBy: [{ table: 'event_fields', column: 'definition_id' }, { table: 'event_template_fields', column: 'field_definition_id' }],
  schema: z.object({
    key: z.string().trim().regex(/^[a-z][a-z0-9_]{1,39}$/, 'Key: lowercase, starts with a letter, letters/numbers/underscores'),
    label: z.string().trim().min(1).max(80), field_type: z.enum(FIELD_TYPES as [string, ...string[]]),
    placeholder: z.string().trim().max(120).nullish(), options: z.array(z.string().trim().min(1).max(80)).max(100).default([]),
    validation: z.object({ minLength: z.number().optional(), maxLength: z.number().optional(), min: z.number().optional(), max: z.number().optional(), pattern: z.string().max(200).optional(), patternMessage: z.string().max(120).optional() }).default({}),
    default_required: z.boolean().default(false), is_active: z.boolean().default(true), sort_order: z.coerce.number().int().default(0)
  }).refine(v => v.field_type !== 'dropdown' || v.options.length >= 2, { message: 'Dropdown needs at least two options' })
});
