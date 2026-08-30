/**
 * Luganda / Oluganda (lg) cardinal number → words (space-separated; each word then runs through the g2p, so the
 * IPA stays consistent with the word engine).
 *
 * NUMERAL FORM CHOSEN — the CITATION / COUNTING series (emu, bbiri, ssatu, nnya, ttaano, mukaaga, musanvu,
 * munaana, mwenda). Luganda numerals 1–5 are ADJECTIVAL and take noun-class concord (bbiri ~ abiri ~ bibiri ~
 * bubiri …), so there is no class-neutral numeral; the counting series (the class-III/VII shape) is what a
 * speaker says counting aloud or reading a figure off a page, and a TTS handed a bare integer has no noun to
 * agree with. 6–9 are NOUNS and never inflect, which is why they recur unchanged in every multiplier slot.
 *
 * THE FORMATION (words + sources are data in luganda.jsonc "numbers"):
 *   • teens are additive with the "na"/"n'" connective:  kkumi n'emu (11), kkumi na bbiri (12).
 *   • 20–50 are multiplicative — amakumi ("tens") + the class-6 a- multiplier: amakumi abiri = 20. But 60–90 are
 *     SINGLE NOUNS derived from 6–9: nkaaga, nsanvu, kinaana, kyenda. This is the Luganda signature.
 *   • hundreds: kikumi (class 7) vs bikumi (class 8) + a bi- multiplier — bikumi bibiri = 200.
 *   • thousands: lukumi vs nkumi + the multiplier rendered recursively — nkumi bbiri = 2 000.
 *   • millions/billions: kakadde / akawumbi, plural obukadde / obuwumbi + a class-14 bu- multiplier.
 *   • EVERY magnitude has its OWN multiplier concord series (a- / bi- / bu-); they are separate tables in the
 *     manifest on purpose — reusing one series across slots is the classic Bantu numeral bug.
 *   • the magnitude components are chained with "mu": kikumi mu amakumi abiri mu bbiri = 122 (attested).
 */
import { digitIndex } from "../../core/numbers.ts";
import { MANIFEST } from "./manifest.ts";

const N = MANIFEST.numbers;

/** 1 ≤ n < 100 — teens use na/n', the tens+unit join uses "mu". */
function below100(n: number): string {
    if (n < 10) return N.units[n]!;
    const t = Math.floor(n / 10);
    const u = n % 10;
    if (t === 1) {
        if (u === 0) return N.ten;
        // kkumi n'emu (elision before the vowel-initial emu) vs kkumi na bbiri
        const unit = N.units[u]!;
        return /^[aeiou]/u.test(unit)
            ? `${N.ten} ${N.andTeenElided}${unit}`
            : `${N.ten} ${N.andTeen} ${unit}`;
    }
    return u === 0 ? N.tens[t]! : `${N.tens[t]!} ${N.mu} ${N.units[u]!}`;
}

/** 1 ≤ n < 1000. */
function below1000(n: number): string {
    if (n < 100) return below100(n);
    const h = Math.floor(n / 100);
    const r = n % 100;
    const hundred = h === 1 ? N.hundredOne : `${N.hundreds} ${N.hundredsMult[h]!}`;
    return r ? `${hundred} ${N.mu} ${below1000(r)}` : hundred;
}

/** The class-14 (obukadde/obuwumbi) multiplier: the bu- concord for 2–9, else the number rendered recursively. */
function buMultiplier(k: number): string {
    return k >= 2 && k <= 9 ? N.buMult[k]! : numberToWords(k);
}

/** A non-negative integer → space-separated Luganda cardinal words. */
export function numberToWords(n: number, raw?: string): string {
    if (!Number.isSafeInteger(n) || n < 0)
        return [...(raw ?? String(Math.abs(n)))].map((d) => (d === "0" ? N.zero : (N.units[digitIndex(d)] ?? d))).join(" ");
    if (n === 0) return N.zero;
    const parts: string[] = [];
    const b = Math.floor(n / 1e9);
    if (b > 0) parts.push(b === 1 ? N.billionOne : `${N.billions} ${buMultiplier(b)}`);
    const m = Math.floor((n % 1e9) / 1e6);
    if (m > 0) parts.push(m === 1 ? N.millionOne : `${N.millions} ${buMultiplier(m)}`);
    const th = Math.floor((n % 1e6) / 1000);
    if (th > 0) parts.push(th === 1 ? N.thousandOne : `${N.thousands} ${numberToWords(th)}`);
    const r = n % 1000;
    if (r > 0) parts.push(below1000(r));
    return parts.join(` ${N.mu} `);
}
