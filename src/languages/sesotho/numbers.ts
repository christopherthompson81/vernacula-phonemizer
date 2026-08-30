/**
 * Sesotho / Southern Sotho (st) cardinal number → words (space-separated; each word then runs through the g2p, so
 * the IPA stays consistent with the word engine).
 *
 * NUMERAL FORM CHOSEN. Sesotho numerals 1–5 are ADJECTIVAL and obligatorily carry noun-class concord, so there is
 * no class-neutral numeral. Two forms are therefore emitted, each in its proper place:
 *   • a BARE INTEGER 1–9 → the CITATION / COUNTING stems (nngwe, pedi, tharo, nne, hlano, tshelela, supa, robedi,
 *     robong) — literally what a Mosotho says counting aloud, and the only defensible choice for a TTS that has
 *     no noun to agree with.
 *   • the units slot INSIDE a compound → Sesotho's own noun-free device, the dummy noun motso (cl. 3) / metso
 *     (cl. 4) "unit, digit": leshome le metso e mmedi = "ten and two units" = 12. Still nounless, but grammatical.
 *
 * THE FORMATION (words + sources are data in sesotho.jsonc "numbers"):
 *   • tens/hundreds are MULTIPLICATIVE with cl.6 concord — mashome a mabedi (20), makgolo a mararo (300).
 *   • thousands+ are cl.7/8 nouns — sekete (1 000), dikete tse pedi (2 000).
 *   • components chain with the conjunction "le": makgolo a mahlano le mashome a mahlano le metso e mehlano (555).
 *   • EACH magnitude selects its OWN multiplier concord series (cl.4 after metso, cl.6 after mashome/makgolo,
 *     cl.8 after dikete) — three separate tables in the manifest on purpose. Reusing one series across the
 *     multiplier slots is the classic Bantu numeral bug.
 *   • Sotho 6–9 are RELATIVE verb forms (tsheletseng, supileng, robedi, robong) and take no class prefix, so they
 *     look identical in all three series — that is correct, not a copy-paste slip.
 */
import { digitIndex } from "../../core/numbers.ts";
import { loadManifest } from "../../core/loadManifest.ts";

/** The Sesotho cardinal number words (see sesotho.jsonc "numbers" for the cited sources). */
export interface SesothoNumbers {
    zero: string;
    /** bare counting stems 1–9 at indices 1–9. */
    units: string[];
    /** the compound units slot for 1 (motso o le mong). */
    unitOne: string;
    /** the compound units head for 2–9 (metso e), followed by a cl.4 stem. */
    unitNoun: string;
    /** cl.4 concord stems, indices 2–9. */
    class4: string[];
    /** cl.6 concord stems, indices 2–9 (after mashome / makgolo). */
    class6: string[];
    /** cl.8 concord stems, indices 2–9 (after dikete / dimilione / dibilione). */
    class8: string[];
    ten: string;
    /** "mashome a" — the tens head including its cl.6 concord particle. */
    tens: string;
    hundredOne: string;
    /** "makgolo a" — the hundreds head including its cl.6 concord particle. */
    hundreds: string;
    thousandOne: string;
    thousands: string;
    millionOne: string;
    millions: string;
    billionOne: string;
    billions: string;
    /** the cl.8 concord word (tse) used between a cl.8 magnitude and its 2–9 multiplier. */
    class8Concord: string;
    /** the conjunction joining magnitude components (le). */
    and: string;
}

const N = loadManifest<{ numbers: SesothoNumbers }>(import.meta.url, "sesotho.jsonc").numbers;

/** The units slot of a compound: the motso/metso dummy-noun construction. */
function unitPart(u: number): string {
    return u === 1 ? N.unitOne : `${N.unitNoun} ${N.class4[u]!}`;
}

/** A cl.8 magnitude (dikete/dimilione/dibilione) + its multiplier: "tse" + cl.8 stem for 2–9, else recursive. */
function class8Multiple(head: string, k: number): string {
    return k >= 2 && k <= 9 ? `${head} ${N.class8Concord} ${N.class8[k]!}` : `${head} ${numberToWords(k)}`;
}

/** A non-negative integer → space-separated Sesotho cardinal words. */
export function numberToWords(n: number, raw?: string): string {
    if (!Number.isSafeInteger(n) || n < 0)
        return [...(raw ?? String(Math.abs(n)))].map((d) => (d === "0" ? N.zero : (N.units[digitIndex(d)] ?? d))).join(" ");
    if (n === 0) return N.zero;
    if (n < 10) return N.units[n]!; // a BARE numeral → the citation/counting stem
    const parts: string[] = [];
    const b = Math.floor(n / 1e9);
    if (b > 0) parts.push(b === 1 ? N.billionOne : class8Multiple(N.billions, b));
    const m = Math.floor((n % 1e9) / 1e6);
    if (m > 0) parts.push(m === 1 ? N.millionOne : class8Multiple(N.millions, m));
    const th = Math.floor((n % 1e6) / 1000);
    if (th > 0) parts.push(th === 1 ? N.thousandOne : class8Multiple(N.thousands, th));
    const h = Math.floor((n % 1000) / 100);
    if (h === 1) parts.push(N.hundredOne);
    else if (h > 1) parts.push(`${N.hundreds} ${N.class6[h]!}`);
    const t = Math.floor((n % 100) / 10);
    if (t === 1) parts.push(N.ten);
    else if (t > 1) parts.push(`${N.tens} ${N.class6[t]!}`);
    const u = n % 10;
    if (u > 0) parts.push(unitPart(u));
    return parts.join(` ${N.and} `);
}
