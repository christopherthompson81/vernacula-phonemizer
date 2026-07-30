/**
 * Telugu cardinal number → words, Indian grouping (వెయ్యి 10³ / లక్ష 10⁵ / కోటి 10⁷).
 *
 * WHY TELUGU CANNOT USE THE SHARED `indicNumberWords` COMPOSER. Two independent reasons, both of which
 * made every one of the 627 numerals in the te_in corpus wrong before this file existed:
 *
 *   1. ORDER. The shared composer's un-authored 21-99 fallback emits UNIT then TENS (the Hindi
 *      ekchālīs shape). Telugu is TENS then UNIT, so 93% read *మూడు తొంభై — "three ninety".
 *   2. MAGNITUDE AGREEMENT. The shared composer writes `units[h] + hundred` unconditionally, so
 *      100 read *ఒకటి వంద and 1000 read *ఒకటి వెయ్యి ("one hundred", "one thousand", with the
 *      numeral spelled out — a form no speaker uses). Telugu instead inflects the magnitude noun:
 *        count 1               → bare        వంద / వెయ్యి / లక్ష / కోటి
 *        count > 1             → plural      రెండు వందలు, ముప్పై వేలు
 *        count > 1 + remainder → obl. plural రెండు వందల యాభై, రెండు వేల పదకొండు
 *        count 1 + remainder, hundreds only  → suppletive stem నూట (నూట యాభై = 150)
 *
 * EVIDENCE for the four forms — corpus text and, where the text alone could not settle it, the FLEURS
 * audio read back through Parakeet (playbook step 5b; te_in/test):
 *   · "దాదాపు మూడు వేల"  (corpus)  — oblique plural వేల before a remainder/noun
 *   · 2011 → "రెండు వేల పదకొండు"   (audio, 14062468540202204867) — NOT *రెండు వెయ్యి పదకొండు
 *   · 150  → "నూట యాభై"            (audio, 15009446377620036374) — the suppletive నూట
 *   · 200  → "రెండు వందల"          (same utterance)
 *   · 400  → "నాలుగు వందల"         (audio, 17734440130091015092 + 3701404004770268839, two readers)
 *   · 30000 → "ముప్పై వేల"         (same two readers)
 *
 * YEARS ARE READ AS CENTURIES in the 1100-1999 band — పంతొమ్మిది వందల డెబ్బై ఆరు for 1976, not
 * *వెయ్యి తొమ్మిది వందల డెబ్బై ఆరు. That is a READING choice the transcript cannot express, so it was
 * arbitrated on the audio and came back unanimous across four recordings of three different sentences:
 *   1976 ×2 readers → పంతొమ్మిది వందల డెబ్బై ఆరు   (4109835095717580820, 15464403826497019680)
 *   1966 ×2 readers → పంతొమ్మిది వందల అరవై ఆరు     (17734440130091015092, 3701404004770268839)
 *   1989           → పంతొమ్మిది వందల ఎనభై తొమ్మిది (3131782175864347195)
 * The 2000s take the ordinary cardinal (2011 → రెండు వేల పదకొండు, audio above), which is what the
 * compositor already produces — so only the 1100-1999 band gets `yearToWords`.
 */
import { MANIFEST } from "./manifest.ts";

const N = MANIFEST.numbers;
const ONES = N.units,
    TEENS = N.teens,
    TENS = N.tens,
    F = N.magnitudeForms;

/** 1-99. Telugu is regular here — the ten's free form followed by the unit (ఇరవై ఒకటి). */
function below100(n: number): string[] {
    if (n <= 0) return [];
    if (n < 10) return [ONES[n]!];
    if (n < 20) return [TEENS[n - 10]!];
    const t = Math.floor(n / 10) * 10,
        u = n % 10;
    return u === 0 ? [TENS[String(t)]!] : [TENS[String(t)]!, ONES[u]!];
}

