// One-page "Outstanding bank feedback" tick-list. The owner WhatsApps this PDF
// to the F&I, who works down it name-by-name in the bank portals — so it MUST
// stay a single A4 page no matter how many applications are outstanding.
// Auto-fit picks the first column-count/type-size rung whose simulated flow
// fits, names are the big scannable element, and every entry gets a paper
// checkbox to tick once the bank's answer is captured.
//
// Scope: applications still awaiting bank feedback — status IN
// ('ready_to_submit', 'submitted_to_banks', 'sent_to_banks'). 'pending' (never
// sent to a bank) and every later/exception status are deliberately excluded.
import jsPDF from 'jspdf';

/** Statuses with no bank feedback yet, in the group order they print. */
export const OUTSTANDING_FEEDBACK_STATUSES = [
  'ready_to_submit',
  'submitted_to_banks',
  'sent_to_banks',
] as const;

// Fallback group labels — used when the caller's labelFor (status_overrides
// aware) is absent or can only echo the raw slug back (e.g. 'submitted_to_banks'
// has no entry in ADMIN_STATUS_LABELS but is still in the feedback scope).
const GROUP_LABELS: Record<string, string> = {
  ready_to_submit: 'Ready to Submit',
  submitted_to_banks: 'Submitted to Banks',
  sent_to_banks: 'Sent to Banks',
};

/** Minimal application shape — FinanceApplication rows satisfy it structurally. */
export interface OutstandingFeedbackApp {
  status: string;
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  id_number?: string | null;
  status_history?: unknown;
  status_updated_at?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
}

// Obsidian black & white theme — matches the Lumina Quote/OTP/Invoice documents
// (owner explicitly wants NO white-and-gold PDFs). Black page, white type,
// gray supporting text, monochrome accents.
const PAGE_BG: [number, number, number] = [10, 10, 10];
const WHITE: [number, number, number] = [245, 245, 245];
const GRAY: [number, number, number] = [150, 150, 150];
const DIM: [number, number, number] = [105, 105, 105];
const BAR_BG: [number, number, number] = [28, 28, 28];

// Column/type-size ladder for the one-page guarantee — the first rung whose
// simulated flow fits wins. ID numbers print ONLY on the roomy 2-column rung.
const LAYOUTS: { cols: number; font: number }[] = [
  { cols: 2, font: 8 },
  { cols: 3, font: 7 },
  { cols: 3, font: 6.2 },
  { cols: 4, font: 5.8 },
];
// Last-resort shrink steps (4 columns) when even the ladder overflows.
const FALLBACK_FONTS = [5.6, 5.4, 5.2, 5];

const pad2 = (n: number) => String(n).padStart(2, '0');

