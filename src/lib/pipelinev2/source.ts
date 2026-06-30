// Submission-source helpers for the Pipeline v2 table/drawer.
// `finance_applications.submission_source` records where an application came from.
// Stored slugs the app may SET via the editable dropdown:
//   website | manual | whatsapp | facebook
// Legacy/server-written values (e.g. 'whatsapp_parser') are mapped to a friendly
// label for display but are not offered as set-able options.

export const SOURCE_OPTIONS = [
  { value: 'website',  label: 'Website' },
  { value: 'manual',   label: 'Manual' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'facebook', label: 'Facebook' },
] as const;

/** Friendly label for any stored submission_source value. */
export const sourceLabel = (s: string | null | undefined): string => {
  if (s == null) return '—';
  const v = String(s).trim().toLowerCase();
  if (v === '') return '—';
  switch (v) {
    case 'website':          return 'Website';
    case 'manual':           return 'Manual';
    case 'whatsapp':
    case 'whatsapp_parser':  return 'WhatsApp';
    case 'facebook':         return 'Facebook';
    default:
      // Title-case the raw slug (underscores -> spaces) for unknown sources.
      return v
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
  }
};
