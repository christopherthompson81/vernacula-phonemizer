/**
 * Papiamentu cardinal number → words. Covers 0 … <10¹²; larger / unsafe values read digit-by-digit.
 *
 * SOURCES (papiamento.ts holds its data inline — this language has no .jsonc manifest — so the table lives here):
 *   - en.wiktionary.org Category:Papiamentu_numerals — the attested lemmas, which is where the haplologies come
 *     from: ⟨diesinku⟩ 15 and ⟨dieseis⟩ 16 (not *diessinku / *diesseis), and the fused hundreds ⟨doshen⟩ 200,
 *     ⟨treshen⟩ 300, ⟨kuatershen⟩ 400, ⟨sinkushen⟩, ⟨seishen⟩, ⟨sheteshen⟩, ⟨ochoshen⟩, ⟨nuebeshen⟩;
 *   - palabricks.nl/blog/tel-tot-honderd and /van-100-tot-1000 (Papiaments language school) for the two
 *     composition rules, plus omniglot.com/language/numbers/papiamento.htm as a cross-check.
 *
 * ⚠ TWO RULES SHAPE THIS COMPOSITOR, and both mean sub-1000 is ONE orthographic word:
 *   1. the tens ending in ⟨-a⟩ change that ⟨a⟩ to ⟨i⟩ before a unit — "trinta eindigt op de letter a. Maar bij de
 *      getallen die volgen, verandert de a in een i" — trinta → trintiun (31), kuarenta → kuarentidos (42);
 *      ⟨binti⟩ (20) already ends in -i, hence bintiun (21). The -i- IS the additive conjunction ⟨i⟩ "and", fused.
 *   2. the same ⟨i⟩ links a hundred to its remainder, surfacing as ⟨-ti-⟩: 101 shentiun, 105 shentisinku,
 *      110 shentidies, 120 shentibinti, 223 doshentibintitres — "we schrijven alle getallen tot en met
 *      negenhonderdnegenennegentig aan elkaar" (everything below 1000 is written as a single word).
 *   Writing it as one word is also what makes the g2p stress it correctly: papiamento.ts puts the accent on the
 *   final nucleus of a consonant-final word, so ⟨doshentibintitres⟩ → [doʃentibintiˈtres] with one accent, which
 *   is right; four separate tokens would each get their own.
 *
 * Pattern B (bespoke) is unavoidable here: the shared `westernNumberWords` emits one space-separated word per
 * slot, which is precisely what Papiamentu orthography forbids below 1000.
 */

// 0–9. ⟨un⟩ is the numeral (⟨unu⟩ is the pronominal variant); ⟨kuater⟩, ⟨shete⟩, ⟨nuebe⟩ are the Papiamentu forms.
const ONES = ["sero", "un", "dos", "tres", "kuater", "sinku", "seis", "shete", "ocho", "nuebe"];
// 10–19: ⟨dies⟩ + unit, fused. Note the haplologies ⟨diesinku⟩ (15) and ⟨dieseis⟩ (16) — one ⟨s⟩, per Wiktionary.
const TEENS = ["dies", "diesun", "diesdos", "diestres", "dieskuater", "diesinku", "dieseis", "dieshete", "diesocho",
    "diesnuebe"];
// 20–90 standing alone.
const TENS = ["", "", "binti", "trinta", "kuarenta", "sinkuenta", "sesenta", "setenta", "ochenta", "nobenta"];
// The COMBINING stems (final ⟨-a⟩ → ⟨-i⟩), used when a unit follows: trintiun, kuarentidos, nobentinuebe.
const TENS_COMBINING = ["", "", "binti", "trinti", "kuarenti", "sinkuenti", "sesenti", "setenti", "ochenti",
    "nobenti"];
// 100–900, fused single words (dos + shen → doshen: the ⟨s⟩ of the unit and of ⟨shen⟩ merge).
const HUNDREDS = ["", "shen", "doshen", "treshen", "kuatershen", "sinkushen", "seishen", "sheteshen", "ochoshen",
    "nuebeshen"];
const HUNDRED_LINK = "ti"; // the fused ⟨i⟩ that joins a hundred to its remainder: shen + ti + un → shentiun
const THOUSAND = "mil";
const MILLION = "mion"; // 10⁶ (Wiktionary ⟨mion⟩; ⟨miyon⟩ is the common alternative spelling)
const AND = "i"; // the free-standing additive conjunction, used across the mil/mion boundary (mil i un)

/** 0 ≤ n < 100, as ONE word: the tens stem takes its combining ⟨-i⟩ form before a unit (trinta → trintiun). */
function below100(n: number): string {
    if (n < 10) return ONES[n]!;
    if (n < 20) return TEENS[n - 10]!;
    const t = Math.floor(n / 10),
        u = n % 10;
    return u === 0 ? TENS[t]! : `${TENS_COMBINING[t]}${ONES[u]}`;
}

/** 1 ≤ n < 1000, as ONE word: the hundred joins its remainder through the fused ⟨-ti-⟩ link (shen → shentiun). */
function below1000(n: number): string {
    if (n < 100) return below100(n);
    const h = Math.floor(n / 100),
        r = n % 100;
    return r ? `${HUNDREDS[h]}${HUNDRED_LINK}${below100(r)}` : HUNDREDS[h]!;
}

/** 1 ≤ n < 10⁶. ⟨mil⟩ is invariable and drops its "un" (1000 → mil, 2000 → dos mil). */
function below1e6(n: number): string {
    if (n < 1000) return below1000(n);
    const th = Math.floor(n / 1000),
        r = n % 1000;
    const thousand = th === 1 ? THOUSAND : `${below1000(th)} ${THOUSAND}`;
    // ⟨mil⟩ ends in a consonant so the additive ⟨i⟩ cannot fuse — it stays a separate word (mil i un).
    return r ? `${thousand} ${AND} ${below1000(r)}` : thousand;
}

/** Non-negative integer → Papiamentu words. Out-of-range / unsafe values read digit-by-digit (never empty). */
export function numberToWords(n: number): string {
    if (!Number.isSafeInteger(n) || n < 0 || n >= 1e12)
        return [...String(Math.abs(n))].map((d) => ONES[Number(d)] ?? d).join(" ");
    if (n === 0) return ONES[0]!; // sero
    if (n < 1e6) return below1e6(n);
    const m = Math.floor(n / 1e6),
        r = n % 1e6;
    // ⟨mion⟩ is a NOUN and keeps its "un" (un mion). Authoring only 10⁶ means 10⁹ composes transparently as
    // "mil mion" (a thousand million) — no unattested Papiamentu billion lexeme is invented.
    const head = `${m === 1 ? ONES[1] : below1e6(m)} ${MILLION}`;
    return r ? `${head} ${AND} ${numberToWords(r)}` : head;
}