/** The four-way magnitude form, selected by count and by whether anything follows it. */
function magnitude(key: keyof typeof F, count: number, hasRemainder: boolean): string {
    const f = F[key];
    if (count === 1) return hasRemainder ? f.oneCombining : f.one;
    return hasRemainder ? f.pluralOblique : f.plural;
}

/** 1-999. The count of hundreds is never spelled for 1 — 100 is వంద, and 150 is నూట యాభై. */
function below1000(n: number): string[] {
    const h = Math.floor(n / 100),
        r = n % 100;
    if (h === 0) return below100(r);
    const mag = magnitude("hundred", h, r > 0);
    return h === 1 ? [mag, ...below100(r)] : [ONES[h]!, mag, ...below100(r)];
}

/** A magnitude group: its count (spelled by below1000) plus the agreeing magnitude noun. */
function group(key: keyof typeof F, count: number, hasRemainder: boolean): string[] {
    const mag = magnitude(key, count, hasRemainder);
    return count === 1 ? [mag] : [...below1000(count), mag];
}

/** Non-negative integer → Telugu words. */
export function numberToWords(n: number): string {
    if (!Number.isFinite(n) || n < 0) return "";
    if (n === 0) return ONES[0]!;
    const parts: string[] = [];
    const crore = Math.floor(n / 10000000);
    n %= 10000000;
    const lakh = Math.floor(n / 100000);
    n %= 100000;
    const thou = Math.floor(n / 1000);
    n %= 1000;
    if (crore > 0) parts.push(...group("crore", crore, lakh + thou + n > 0));
    if (lakh > 0) parts.push(...group("lakh", lakh, thou + n > 0));
    if (thou > 0) parts.push(...group("thousand", thou, n > 0));
    parts.push(...below1000(n));
    return parts.join(" ");
}

/** True for the band that takes the century reading; see the header. */
export const isCenturyYear = (n: number): boolean => n >= 1100 && n <= 1999;

/** 1100-1999 read as centuries: 1976 → పంతొమ్మిది వందల డెబ్బై ఆరు. Audio-arbitrated (header). */
export function yearToWords(n: number): string {
    if (!isCenturyYear(n)) return numberToWords(n);
    const century = Math.floor(n / 100),
        rest = n % 100;
    return [...below100(century), magnitude("hundred", 2, rest > 0), ...below100(rest)].join(" ");
}

/**
 * The ORDINAL stem of a cardinal word. Telugu forms ordinals by attaching వ to the LAST word of the
 * cardinal, after a regular final-vowel adjustment. Emitted apart, వ reaches the g2p as a stray
 * syllable [ʋa] carrying its own primary stress.
 *
 *   -ు  → drop it        పది→పద-, ఎనిమిది→ఎనిమిద-, రెండు→రెండ-, పదిహేను→పదిహేన-
 *   -ి  → drop it        ఒకటి→ఒకట-, కోటి→కోట-
 *   -ై  → -య్య           ఇరవై→ఇరవయ్య-  ← attested verbatim in this corpus as ఇరవయ్యవ ("20th century")
 *   else (inherent -a)   వంద→వంద-, లక్ష→లక్ష-
 */
export function ordinalStem(word: string): string {
    if (word.endsWith("ు") || word.endsWith("ి")) return word.slice(0, -1);
    if (word.endsWith("ై")) return `${word.slice(0, -1)}య్య`;
    return word;
}

/** N + వ, fused onto the final cardinal word (18వ → పద్దెనిమిదవ, 20వ → ఇరవయ్యవ). */
export function ordinalToWords(n: number, suffix = "వ"): string {
    const words = (isCenturyYear(n) ? yearToWords(n) : numberToWords(n)).split(" ");
    const last = words[words.length - 1];
    if (last === undefined || last === "") return "";
    words[words.length - 1] = `${ordinalStem(last)}${suffix}`;
    return words.join(" ");
}
