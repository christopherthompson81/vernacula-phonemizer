/**
 * Umbundu (umb) cardinal number → words (space-separated; each word then runs through the g2p, so the IPA stays
 * consistent with the word engine).
 *
 * NUMERAL FORM CHOSEN — the CITATION / COUNTING series (mosi, vali, tatu, kwãla, tãlo, epandu, epandu vali,
 * ecelãla, ecea). Umbundu numerals 1–5 are adjectival and take noun-class concord, so there is no class-neutral
 * numeral; the counting series is what a speaker recites, and a TTS handed a bare integer has no noun to agree
 * with. 6–9 are QUINARY-BASED NOUNS ("epandu" and friends) and never inflect — hence identical in every slot.
 *
 * THE FORMATION (words + sources + the extrapolations are data in umbundu.jsonc "numbers"):
 *   • tens are multiplicative on the cl.6 plural: akwi avali (20), akwi atatu (30), akwi epandu (60).
 *   • hundreds are multiplicative on the cl.8 plural: ocita (100), ovita vivali (200), ovita epandu (600).
 *   • thousands/millions: ohulukãyi, ohulua — used invariant with a cl.8 multiplier; 10⁹ = ohulua ohulukãyi.
 *   • FOUR distinct multiplier series, one per magnitude slot (bare citation / after-"la" additive / cl.6 after
 *     akwi / cl.8 after ovita). They are separate tables in the manifest on purpose: reusing one series across
 *     the multiplier slots is the classic Bantu numeral bug (it is what makes 60 collide with 51).
 *   • the connective is "la", ELIDED to "l'" before a vowel-initial word (ekwi l'epandu = 16), so components
 *     chain as ovita vitãlo l'akwi atãlo la vitãlo (555).
 */
import { MANIFEST } from "./manifest.ts";

const N = MANIFEST.numbers;

/** Chain the magnitude components with the connective "la", elided to "l'" before a vowel. */
function join(parts: string[]): string {
    return parts.reduce((acc, p) =>
        acc === "" ? p : /^[aeiouãẽĩõũ]/u.test(p) ? `${acc} ${N.andElided}${p}` : `${acc} ${N.and} ${p}`,
    "");
}

/** The magnitude components of 1 ≤ n, outermost first. `top` = this is a bare numeral (use the citation units). */
function components(n: number, top: boolean): string[] {
    const parts: string[] = [];
    const m = Math.floor(n / 1e6);
    if (m > 0) parts.push(m === 1 ? N.million : `${N.million} ${multiplier(m)}`);
    const th = Math.floor((n % 1e6) / 1000);
    if (th > 0) parts.push(th === 1 ? N.thousand : `${N.thousand} ${multiplier(th)}`);
    const h = Math.floor((n % 1000) / 100);
    if (h === 1) parts.push(N.hundredOne);
    else if (h > 1) parts.push(`${N.hundreds} ${N.hundredsMult[h]!}`);
    const t = Math.floor((n % 100) / 10);
    if (t === 1) parts.push(N.ten);
    else if (t > 1) parts.push(`${N.tens} ${N.tensMult[t]!}`);
    const u = n % 10;
    // A bare 1–9 is the citation form; a unit inside a compound sits in the additive (post-"la") slot.
    if (u > 0) parts.push(top && parts.length === 0 ? N.units[u]! : N.additive[u]!);
    return parts;
}

/** The multiplier of ohulukãyi / ohulua: the cl.8 series for 2–9, else the count rendered recursively. */
function multiplier(k: number): string {
    return k >= 2 && k <= 9 ? N.hundredsMult[k]! : join(components(k, false));
}

/** A non-negative integer → space-separated Umbundu cardinal words. */
export function numberToWords(n: number): string {
    if (!Number.isSafeInteger(n) || n < 0)
        return [...String(Math.abs(n))].map((d) => (d === "0" ? N.zero : (N.units[Number(d)] ?? d))).join(" ");
    if (n === 0) return N.zero;
    return join(components(n, true));
}
