/**
 * Asturian cardinal number → words (masculine). Emits SPACE-separated words so each element reads through the
 * asturian.ts g2p. Covers 0 … <10¹²; larger / unsafe values read digit-by-digit.
 *
 * SOURCE for the numeral table (asturian.jsonc `numbers`): Academia de la Llingua Asturiana, "Gramática de la
 * Llingua Asturiana", cap. XII "Los numberales" §2.2 (pp. 127–129) — the normative table and the three
 * composition rules encoded below:
 *   - DECENES + UNIDAES — the twenties FUSE into one word (ventiún, ventidós …), the other tens take ⟨y⟩ and stay
 *     separate (trenta y un, cuarenta y dos);
 *   - CENTENES — only 100 has its own name (cien); 200+ = unit + cientos;
 *   - CENTENA Y OTRU NÚMBERU — the cien/cientu ALTERNATION: bare 100 is ⟨cien⟩ (and it is ⟨cien⟩ as the
 *     multiplier of mil: "100.000 cien mil"), but 101–199 read ⟨cientu⟩ + the remainder (101 cientu un,
 *     131 cientu trenta y un). Exactly the Spanish cien/ciento split.
 *
 * Pattern B (bespoke) rather than the shared `westernNumberWords`: the cien/cientu alternation is context-
 * sensitive (a bare round hundred vs a hundred with a remainder), which the flat `hundreds[]` slot cannot encode;
 * nor can that composer express the ⟨y⟩ connector or the fused twenties.
 */
import { loadManifest } from "../../core/loadManifest.ts";

interface AsturianNumbersDef {
    numbers: {
        ones: string[];
        tens: string[];
        twenties: string[];
        hundreds: string[];
        hundredExact: string;
        hundredCombining: string;
        thousand: string;
        and: string;
        scales: { value: number; one: string; many: string }[];
    };
}
// Loaded independently of asturian.ts's own manifest read (asturian.ts imports THIS module — reaching back for a
// shared `DEF` would be an import cycle). The manifest is a small JSONC parsed once at module init.
const N = loadManifest<AsturianNumbersDef>(import.meta.url, "asturian.jsonc").numbers;
const ONES = N.ones,
    TENS = N.tens,
    HUNDREDS = N.hundreds;

/** 0 ≤ n < 100. The twenties are FUSED single words; 30–90 take the ⟨y⟩ connector (ALLA XII.2.2). */
function below100(n: number): string {
    if (n < 20) return ONES[n]!;
    const t = Math.floor(n / 10),
        u = n % 10;
    if (u === 0) return TENS[t]!;
    return t === 2 ? N.twenties[u]! : `${TENS[t]} ${N.and} ${ONES[u]}`;
}

/** 1 ≤ n < 1000. The cien/cientu alternation: bare 100 → cien, 101–199 → cientu + remainder. */
function below1000(n: number): string {
    if (n < 100) return below100(n);
    const h = Math.floor(n / 100),
        r = n % 100;
    const head = h === 1 ? (r ? N.hundredCombining : N.hundredExact) : HUNDREDS[h]!;
    return r ? `${head} ${below100(r)}` : head;
}

/** 1 ≤ n < 10⁶. mil is invariable and drops its "un" (mil, dos mil, cien mil). */
function below1e6(n: number): string {
    if (n < 1000) return below1000(n);
    const th = Math.floor(n / 1000),
        r = n % 1000;
    const thousand = th === 1 ? N.thousand : `${below1000(th)} ${N.thousand}`;
    return r ? `${thousand} ${below1000(r)}` : thousand;
}

/** Non-negative integer → Asturian words. Out-of-range / unsafe values read digit-by-digit (never empty). */
export function numberToWords(n: number): string {
    if (!Number.isSafeInteger(n) || n < 0 || n >= 1e12)
        return [...String(Math.abs(n))].map((d) => ONES[Number(d)] ?? d).join(" ");
    if (n === 0) return ONES[0]!; // cero
    if (n < 1e6) return below1e6(n);
    for (const sc of N.scales) {
        if (n < sc.value) continue;
        const q = Math.floor(n / sc.value),
            r = n % sc.value;
        // millón is a collective NOUN: it keeps the "un" (un millón) and pluralises (dos millones). With only the
        // 10⁶ scale authored, 10⁹ composes as the Ibero-Romance long-scale "mil millones".
        const head = q === 1 ? sc.one : `${below1e6(q)} ${sc.many}`;
        return r ? `${head} ${numberToWords(r)}` : head;
    }
    return below1e6(n); // unreachable (n ≥ 10⁶ matched the scale)
}
