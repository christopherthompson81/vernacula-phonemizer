/**
 * Occitan (Languedocien) cardinal number → words. Emits SPACE-separated words so each element reads through the
 * occitan.ts g2p (the orthographic hyphens of ⟨dètz-e-sèt⟩ / ⟨vint-e-un⟩ / ⟨dos cents⟩ become spaces). Covers
 * 0 … <10¹²; larger / unsafe values read digit-by-digit.
 *
 * SOURCE for the numeral table (occitan.jsonc `numbers`): omniglot.com/language/numbers/occitan.htm +
 * languagesandnumbers.com/how-to-count-in-occitan. Occitan is DECIMAL — setanta / ochanta / nonanta (70/80/90),
 * not the Provençal vigesimal ⟨quatre-vint⟩; the ⟨e⟩ connector is used for the TWENTIES only (vint e un) while
 * 30–90 juxtapose (trenta un) — the same split Catalan makes (vint-i-un vs trenta-un).
 *
 * Pattern B (bespoke) rather than the shared `westernNumberWords`: that composer has no connector slot and no
 * irregular-compound slot, so it cannot express the ⟨vint e …⟩ twenties.
 */
import { digitIndex } from "../../core/numbers.ts";
import { loadManifest } from "../../core/loadManifest.ts";

interface OccitanNumbersDef {
    numbers: {
        ones: string[];
        tens: string[];
        hundreds: string[];
        thousand: string;
        and: string;
        scales: { value: number; one: string; many: string }[];
    };
}
// Loaded independently of occitan.ts's own manifest read: occitan.ts imports THIS module, so reaching back for a
// shared `DEF` would be a cycle. The manifest is a ~2 KB JSONC parsed once at module init.
const N = loadManifest<OccitanNumbersDef>(import.meta.url, "occitan.jsonc").numbers;
const ONES = N.ones,
    TENS = N.tens,
    HUNDREDS = N.hundreds;

/** 0 ≤ n < 100. The twenties take the ⟨e⟩ connector (vint e un); 30–90 juxtapose (trenta un). */
function below100(n: number): string {
    if (n < 20) return ONES[n]!;
    const t = Math.floor(n / 10),
        u = n % 10;
    if (u === 0) return TENS[t]!;
    return t === 2 ? `${TENS[t]} ${N.and} ${ONES[u]}` : `${TENS[t]} ${ONES[u]}`;
}

/** 1 ≤ n < 1000. cent / dos cents … + the remainder juxtaposed (101 → cent un). */
function below1000(n: number): string {
    if (n < 100) return below100(n);
    const h = Math.floor(n / 100),
        r = n % 100;
    return r ? `${HUNDREDS[h]} ${below100(r)}` : HUNDREDS[h]!;
}

/** 1 ≤ n < 10⁶. mila is invariable and drops its "un" (1000 → mila, 2000 → dos mila). */
function below1e6(n: number): string {
    if (n < 1000) return below1000(n);
    const th = Math.floor(n / 1000),
        r = n % 1000;
    const thousand = th === 1 ? N.thousand : `${below1000(th)} ${N.thousand}`;
    return r ? `${thousand} ${below1000(r)}` : thousand;
}

/** Non-negative integer → Occitan words. Out-of-range / unsafe values read digit-by-digit (never empty). */
export function numberToWords(n: number, raw?: string): string {
    if (!Number.isSafeInteger(n) || n < 0 || n >= 1e12)
        return [...(raw ?? String(Math.abs(n)))].map((d) => ONES[digitIndex(d)] ?? d).join(" ");
    if (n === 0) return ONES[0]!; // zèro
    if (n < 1e6) return below1e6(n);
    for (const sc of N.scales) {
        if (n < sc.value) continue;
        const q = Math.floor(n / sc.value),
            r = n % sc.value;
        // milion/miliard are NOUNS: they keep the "un" (un milion) and pluralise (dos milions).
        const head = q === 1 ? sc.one : `${below1e6(q)} ${sc.many}`;
        return r ? `${head} ${numberToWords(r)}` : head;
    }
    return below1e6(n); // unreachable (n ≥ 10⁶ matched a scale)
}
