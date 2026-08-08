/**
 * Luo / Dholuo cardinal number → words. DECIMAL. Bespoke rather than the shared `westernNumberWords` for one
 * reason the data schema cannot carry: the additive coordinator gi 'and' ELIDES its vowel before a
 * vowel-initial word, and every Dholuo unit is vowel-initial (a-/o-), so the coordinator is written SOLID with
 * the unit — apar gachiel 11 (apar + gi + achiel), piero ariyo gariyo 22 — but stays free before the
 * consonant-initial magnitude words (mia ariyo gi piero adek). Structure:
 *   0–9   nono, achiel, ariyo, adek, ang'wen, abich, auchiel, abiriyo, aboro, ochiko
 *   10    apar; 20–90 piero + unit (piero ariyo 20 … piero ochiko 90) — the multiplier FOLLOWS piero
 *   11–19 apar + g-unit; 21–99 piero UNIT + g-unit
 *   100s  mia + unit (mia achiel 100, mia ariyo 200); 1000s elfu + unit; then milion / bilion + unit
 * Dholuo is NOT quinary in the living system: 6 auchiel does look like a frozen a-(w)uchiel beside achiel 1 (an
 * old 5+1), but 7–9 (abiriyo, aboro, ochiko) are opaque, so there is no productive 5+n formation to compose.
 *
 * SOURCES (authored DATA — every form attested, none reconstructed):
 *   [c] Omniglot, "Numbers in Dholuo" (corrections by C. Achola Okore) — nono 0, the units, apar, the
 *       elided teens apar gachiel … apar gochiko, the piero tens 20–90, mia hundreds.
 *   [c] learndholuo.com, "How to Count in Dholuo: 1 to 1,000,000,000" — the gi elision rule, mia achiel /
 *       mia ariyo, elfu achiel 1000, milion achiel 10⁶, bilion achiel 10⁹, and the worked 1235
 *       (elfu achiel, mia ariyo gi piero adek gi abich) that fixes the slot order.
 * TRADITIONAL vs MODERN: the MODERN system. 0–999 is the inherited Nilotic material throughout; 1000 and up use
 * the everyday borrowed forms elfu / milion / bilion (via Swahili/Arabic and English) rather than the older
 * gana 'thousand' / tara 'million' that Omniglot also records — the borrowed set is what current Dholuo
 * speech and teaching material use, and it extends cleanly to 10⁹, which the traditional set does not
 * (Omniglot has to build 10⁹ as tara gi gana '10⁶ and 10³').
 */
import { MANIFEST } from "./manifest.ts";

const ONES = ["nono", "achiel", "ariyo", "adek", "ang'wen", "abich", "auchiel", "abiriyo", "aboro", "ochiko"];
const TEN = "apar";
const TENS = "piero"; // 'tens' — takes a following multiplier
const HUNDRED = "mia";
const THOUSAND = "elfu";
const MILLION = "milion";
const BILLION = "bilion";
const VOWELS = new Set(MANIFEST.spellingVowels); // ORTHOGRAPHIC (luo.jsonc), never core/ipa.ts

/** The coordinator gi 'and': elides to a solid g- before a vowel-initial word, stays free before a consonant. */
const and = (w: string): string => (VOWELS.has(w[0]!) ? `g${w}` : `gi ${w}`);

/** 0–99. */
function below100(n: number): string {
    if (n < 10) return ONES[n]!;
    const t = Math.floor(n / 10),
        u = n % 10;
    const head = t === 1 ? TEN : `${TENS} ${ONES[t]!}`;
    return u === 0 ? head : `${head} ${and(ONES[u]!)}`;
}

/** 1–999. */
function below1000(n: number): string {
    if (n < 100) return below100(n);
    const h = Math.floor(n / 100),
        r = n % 100;
    const head = `${HUNDRED} ${ONES[h]!}`;
    return r === 0 ? head : `${head} ${and(below100(r))}`;
}

/** Non-negative integer → Dholuo words; out of range → digit-by-digit. */
export function numberToWords(n: number): string {
    if (!Number.isSafeInteger(n) || n < 0 || n >= 1e12) {
        return [...String(Math.abs(n))].filter((c) => c >= "0" && c <= "9").map((d) => ONES[Number(d)]!).join(" ");
    }
    if (n < 1000) return below1000(n);
    if (n < 1e6) {
        const th = Math.floor(n / 1000),
            r = n % 1000;
        return `${THOUSAND} ${below1000(th)}${r === 0 ? "" : ` ${and(below1000(r))}`}`;
    }
    if (n < 1e9) {
        const m = Math.floor(n / 1e6),
            r = n % 1e6;
        return `${MILLION} ${below1000(m)}${r === 0 ? "" : ` ${and(numberToWords(r))}`}`;
    }
    const b = Math.floor(n / 1e9),
        r = n % 1e9;
    return `${BILLION} ${below1000(b)}${r === 0 ? "" : ` ${and(numberToWords(r))}`}`;
}
