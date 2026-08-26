/**
 * Hawaiian cardinal number → words. Polynesian decimal, but NOT Western-shaped, so a bespoke composer:
 *   • a standalone digit takes the counting prefix ʻe- (ʻekahi 1 … ʻeiwa 9); the BARE STEM (kahi, lua, kolu, hā …)
 *     is what appears inside a compound;
 *   • 10 ʻumi, 20 iwakālua (irregular), 30–90 are kana- + stem (kanakolu, kanahā … kanaiwa);
 *   • 11–99 with a unit digit FUSE tens + the additive connective kūmā + stem into ONE word:
 *     ʻumikūmākahi 11, iwakāluakūmālima 25, kanakolukūmāono 36;
 *   • the powers of ten are English loans (haneli 100, kaukani 1000, miliona 10⁶, biliona 10⁹ — precontact Hawaiian
 *     counted in fours, so there is no native base-ten series) and take a multiplier: hoʻokahi ("exactly one") for
 *     1, else the ʻe-form / compound (ʻelua haneli 200);
 *   • magnitude groups and the remainder are simply JUXTAPOSED — kūmā is NOT used after haneli:
 *     hoʻokahi haneli ʻekahi 101, hoʻokahi haneli ʻumi 110, hoʻokahi haneli iwakāluakūmālima 125.
 * Covers 0 … <10¹²; ≥10¹² degrades to digit-by-digit.
 *
 * Source: Omniglot "Numbers in Hawaiian" (ʻole, the ʻe-forms, ʻumikūmā- teens, iwakālua, kana- tens, haneli/kaukani/
 * miliona); Wikibooks "Hawaiian/Numbers" (the kūmā rule — "the tens place number, then kūmā, then the ones place
 * number without the ʻe- prefix" — and hoʻokahi hanele / ʻelua hanele); ʻŌlelo Online "Hawaiian Number Basics 1 to
 * 100"; Lingalot "Numbers in Hawaiian" (the hundreds column and that kūmā is not used after haneli); Keawekane 2017
 * "How Do You Count in Hawaiian?" (the ʻe-/ʻa- prefixes, hoʻokahi = "exactly one", and that haneli/kaukani/miliona/
 * biliona are English borrowings). Judgment calls: the short connective kūmā- is used (Pukui–Elbert also lists the
 * longer kumamā-), and "haneli" is preferred over the hanele/haneri variants. ⟨b⟩ in "biliona" is a loan letter the
 * g2p adapts to [p], which is the actual Hawaiian pronunciation.
 */
import { loadManifest } from "../../core/loadManifest.ts";

interface HawNumbers {
    zero: string;
    units: string[]; // 1..9 standalone (ʻe-prefixed); index 0 unused
    stems: string[]; // 1..9 bare stems used inside kūmā/kana- compounds
    ten: string;
    twenty: string;
    tensPrefix: string; // kana- (30..90)
    kuma: string; // the additive connective kūmā
    one: string; // hoʻokahi — the magnitude multiplier for 1
    magnitudes: { hundred: string; thousand: string; million: string; billion: string };
}
const N = loadManifest<{ numbers: HawNumbers }>(import.meta.url, "hawaiian.jsonc").numbers;

/** 1 ≤ n < 100. Tens + kūmā + stem fuse into one word (iwakāluakūmālima). */
function below100(n: number): string {
    if (n < 10) return N.units[n]!;
    const t = Math.floor(n / 10),
        u = n % 10;
    const tens = t === 1 ? N.ten : t === 2 ? N.twenty : `${N.tensPrefix}${N.stems[t]}`;
    return u === 0 ? tens : `${tens}${N.kuma}${N.stems[u]}`;
}

/** "<multiplier> <magnitude>": hoʻokahi haneli, ʻelua haneli, ʻumikūmālua kaukani. */
function scaleGroup(count: number, scale: string): string {
    return `${count === 1 ? N.one : below1000(count)} ${scale}`;
}

/** 1 ≤ n < 1000 — the hundred group and the remainder are juxtaposed (no connective). */
function below1000(n: number): string {
    if (n < 100) return below100(n);
    const h = Math.floor(n / 100),
        r = n % 100;
    const hundred = scaleGroup(h, N.magnitudes.hundred);
    return r ? `${hundred} ${below100(r)}` : hundred;
}

/** Non-negative integer (< 10¹²) → Hawaiian words; larger / non-finite → digit-by-digit. */
export function numberToWords(n: number, raw?: string): string {
    if (!Number.isSafeInteger(n) || n < 0 || n >= 1e12)
        return [...(raw ?? String(Math.abs(n)))].map((d) => (d === "0" ? N.zero : (N.units[Number(d)] ?? d))).join(" ");
    if (n === 0) return N.zero; // ʻole
    if (n < 1000) return below1000(n);
    for (const [base, scale] of [
        [1e9, N.magnitudes.billion],
        [1e6, N.magnitudes.million],
        [1e3, N.magnitudes.thousand],
    ] as const) {
        if (n < base) continue;
        const c = Math.floor(n / base),
            r = n % base;
        const group = scaleGroup(c, scale);
        return r ? `${group} ${numberToWords(r)}` : group;
    }
    return below1000(n); // unreachable (n < 1000 handled above)
}
