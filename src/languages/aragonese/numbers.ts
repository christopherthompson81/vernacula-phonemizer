/**
 * Aragonese cardinal number → words. Emits SPACE-separated words so each element reads through the aragonese.ts
 * g2p. Covers 0 … <10¹²; larger / unsafe values read digit-by-digit.
 *
 * SOURCE for the numeral table (aragonese.jsonc `numbers`): "Los números en aragonés: cardinales", Mal de Lenguas,
 * cross-checked against omniglot.com/language/numbers/aragonese.htm. Aragonese is DECIMAL. Two family-specific
 * shapes drive this compositor:
 *   - the TWENTIES fuse into one word (vintiun, vintidós … vintinueu) while 30–90 take the ⟨y⟩ connector
 *     (trenta y un) — the Ibero-Romance split that Spanish (veintiuno / treinta y uno) also makes;
 *   - 16–19 are the analytic deci- series (decisiéis, decisiete, deciueito, decinueu), stored as plain teens.
 *
 * Pattern B (bespoke) rather than the shared `westernNumberWords`: that composer has neither a connector slot nor
 * an irregular-compound slot, so it can express neither ⟨trenta y un⟩ nor the fused twenties.
 */
import { loadManifest } from "../../core/loadManifest.ts";

interface AragoneseNumbersDef {
    numbers: {
        ones: string[];
        tens: string[];
        twenties: string[];
        hundreds: string[];
        thousand: string;
        and: string;
        scales: { value: number; one: string; many: string }[];
    };
}
// Loaded independently of aragonese.ts's own manifest read (aragonese.ts imports THIS module — reaching back for a
// shared `DEF` would be an import cycle). The manifest is a small JSONC parsed once at module init.
const N = loadManifest<AragoneseNumbersDef>(import.meta.url, "aragonese.jsonc").numbers;
const ONES = N.ones,
    TENS = N.tens,
    HUNDREDS = N.hundreds;

/** 0 ≤ n < 100. The twenties are FUSED single words; 30–90 take the ⟨y⟩ connector. */
function below100(n: number): string {
    if (n < 20) return ONES[n]!;
    const t = Math.floor(n / 10),
        u = n % 10;
    if (u === 0) return TENS[t]!;
    return t === 2 ? N.twenties[u]! : `${TENS[t]} ${N.and} ${ONES[u]}`;
}

/** 1 ≤ n < 1000. cient / docientos … + the remainder (101 → cient un). */
function below1000(n: number): string {
    if (n < 100) return below100(n);
    const h = Math.floor(n / 100),
        r = n % 100;
    return r ? `${HUNDREDS[h]} ${below100(r)}` : HUNDREDS[h]!;
}

/** 1 ≤ n < 10⁶. mil is invariable and drops its "un" (1000 → mil, 2000 → dos mil). */
function below1e6(n: number): string {
    if (n < 1000) return below1000(n);
    const th = Math.floor(n / 1000),
        r = n % 1000;
    const thousand = th === 1 ? N.thousand : `${below1000(th)} ${N.thousand}`;
    return r ? `${thousand} ${below1000(r)}` : thousand;
}

/** Non-negative integer → Aragonese words. Out-of-range / unsafe values read digit-by-digit (never empty). */
export function numberToWords(n: number, raw?: string): string {
    if (!Number.isSafeInteger(n) || n < 0 || n >= 1e12)
        return [...(raw ?? String(Math.abs(n)))].map((d) => ONES[Number(d)] ?? d).join(" ");
    if (n === 0) return ONES[0]!; // zero
    if (n < 1e6) return below1e6(n);
    for (const sc of N.scales) {
        if (n < sc.value) continue;
        const q = Math.floor(n / sc.value),
            r = n % sc.value;
        // millón is a NOUN: it keeps the "un" (un millón) and pluralises (dos millons). With only the 10⁶ scale
        // authored, 10⁹ composes as the Ibero-Romance long-scale "mil millons" (= a thousand million).
        const head = q === 1 ? sc.one : `${below1e6(q)} ${sc.many}`;
        return r ? `${head} ${numberToWords(r)}` : head;
    }
    return below1e6(n); // unreachable (n ≥ 10⁶ matched the scale)
}
