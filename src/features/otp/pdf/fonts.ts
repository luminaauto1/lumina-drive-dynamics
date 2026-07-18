// Montserrat registration for the react-pdf OTP renderer — the same five
// weights the Chromium print engine embedded in the owner's reference PDF
// (Lumina-Auto-OTP-Sample.pdf): Regular/Medium/SemiBold/Bold/ExtraBold.
// WOFF files come straight from @fontsource (already a dependency for the
// on-screen document). Browser-only: the Node test harness registers its own
// absolute file paths instead of these Vite asset URLs.
import { Font } from '@react-pdf/renderer';
import w400 from '@fontsource/montserrat/files/montserrat-latin-400-normal.woff?url';
import w500 from '@fontsource/montserrat/files/montserrat-latin-500-normal.woff?url';
import w600 from '@fontsource/montserrat/files/montserrat-latin-600-normal.woff?url';
import w700 from '@fontsource/montserrat/files/montserrat-latin-700-normal.woff?url';
import w800 from '@fontsource/montserrat/files/montserrat-latin-800-normal.woff?url';

let registered = false;

export function ensureOtpFonts(): void {
  if (registered) return;
  registered = true;
  Font.register({
    family: 'Montserrat',
    fonts: [
      { src: w400, fontWeight: 400 },
      { src: w500, fontWeight: 500 },
      { src: w600, fontWeight: 600 },
      { src: w700, fontWeight: 700 },
      { src: w800, fontWeight: 800 },
    ],
  });
  // Legal text must never hyphenate — the print engine didn't.
  Font.registerHyphenationCallback((word) => [word]);
}
