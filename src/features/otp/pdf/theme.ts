// Unit helpers + palette for the react-pdf OTP document. The HTML/CSS design
// (OtpDocument.css) is authored in CSS px at 96dpi on a 210mm sheet; react-pdf
// works in PostScript points (72dpi). px() keeps every measurement literally
// the CSS value so the two renderings stay visually identical.
export const px = (n: number): number => n * 0.75; // 1 CSS px = 0.75pt
export const mm = (n: number): number => n * 2.834645; // 1mm = 2.8346pt

export const INK = '#0B0B0C';
export const OBSIDIAN = '#0B0B0C';
export const GREY = '#8A8A8E';
export const LINE = '#D9D9DB';
export const LINE_SOFT = '#ECECEE';
export const PAPER = '#FFFFFF';
export const BAND = '#0B0B0C';

/** Letter-spacing: CSS em values → pt for a given CSS-px font size. */
export const track = (fontPx: number, em: number): number => px(fontPx * em);