/** dd/MM — the short "since when" hint printed next to each name. */
const shortDate = (iso: string | null | undefined): string => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`;
};

/** When the app entered its CURRENT status: last matching status_history entry,
 *  falling back to status_updated_at → updated_at → created_at. */
const statusEnteredAt = (app: OutstandingFeedbackApp): string | null => {
  const history = Array.isArray(app.status_history)
    ? (app.status_history as Array<{ status?: string; timestamp?: string }>)
    : [];
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i]?.status === app.status && history[i]?.timestamp) return history[i].timestamp!;
  }
  return app.status_updated_at || app.updated_at || app.created_at || null;
};

interface FeedbackEntry { name: string; date: string; idNumber: string }
interface FeedbackGroup { label: string; entries: FeedbackEntry[] }

export const generateOutstandingFeedbackPDF = (
  apps: OutstandingFeedbackApp[],
  labelFor?: (slug: string) => string,
) => {
  // ── Group + sort: fixed status order, names A→Z inside each group ──
  const resolveLabel = (slug: string): string => {
    const custom = labelFor?.(slug);
    return custom && custom !== slug ? custom : GROUP_LABELS[slug] || slug;
  };
  const countsBySlug: Record<string, number> = {};
  const groups: FeedbackGroup[] = [];
  for (const slug of OUTSTANDING_FEEDBACK_STATUSES) {
    const entries = apps
      .filter((a) => (a.status || '').toLowerCase().trim() === slug)
      .map((a) => ({
        name: (a.full_name || [a.first_name, a.last_name].filter(Boolean).join(' ')).trim() || 'Unknown client',
        date: shortDate(statusEnteredAt(a)),
        idNumber: (a.id_number || '').trim(),
      }))
      .sort((x, y) => x.name.localeCompare(y.name, undefined, { sensitivity: 'base' }));
    countsBySlug[slug] = entries.length;
    // Empty groups are skipped in the body (a zero-entry bar wastes lines) but
    // still show a 0 in the header counts line so nothing looks forgotten.
    if (entries.length) groups.push({ label: resolveLabel(slug), entries });
  }
  const total = apps.length;

  const doc = new jsPDF(); // A4 portrait, mm
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 10;
  const frame = { left: margin, right: pageW - margin, top: 28, bottom: pageH - 11 };

  // ── Obsidian canvas: paint the whole page black before anything else ──
  doc.setFillColor(...PAGE_BG);
  doc.rect(0, 0, pageW, pageH, 'F');

  // ── Header: title + generated date + total & per-status counts ──
  const now = new Date();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(...WHITE);
  doc.text('OUTSTANDING BANK FEEDBACK', margin, 16);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...GRAY);
  doc.text(`Generated ${pad2(now.getDate())}/${pad2(now.getMonth() + 1)}/${now.getFullYear()}`, pageW - margin, 16, { align: 'right' });

  const countsLine = OUTSTANDING_FEEDBACK_STATUSES
    .map((slug) => `${resolveLabel(slug)}: ${countsBySlug[slug]}`)
    .join('   •   ');
  doc.setFontSize(8.5);
  doc.setTextColor(...GRAY);
  doc.text(`${total} application${total === 1 ? '' : 's'} awaiting bank feedback   •   ${countsLine}`, margin, 21.5);

  doc.setDrawColor(...WHITE);
  doc.setLineWidth(0.6);
  doc.line(margin, 24.5, pageW - margin, 24.5);

  // ── Footer (drawn up-front so it exists even on a worst-case truncated flow) ──
  doc.setDrawColor(...DIM);
  doc.setLineWidth(0.3);
  doc.line(margin, pageH - 9.5, pageW - margin, pageH - 9.5);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(...DIM);
  doc.text("Lumina Auto  •  Tick each client once the bank's feedback has been captured", pageW / 2, pageH - 6, { align: 'center' });

  // Ellipsis-truncate to a max width at the CURRENT doc font/size.
  const truncate = (text: string, maxW: number): string => {
    if (doc.getTextWidth(text) <= maxW) return text;
    let t = text;
    while (t.length > 1 && doc.getTextWidth(`${t}…`) > maxW) t = t.slice(0, -1);
    return `${t}…`;
  };

  // Newspaper flow: fill column 1 top→bottom, then column 2, … Group headers sit
  // inline where their section starts (never orphaned at a column foot) and
  // repeat nothing. Returns false when the flow overflows the last column —
  // that boolean IS the auto-fit probe result (draw=false measures only).
  const flow = (cols: number, font: number, draw: boolean): boolean => {
    const gap = 5;
    const colW = (frame.right - frame.left - gap * (cols - 1)) / cols;
    const lh = font * 0.53;              // entry line height (mm)
    const headH = lh + 2.4;              // group header bar height
    const box = Math.max(1.6, lh - 1.6); // paper checkbox side
    const includeId = cols === 2;        // ID numbers only when there's room
    const dateFont = Math.max(font - 1.2, 4.5);
    let col = 0;
    let y = frame.top;
    const nextCol = (): boolean => { col += 1; y = frame.top; return col < cols; };

    for (const g of groups) {
      // Keep the header attached to at least one entry. Space consumed before
      // the first entry ends is headH + 1 (post-header gap) + lh — the +1 must
      // be counted here or the header can strand alone at a column foot.
      if (y + headH + 1 + lh > frame.bottom && !nextCol()) return false;
      if (draw) {
        const x = frame.left + col * (colW + gap);
        doc.setFillColor(...BAR_BG);
        doc.rect(x, y, colW, headH, 'F');
        doc.setFillColor(...WHITE);
        doc.rect(x, y, 1.4, headH, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(font + 1);
        doc.setTextColor(...WHITE);
        doc.text(`${g.label.toUpperCase()} (${g.entries.length})`, x + 3.4, y + headH * 0.72);
      }
      y += headH + 1;
      for (const e of g.entries) {
        if (y + lh > frame.bottom && !nextCol()) return false;
        if (draw) {
          const x = frame.left + col * (colW + gap);
          const baseline = y + lh * 0.78;
          doc.setDrawColor(...GRAY);
          doc.setLineWidth(0.25);
          doc.rect(x, y + (lh - box) / 2, box, box);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(dateFont);
          const dateW = e.date ? doc.getTextWidth(e.date) : 0;
          if (e.date) {
            doc.setTextColor(...GRAY);
            doc.text(e.date, x + colW, baseline, { align: 'right' });
          }
          const textX = x + box + 1.8;
          const textMax = colW - box - 1.8 - dateW - 2;
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(font);
          doc.setTextColor(...WHITE);
          if (includeId && e.idNumber) {
            const name = truncate(e.name, textMax * 0.62);
            doc.text(name, textX, baseline);
            const nameW = doc.getTextWidth(name);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(dateFont);
            doc.setTextColor(...GRAY);
            doc.text(truncate(e.idNumber, textMax - nameW - 2), textX + nameW + 2, baseline);
          } else {
            doc.text(truncate(e.name, textMax), textX, baseline);
          }
        }
        y += lh;
      }
      y += 2; // breathing room before the next group header
    }
    return true;
  };

  // ── Auto-fit: probe the ladder, then keep shrinking as a last resort ──
  let chosen = { cols: 4, font: 5 }; // hard floor — still one page, worst case
  let fits = false;
  for (const l of LAYOUTS) {
    if (flow(l.cols, l.font, false)) { chosen = l; fits = true; break; }
  }
  if (!fits) {
    for (const font of FALLBACK_FONTS) {
      if (flow(4, font, false)) { chosen = { cols: 4, font }; break; }
    }
  }
  flow(chosen.cols, chosen.font, true);

  doc.save(`lumina-outstanding-feedback-${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}.pdf`);
};
