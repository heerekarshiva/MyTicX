import { createAdminClient } from '@/lib/supabase/admin';
import { getSettings, json } from '@/lib/events/server';

// Public configuration that drives the organizer form: everything the admin
// panel controls (types, templates + their fields, field library, rules).
export async function GET() {
  const admin = createAdminClient();
  const [types, defs, tpls, tplFields, settings] = await Promise.all([
    admin.from('event_types').select('*').eq('is_active', true).order('sort_order'),
    admin.from('field_definitions').select('*').eq('is_active', true).order('sort_order'),
    admin.from('event_templates').select('*').eq('is_active', true),
    admin.from('event_template_fields').select('template_id, field_definition_id, is_required, sort_order').order('sort_order'),
    getSettings()
  ]);
  return json({
    types: types.data ?? [], fieldLibrary: defs.data ?? [],
    templates: (tpls.data ?? []).map(t => ({ ...t, fields: (tplFields.data ?? []).filter(f => f.template_id === t.id) })),
    settings: { cutoffMinutes: settings.registration_cutoff_minutes, timezone: settings.timezone, allowPaid: settings.allow_paid_events, maxPrice: settings.max_price, maxPosterMb: settings.max_poster_mb, maxCustomFields: settings.max_custom_fields, navEnabled: settings.organize_nav_enabled, navLabel: settings.organize_nav_label }
  });
}
