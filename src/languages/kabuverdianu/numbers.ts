/**
 * Kabuverdianu cardinal number → words (Santiago / Badiu, ALUPEC). Emits SPACE-separated words so each element
 * reads through the kabuverdianu.ts g2p. Covers 0 … <10¹²; larger / unsafe values read digit-by-digit.
 *
 * SOURCE for the numeral table (kabuverdianu.jsonc `numbers`): en.wiktionary.org
 * Category:Kabuverdianu_cardinal_numbers (the attested ALUPEC lemmas, with ⟨duzentus⟩ tagged "Badiú or
 * Santiago"), cross-checked against omniglot.com/language/numbers/kriol.htm and
 * languagesandnumbers.com/how-to-count-in-cape-verdean-creole.
 *
 * ⚠ Kabuverdianu is the SIMPLEST of the Iberian-lexified creoles here: fully decimal, and the tens JUXTAPOSE with
 *   their unit — Omniglot and languagesandnumbers both print the link as a hyphen (⟨vinti-un⟩ 21, ⟨vinti-dós⟩ 22,
 *   ⟨sunkuénti-sax⟩ 56), so there is no ⟨i⟩ connector word of the Portuguese ⟨trinta e um⟩ type. The hyphen is
 *   written as a SPACE so each element reads through the g2p as its own word (and gets its own stress, which is
 *   what the hyphenated spelling implies).
 * ⚠ 16–19 are the ANALYTIC ⟨diza-⟩ series (dizasais, dizaseti, dizaoitu, dizanovi) — Portuguese ⟨dezasseis⟩
 *   rather than Spanish ⟨dieciséis⟩ — so the 16–19 irregularity lives entirely in the `teens` data.
 *
 * Pattern B (bespoke): `westernNumberWords` needs its `hundreds` slot to be a bare round-hundred word AND keeps
 * the leading "one" for million while dropping it for thousand; Kabuverdianu wants ⟨un milion⟩ but bare ⟨mil⟩,
 * which happens to match — but it cannot express the ⟨sen⟩ vs plural-⟨-sentus⟩ hundreds series alongside the
 * juxtaposed tens without a compound slot, and keeping this as a compositor keeps 10⁹ derivable (see below).
 */
import { loadManifest } from "../../core/loadManifest.ts";

interface KabuverdianuNumbersDef {
    numbers: {
        ones: string[];
        teens: string[];
        tens: string[];
        hundreds: string[];
        thousand: string;
        million: { one: string; word: string };
    };
}
// Loaded independently of kabuverdianu.ts's own manifest read (kabuverdianu.ts imports THIS module — reaching back
// for a shared `DEF` would be an import cycle). The manifest is a small JSONC parsed once at module init.
const N = loadManifest<KabuverdianuNumbersDef>(import.meta.url, "kabuverdianu.jsonc").numbers;
const ONES = N.ones,
    TEENS = N.teens,
    TENS = N.tens,
    HUNDREDS = N.hundreds;

/** 0 ≤ n < 100. The tens JUXTAPOSE with their unit — no connector (vinti un, trinta dos, sinkuenta sais). */
function below100(n: number): string {
    if (n < 10) return ONES[n]!;
    if (n < 20) return TEENS[n - 10]!;
    const t = Math.floor(n / 10),
        u = n % 10;
    return u === 0 ? TENS[t]! : `${TENS[t]} ${ONES[u]}`;
}

/** 1 ≤ n < 1000. ⟨sen⟩ 100 vs the plural ⟨-sentus⟩ series 200–900; the remainder juxtaposes (101 → sen un).
 *  NOTE 600–900 (saisentus, setisentus, oitusentus, novisentus) are extrapolated on the attested pattern of
 *  ⟨kuátusentus⟩ 400 — Wiktionary carries only 200/300/400/500 as lemmas. Flagged as the one soft spot here. */
function below1000(n: number): string {
    if (n < 100) return below100(n);
    const h = Math.floor(n / 100),
        r = n % 100;
    return r ? `${HUNDREDS[h]} ${below100(r)}` : HUNDREDS[h]!;
}

/** 1 ≤ n < 10⁶. ⟨mil⟩ is invariable and drops its "un" (1000 → mil, 2000 → dos mil). */
function below1e6(n: number): string {
    if (n < 1000) return below1000(n);
    const th = Math.floor(n / 1000),
        r = n % 1000;
    const thousand = th === 1 ? N.thousand : `${below1000(th)} ${N.thousand}`;
    return r ? `${thousand} ${below1000(r)}` : thousand;
}

/** Non-negative integer → Kabuverdianu words. Out-of-range / unsafe values read digit-by-digit (never empty). */
export function numberToWords(n: number, raw?: string): string {
    if (!Number.isSafeInteger(n) || n < 0 || n >= 1e12)
        return [...(raw ?? String(Math.abs(n)))].map((d) => ONES[Number(d)] ?? d).join(" ");
    if (n === 0) return ONES[0]!; // zéru
    if (n < 1e6) return below1e6(n);
    const m = Math.floor(n / 1e6),
        r = n % 1e6;
    // ⟨milion⟩ is a NOUN and keeps its "un" (un milion), unlike the bare ⟨mil⟩. Authoring only 10⁶ means 10⁹
    // composes as the European-Portuguese-style "mil milion" (mil milhões) — no unattested creole billion lexeme
    // is invented.
    const head = m === 1 ? N.million.one : `${below1e6(m)} ${N.million.word}`;
    return r ? `${head} ${numberToWords(r)}` : head;
}
