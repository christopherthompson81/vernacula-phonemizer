/**
 * Sundanese (su) text normalization — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the pipeline speaks. Pure text→text; no IPA.
 *
 * ⚠⚠ THE CORPUS HAD TO BE FILTERED BEFORE ANY COUNT IN THIS FILE MEANT ANYTHING. su.wikipedia carries whole
 * ENGLISH articles — 12.9% of its paragraphs — and `mine.ts` selects adversarially, so those pattern-rich
 * paragraphs dominated exactly the cells a normalizer is written from. In the artifact's first hard-set,
 * `ranges` was 8/8 English, `fractions` `dotted` `signed-number` `ampersand` `scaled-currency` 7/8, and
 * `ordinal-latin` 27.2% Sundanese on the dump. Every count below is from the FILTERED corpus
 * (`tools/normalization/filter-by-language.py --lang su`, 143,263 paragraphs, ~100% Sundanese per cell), and
 * the filter changed the evidence, not just the noise: ordinal-latin 668 → 182, ampersand 1,242 → 413,
 * ranges 7,555 → 4,055. This is playbook trap 34 applied to a whole corpus rather than one probe.
 *
 * ⚠ SUNDANESE WRITES BOTH SEPARATOR CONVENTIONS, WHICH IS THE FACT THIS LAYER IS BUILT AROUND. The
 * Indonesian/European convention dominates (period groups thousands, comma marks the decimal) but the
 * English one is present in the same corpus and sometimes the same article:
 *
 *     period + exactly 3 digits   3.000        ×3,366     ← thousands, the dominant convention
 *     comma  + exactly 3 digits   3,000        ×487       ← thousands, English convention
 *     comma  + 1-2 digits         1,69         ×3,410     ← decimal, dominant  (×739 before %)
 *     period + 1-2 digits         0.01         ×16,150    ← decimal, English   (×140 before %)
 *     BOTH in one number          764,387.59   ×24        · and the euro shape 1.234,56 ×175
 *
 * So the separator ALONE cannot say which is which, and the DIGIT COUNT does: exactly three digits after a
 * separator is a grouping, one or two is a decimal.
 * ⚠ THAT LEAVES ONE SHAPE GENUINELY UNDECIDABLE AND IT IS ACCEPTED, NOT SOLVED: `1.645` is 1645 under the
 * dominant convention and 1.645 under the English one, and nothing in the surface form separates them. The
 * corpus has both — `10.000 taun` (thousands, the ×3,366 majority) and a statistics z-value `X + 1.645`
 * (a decimal) — so this layer reads all of them as thousands and is wrong on the minority. Stated because the
 * alternative is a rule that looks principled and is wrong on 3,366 instead. That is the same fact Indonesian's layer turns on, and it
 * is why de-grouping runs first — handled in that order, all four shapes above come out right, including the
 * mixed ones (`764,387.59` → 764387 koma 59; `1.234,56` → 1234 koma 56).
 *
 * ⚠ THE ENGINE'S NUMBER TOKEN IS A BARE `\d+`, and that is fine ONLY because this layer runs first. Indonesian
 * hit the same thing and fixed it in the TOKEN; here the separators are gone before tokenization, so the
 * engine needs no change. If a future edit moves de-grouping out of this file, `3.000` goes straight back to
 * reading *tilu . enol* — three, a clause pause, zero — which is what it did before this layer existed.
 *
 * ⚠ TWO SEAMS ALREADY WORKED AND ARE DELIBERATELY UNTOUCHED (playbook trap 16 — check whether the seam
 * exists): `abad ka-16` already reads *abad ka genep belas*, because ⟨ka⟩ is an ordinary Sundanese word and
 * the hyphen falls out; and `abad XIX` already reads *abad salapan belas* — that one via the SHARED roman pass
 * `getPhonemizer` wraps around every engine, not via anything here.
 * ⟨ke-N⟩ ×142 is the Indonesian spelling of the same prefix and reads acceptably as [kə]; left alone.
 */
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";

/**
 * The shared symbol tier. Sundanese has NO nominal plural, so every CountForms is a single entry.
 *
 * Every word here is sourced from the filtered corpus by whole-word count, per playbook 5e:
 *   persén ×339 (`13,6 persén`, `80 persén` — the word FOLLOWS its number, ×389 as `\d persén`)
 *   kilométer ×269 · méter ×1,163 · kilogram ×58 · héktar ×152 · séntiméter ×29
 *   dolar ×98 · rupiah ×76 · jeung ×81,551 · kali ×1,332 · per ×726 (`54 per km²`, `676 per kapita`)
 *
 * ⚠ `Rp` IS DECLARED AS A COMPOUND KEY, and `US$` ×30 / `AS$` ×19 alongside it, because the tier matches
 * longest-first and a bare `$` is letter-bounded on the left. `AS$` (Amérika Sarikat) was found by READING
 * the scan's DROP instances rather than by tabulating signs: it phonemised as *ʔas* plus a silently dropped
 * `$`, which is a drop no count of the `$` character would have attributed to it.
 */
const SYMBOLS = makeSymbolNormalizer({
    percent: ["persén"],
    currency: {
        "US$": ["dolar Amérika"], "AS$": ["dolar Amérika"], $: ["dolar"], Rp: ["rupiah"],
        "€": ["euro"], // ×10, `euro` ×13
        // ⚠ `£` ×39 IS SOURCED BY THE CORPUS GLOSSING ITSELF: `saharga ampir £26 juta (poundstérling harita)`
        // — the sign and its name in one sentence. `poundstérling` ×3.
        "£": ["poundstérling"],
        // ⚠ `¥` ×9 IS DELIBERATELY NOT DECLARED, and the reason is a false attestation caught in the act.
        // `yen` scores ×97 in this corpus — and every one is the Sundanese conjunction *yén* ("that"),
        // `ngawincik yen Sri Baduga Maharaja…`. That is the lb `Yen`-in-*Libyen* / xh `iiyeni` trap exactly:
        // a high count for a word the language uses constantly in another sense. No Sundanese name for the
        // yen appears anywhere in 143,263 paragraphs, so the sign stays unread rather than invented.
    },
    // ⚠ WITHOUT THESE, `$120 juta` READS *saratus dua puluh DOLAR JUTA* — the currency noun lands between the
    // number and its magnitude instead of after it. The tier hops the magnitude word so the noun ends up last
    // ("saratus dua puluh juta dolar"). Both spellings occur: `juta` is the commoner in this corpus, `yuta` is
    // the form the engine's own numeral manifest uses, and a magnitude that is written but not declared is
    // precisely the one that gets stranded.
    magnitudes: ["rébu", "rebu", "juta", "yuta", "milyar", "miliar", "triliun"],
    /**
     * ⚠ `mg`, `gr` AND `pm` JOIN THE TABLE, and each rests on a different strength of evidence — stated
     * rather than levelled (tools/corpus/attest/su.jsonc):
     *
     * · `mg` → *miligram*, 16 tokens / 7 articles, and su.wikipedia's own *Gram* article is a DEFINITION
     *   list that glosses every symbol in this table: *"Simbol gram nyaéta g. 1 MILIGRAM (MG) = 0,001 gram
     *   1 sentigram (sg) = 0,01 gram … 1 kilogram (kg) = 1000 gram"*. The corpus instance is a nutrient
     *   mass in Sundanese prose (`ngandung nepi ka 5 mg séng`), the same register as *"269 miligram
     *   kalium"*, *"55 miligram Vitamin C per porsi"*.
     * · `gr` is NOT A NEW WORD — it is a second SPELLING of an abbreviation whose word (`gram` ×34 / 20) is
     *   already declared under `g`. ⚠ And that is the whole of what is claimed: the *Gram* article's symbol
     *   list has `g` and not `gr`, so `gr` is the colloquial Indonesian-style spelling rather than the
     *   standard one, which is a fact about how the corpus WRITES the unit, not about the unit. Digit-bound
     *   like every key here; the artifact's single instance is `beuratna 150 gr` — a kidney's mass, and
     *   150 g is the right order of magnitude for one.
     * · `pm` → *pikométer* is THIN AND SAID TO BE THIN: 1 token / 1 article, *"kalawan panjang gelombang di
     *   antara 10 nanométer jeung 100 PIKOMÉTER"*. One hit in one article is a lead and not a finding — but
     *   the sense is exactly this one (a length in a wavelength range, beside its neighbouring SI prefix),
     *   the corpus instance is the same physics register (`0.96 Å (96 pm)`, a bond length), and the form is
     *   the transparent compound of a `-méter` series this file already ships four members of. Declared on
     *   that, in the same spirit as this file's `liwat`, whose thinness is recorded the same way.
     */
    units: {
        km: ["kilométer"], m: ["méter"], cm: ["séntiméter"], mm: ["miliméter"],
        kg: ["kilogram"], g: ["gram"], gr: ["gram"], mg: ["miligram"], pm: ["pikométer"],
        ha: ["héktar"], l: ["liter"],
    },
    /**
     * ⚠ `h` JOINS THE WORD KEYS, AND WITHOUT IT A RATE LOST ITS DENOMINATOR SILENTLY. `160 km/h (100 mph)`
     * read *sarátus genep puluh kilométer **h*** — the tier resolved the head unit, failed to resolve the
     * one-letter denominator against a table keyed only on the Sundanese WORDS, and re-emitted the letter.
     * ⚠ **NO LEAK GATE IN THIS REPO COULD SEE THAT**, and that is why it survived a mature layer: `h` is ONE
     * letter, and `rawLatinIn` requires a run of two or more. It was found by READING the line a `mph` hit
     * pointed at. No new word — `jam` is the same noun the `km/jam` spelling already resolves to, ×186 in
     * the corpus's own clock rule.
     */
    rateDenominators: { jam: "jam", detik: "detik", h: "jam", s: "detik" },
    unitPer: "per",
    exponentWords: { squared: ["pasagi"], cubed: ["kubik"] },
    // ⚠ THE BARE EXPONENT IS DECLARED ON A NARROW MARGIN, AND THE COST IS NAMED. Counted on the filtered
    // corpus: 23 digit-base powers (`10⁵`, `10⁶`) and 15 `σ²` are FIXED by it; 15 `I²C` — a bus name, not a
    // power — become *I pangkat dua C*. That is a wrong reading replacing a different wrong reading (`I²C`
    // already read *ʔi t͡ʃ*, the ² dropped and the letters spelled), so the trade is 38 repairs against 15
    // unchanged-in-kind, not against 15 regressions. Words sourced: `pasagi` ×310 (the SHAPE, "diagonal tina
    // hiji pasagi"), `kubik` ×30, `pangkat` ×131 — the last in its MATH sense, "kuadrat, pangkat tilu,
    // pangkat opat jeung saterusna", which is the enumeration that settles it against the commoner "rank".
    // ⚠ THESE ARE TEMPLATES, NOT WORDS — `{n}` is the base and `{e}` the exponent. Declared as bare words
    // they silently DISCARD the base: `10⁵` read as *pangkat*, the ten gone entirely, which is worse than the
    // dropped superscript it was meant to repair.
    bareExponent: { squared: "{n} pasagi", cubed: "{n} kubik", power: "{n} pangkat {e}", negative: "kurang" },
    ampersand: "jeung",
    multiply: { times: "kali" },
});

/** Unit abbreviation → its Sundanese noun, for the two RATE shapes the shared tier cannot reach (a unit after
 *  the word `per`, and a slash rate whose numerator is a word). Same spellings as the tier's own `units`. */
const UNIT_WORD: Readonly<Record<string, string>> = {
    km: "kilométer", m: "méter", cm: "séntiméter", mm: "miliméter",
    kg: "kilogram", g: "gram", ha: "héktar", l: "liter", c: "c",
};
const EXP_WORD: Readonly<Record<string, string>> = { "": "", "²": " pasagi", "³": " kubik" };

/** Compass points for the COORDINATE sense of `°`, keyed lowercase because the rule matches case-insensitively. */
const COMPASS: Readonly<Record<string, string>> = {
    n: "kalér", s: "kidul", e: "wétan", w: "kulon",
};

/** Every rule emits DIGITS where a number is involved and lets the engine's own number path speak them, which
 *  keeps the numerals out of this layer entirely. */
export function normalizeSundanese(input: string): string {
    let s = input;

    // ── 0. LaTeX MATH DELIMITERS — before ANY rule reads `$` as money ──────────────────────────────────
    // ×7, and every one is confidently wrong rather than merely dropped: `($10^7$ nepi ka …)` read as
    // *sapuluh DOLAR*, the math delimiter spent as a currency sign.
    //
    // ⚠ THE PATTERN IS KEYED ON SUPERSCRIPTS, NOT ON THE CARET, AND THAT IS NOT A STYLE CHOICE. `getPhonemizer`
    // wraps every engine in SHARED pre-passes (core/unicode.ts, core/roman.ts, core/markup.ts) that run BEFORE
    // this layer, and one of them folds caret exponents to real superscripts — so by the time the text arrives
    // here, `$10^{12}$` is already `$10¹²$` and no rule matching `^` or `{` can ever fire.
    // ⚠ I WROTE THAT RULE FIRST AND IT PASSED, because a direct call to this function bypasses those shared
    // passes: `normalizeSundanese("$10^{12}$")` returned the right answer while the ENGINE returned
    // *sapuluh dolar*. A layer tested in isolation is not the layer that ships. Probe through `phonemize`.
    // (The same wrapper is why `abad XIX` already reads *abad salapan belas* — that is core/roman.ts, not
    // anything in this engine.)
    // ⚠ AND THE SUPERSCRIPT CLASS IS SPELLED OUT, NOT WRITTEN AS `[⁰-⁹]`. That range is U+2070–U+2079 and
    // does NOT contain ¹ ² ³ (U+00B9/B2/B3, in Latin-1 Supplement), which are the three commonest powers —
    // so the range form silently failed on `$10¹²$`, the very instance it was written for.
    s = s.replace(/\$([^$]*[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻]+[^$]*)\$/gu, "$1");

    // ── 1. DE-GROUP THOUSANDS — FIRST, and the single most destructive defect this layer repairs ──────
    // The tokenizer splits on `\d+` and `.`/`,` are both clause punctuation, so a grouping separator became a
    // PAUSE and the value was destroyed: `3.000 taun` read *tilu . enol taun* — "three, zero years" for 3000.
    // ×3,366 (period) + ×487 (comma).
    // ⚠ EXACTLY THREE DIGITS PER GROUP, REPEATED, IS THE WHOLE DISAMBIGUATION. `20.7` (one digit) and `1,69`
    // (two) are decimals and must not be touched; `1.234,56` and `764,387.59` are handled because each
    // separator is judged by its own group size rather than by the number as a whole.
    // ⚠ THE TRAILING GUARD IS `(?!\d)`, NOT `(?![\d.,])`, AND THAT ONE CHARACTER IS THE MIXED-CONVENTION
    // CASE. Excluding a following separator looks safer and silently broke exactly the numbers that need this
    // most: in `764.387,59` the period-group is FOLLOWED by the decimal comma, so the guard rejected it and
    // the `.` went back to being a clause pause — *tujuh ratus genep puluh opat . tilu ratus…*. Rejecting only
    // a following DIGIT is right, because a further `.\d{3}` is already consumed by the `+`.
    s = s.replace(/(?<![\d.,])(\d{1,3}(?:\.\d{3})+)(?!\d)/gu, (m) => m.replaceAll(".", ""));
    s = s.replace(/(?<![\d.,])(\d{1,3}(?:,\d{3})+)(?!\d)/gu, (m) => m.replaceAll(",", ""));
    // ⚠ AND THE SPACE-GROUPED FORM, ×24 (`62 262`, `5 165`, `1 000`). Flagged by `review.ts`'s own probe
    // rather than by the corpus tabulation, which counted only the two punctuation separators. The head is
    // capped at three digits and the lookbehind rejects a preceding digit, so an adjacent PAIR of numbers
    // ("taun 1990 2000") cannot be fused — a four-digit year can never be the head of a group.
    // ⚠ AND ITS TRAILING GUARD IS `(?!\d)` TOO, for the reason spelled out three lines above — which this arm
    // did not follow. `(?![\d.,])` rejected every clause-final grouped figure: `50 000.` came back untouched
    // and read *lˈima pˈuluh ʔənˈol .* — "fifty, zero" — losing the thousand word at exactly a sentence end.
    // Reported by `review.ts`'s `clause-final` check. A decimal tail is safe either way: `1 234.56` de-groups
    // to `1234.56` and the decimal rule reads it whole.
    s = s.replace(/(?<![\d.,])(\d{1,3}(?:[ \u00a0\u202f\u2009]\d{3})+)(?!\d)/gu, (m) => m.replace(/[ \u00a0\u202f\u2009]/gu, ""));  // space, NBSP, NNBSP, thin space

    // ── 2. CLOCK — BEFORE the decimal rule, which would otherwise claim `7.30` as seven-point-three ──────
    // The corpus writes the hour with `jam` ×186, `tabuh` and `pukul`, and both separators (`jam 05.00`,
    // `tabuh 11:10`, `jam 4:15`). ⚠ THE MINUTES ARE `.00` IN 108 OF 186 CASES, so the on-the-hour arm carries
    // most of the traffic and simply drops the zeros — "jam lima", which is how the hour is said.
    // ⚠ `liwat` ("past") for the off-the-hour case is attested ×784 as a word but only ONCE in this
    // construction (`jam 10 liwat 10`). Shipped on that plus the sister-language pattern (Indonesian `lewat`,
    // the same construction), and the thinness is stated rather than hidden — if it is wrong, it is wrong on
    // 78 instances, and the alternative was leaving a clause pause in the middle of every clock.
    s = s.replace(
        /(?<![\d.:])\b(jam|tabuh|pukul)\s?([01]?\d|2[0-3])[.:]([0-5]\d)\b(?!\.?\d)/giu,
        (_m, w: string, h: string, min: string) =>
            Number(min) === 0 ? `${w} ${Number(h)}` : `${w} ${Number(h)} liwat ${Number(min)}`,
    );
    // A BARE `H:MM` with no hour word — the colon is clause punctuation, so it read as a pause mid-time.
    // Kept narrow: a colon only, never the period, because a bare `7.30` with no `jam` is a decimal.
    s = s.replace(/(?<![\d.:])([01]?\d|2[0-3]):([0-5]\d)\b(?!\.?\d)/gu,
        (_m, h: string, min: string) => (Number(min) === 0 ? `jam ${Number(h)}` : `jam ${Number(h)} liwat ${Number(min)}`));

    // ── 3. UNIT AFTER THE WORD `per` ────────────────────────────────────────────────────────────────────
    // ×40 (`54 per km²`, `27 per km²`, `jiwa/km²`). The shared tier matches a unit only when a NUMBER is
    // adjacent, and in a rate written with the WORD there is none — so the abbreviation leaked raw into the
    // IPA as *pər km*. Handled here rather than by widening the tier, because "a unit may follow `per`" is a
    // fact about this language's rate idiom, not about units in general.
    // ⚠ BEFORE the tier, and that ordering is load-bearing: with `bareExponent` declared, the tier reads the
    // `km` of `km²` as a 1-3 letter EXPONENT BASE and rewrites the whole thing to *kilométer pasagi*'s
    // skeleton without the unit — `54 per km²` came out *lima puluh opat pər pasagi*, the unit deleted.
    // ⚠ AND THE SLASH FORM TOO, WHEN THE NUMERATOR IS A WORD — `jiwa/km²` ×27 (population density), `L/m²`,
    // `MeV/c²`. The tier's `unitPer` composes a rate only when a NUMBER leads, so these leaked the bare `km`
    // into the IPA: *d͡ʒiwa km pasagi*. Restricted to a LETTER before the slash so a numeric `3/4` stays a
    // fraction for step 8 and `km/jam` stays the tier's.
    s = s.replace(/(?<=[\p{L}\p{M}])\/(km|m|cm|mm|kg|g|ha|l|c)(²|³)?(?![\p{L}\p{M}\d])/giu,
        (_m, u: string, exp: string | undefined) => ` per ${UNIT_WORD[u.toLowerCase()] ?? u}${EXP_WORD[exp ?? ""] ?? ""}`);
    s = s.replace(/\bper\s+(km|m|cm|mm|kg|g|ha|l)(²|³)?(?![\p{L}\p{M}\d])/giu,
        (_m, u: string, exp: string | undefined) => `per ${UNIT_WORD[u.toLowerCase()]!}${EXP_WORD[exp ?? ""] ?? ""}`);

    // ── 4. THE SHARED TIER — percent, currency, units, rates, exponents, `&`, `×` ──────────────────────
    // ⚠ BEFORE THE DECIMAL RULE, WHICH IS THE COUPLING THE PLAYBOOK NAMES ("units before decimals"): the tier
    // matches a unit or a currency sign only when a NUMBER is adjacent, and rewriting `13,1` to `13 koma 1`
    // destroys that adjacency. Run the other way round, `Rp 13,1` came out *tilu belas RUPIAH koma hiji* —
    // the noun wedged between the integer and its own fraction. Found by reading the scan's DROP instances,
    // not by any probe. AFTER de-grouping, though, or the tier sees `3.000 km` as `000 km`.
    s = SYMBOLS(s);

    // ── 5. DECIMALS → `koma` ────────────────────────────────────────────────────────────────────────────
    // ×3,410 comma + ×16,150 period, and both read as a clause pause before this rule: `1,69%` was
    // *hiji , genep puluh salapan* with the percent dropped as well.
    // ⚠ THE WORD IS SOURCED WITH ITS SENSE, WHICH MATTERED HERE. `koma` appears only ×37 and MOST of those
    // are the medical coma or a comet's coma — the Fula `tere` shape exactly. One instance settles it and
    // does so definitionally: *"jumlah angka di tukangeun koma (decimal places)"* — "the count of digits
    // after the KOMA", glossed in English by the article itself. A written corpus is the weakest evidence
    // about how a SYMBOL is spoken (playbook), so a definitional citation outranks the raw count.
    // Read digit-by-digit after the separator, which is the Austronesian convention Indonesian also takes.
    s = s.replace(/(\d)[.,](\d{1,2})(?![\d.,])/gu, (_m, a: string, b: string) => `${a} koma ${[...b].join(" ")}`);

    // ── 6. ERA MARKERS ──────────────────────────────────────────────────────────────────────────────────
    // ⚠ SM BEFORE M, always: `M` matches inside `SM` and would leave a stranded S. ×868 SM, ×417 `\d M`.
    // Sourced: `saméméh Maséhi` ×149 (the full phrase), `Maséhi` ×520.
    // ⚠ THE OPERAND MAY CARRY THE DECADE SUFFIX `-an`, and without it 124 of the 859 `SM` were missed:
    // `170-an SM` ("the 170s BC") left the letters unread as *sm*. The corpus diff is what showed this — the
    // probe `100 SM` passed all along, because the suffix only appears in running text.
    s = s.replace(/(\d+(?:-an)?)\s*SM\b(?![\p{L}\p{M}])/gu, "$1 saméméh Maséhi");
    s = s.replace(/(\d+(?:-an)?)\s*M\b(?![\p{L}\p{M}.])/gu, "$1 Maséhi");

    // ── 7. RANGES → `nepi ka` ("up to") ─────────────────────────────────────────────────────────────────
    // ×4,055, overwhelmingly year spans — `(1350-1357)`, `(669-1579 M)`, `(1482–1521)`. The hyphen was
    // DROPPED, so the two numbers ran together with no connective at all. `nepi ka` ×8,200 is the corpus's
    // own phrase and appears in exactly this sense (`nepi ka 1 méi 2004`).
    // ⚠ AFTER the era rule, so `669-1579 M` has already become `669-1579 Maséhi` and the range arm does not
    // have to know about era letters; and after de-grouping, so `1.000-2.000` is already bare digits.
    // ⚠ TWO GUARDS, BOTH FOUND BY THE CORPUS DIFF AND NEITHER VISIBLE IN A PROBE (playbook trap 3).
    // 1. DO NOT DOUBLE A CONNECTIVE THE TEXT ALREADY WROTE. ×263 of these ranges are already introduced by
    //    `nepi ka` / `ti` / `antara`, and the rule turned `nepi ka 8–20 méter` into *nepi ka dalapan NEPI KA
    //    dua puluh méter*. The lookbehind is spelled out because these are words, not a character class.
    // 2. A HYPHEN CHAIN IS AN IDENTIFIER, NOT A RANGE. ×68 `N-N-N` — CAS registry numbers (`50-21-5`),
    //    ISBNs (`0-07-115221`) — and the rule read the first two operands as a span while the third became a
    //    clause pause. Trailing `-` is rejected, and the leading guard already rejects a preceding digit.
    // ⚠ AND THE TRAILING GUARD DOES NOT REJECT A `.`, WHICH IS THE SAME `(?!\d)`-NOT-`(?![\d.,])` FINDING THE
    // DE-GROUPING ARMS RECORD 80 LINES ABOVE — this arm was the one that had not followed its own file. A
    // sentence period is not part of a number, so `(?![\d.,-])` declined every range that ENDS A CLAUSE:
    // `Mangsa Taun 1270-1910.` came back as two juxtaposed cardinals with no connective at all, exactly the
    // reading step 7 exists to repair, and `1884–1894.` / `1808-1811.` with it. Reported by `review.ts`'s
    // `clause-final` check, the same check that caught the space-grouping arm. Nor is the dot protecting an
    // ordinal: a fleet-wide comparison of the numeral WORD for `5` against `5.` across the 47 languages whose
    // range rule declined a clause-final dot found ZERO ordinal readings.
    // ⚠ THE `,` STAYS, and unlike the de-grouping arms that is on this language's own evidence. Sundanese
    // writes the DECIMAL COMMA (`40,9 °C` ×many, and step 12 reads it), so a following comma is what declines
    // a decimal right operand. Measured: dropping it as well gains 4 more segments, every one a clause comma
    // after a year span, and admits `N-N,N` into a comma-decimal corpus for it.
    s = s.replace(
        /(?<!\b(?:nepi ka|tepi ka|dugi ka|ti|antara)\s)(?<![\d.,\p{L}-])(\d+)\s?[-–]\s?(\d+)(?![\d,-])/gu,
        "$1 nepi ka $2",
    );

    // ── 8. FRACTIONS ────────────────────────────────────────────────────────────────────────────────────
    // ×727. `1/2` read as *hiji dua* — the slash dropped, two bare numbers. `satengah` ("half") ×many is the
    // idiomatic reading of the one that matters; everything else is "numerator per denominator", using the
    // same `per` ×726 the rate rule takes.
    s = s.replace(/(?<![\d/])(\d{1,3})\/(\d{1,3})(?![\d/])/gu, (_m, a: string, b: string) =>
        Number(a) === 1 && Number(b) === 2 ? "satengah" : `${a} per ${b}`);

    // ── 9. DEGREES ──────────────────────────────────────────────────────────────────────────────────────
    // `°` ×707 was dropped outright and `°C` ×247 additionally read the C as Sundanese ⟨c⟩ = [t͡ʃ]:
    // `40,9 °C` came out *opat puluh , salapan t͡ʃ*. `darajat` ×182.
    // Scale letters first, then compass, then the bare sign — the specific before the general.
    // ⚠ THE GUARD IS `(?![\\p{L}\\p{M}])`, NOT `\\b`. JS defines `\\b` on ASCII `\\w`, so a following
    // NON-ASCII letter counts as a boundary and this rule fired when it must not: `25°Cölner` ate the ⟨C⟩
    // as Celsius and left "ölner" behind. Invisible to any ASCII fixture, and this language's own
    // orthography is what supplies the accented letter. 71 other engines already guard it this way.
    s = s.replace(/(\d)\s?°\s?C(?![\p{L}\p{M}])/giu, "$1 darajat Celsius");
    s = s.replace(/(\d)\s?°\s?F(?![\p{L}\p{M}])/giu, "$1 darajat Fahrenheit");
    s = s.replace(/(\d)\s?°\s?([NSEW])(?![\p{L}\p{M}])/giu,
        (_m, d: string, dir: string) => `${d} darajat ${COMPASS[dir.toLowerCase()]!}`);
    s = s.replace(/(\d)\s?°/gu, "$1 darajat");

    // ── 10. SIGNS ────────────────────────────────────────────────────────────────────────────────────────
    // All sourced from the filtered corpus as whole words: `sarua jeung` ×985, `leuwih gedé ti` ×36,
    // `leuwih leutik ti` ×44, `dibagi` ×810, `kurang` ×1,889, `tambah` ×43.
    // ⚠ `leuwih ti` ×1,295 is COMMONER but means "more than" (a quantity), not "greater than" (a magnitude
    // comparison), which is what the sign denotes — the same distinction Indonesian's layer records for
    // `lebih besar dari`. The explicit pair is the one the notation means.
    // ⚠ `±` IS ONE CHARACTER (U+00B1) and no `+` rule can match inside it — it needs its own arm or the sign
    // is dropped in silence. ×155, and in this corpus it usually means "approximately" (`saluas + 1,8 yuta`).
    s = s.replace(/±/gu, " tambah kurang ");
    // ⚠ THE OPERAND MAY BE PARENTHESISED, which cost the sign its only hard instance: `5 + (−3) = 2` read as
    // *lima KURANG tilu* — the `+` dropped and the bracketed minus left to stand in for it, so the expression
    // silently became a subtraction. Both arms accept `(` before the digit.
    s = s.replace(/(\S)\+\s?(\(?\s?[-−]?\d)/gu, "$1 tambah $2");
    s = s.replace(/(^|\s)\+\s?(\(?\s?[-−]?\d)/gu, "$1tambah $2");
    // ⚠ MINUS AFTER PLUS, and the order is forced by the bracketed operand: run first, the minus arm turns
    // `5 + (−3)` into `5 + (kurang 3)`, after which the plus arm no longer sees a digit past its `(` and the
    // `+` is dropped — the expression silently becomes a subtraction.
    s = s.replace(/(^|[\s(])[-−–](\d)/gu, "$1kurang $2");
    s = s.replace(/\s?=\s?/gu, " sarua jeung ");
    s = s.replace(/\s?<\s?/gu, " leuwih leutik ti ");
    s = s.replace(/\s?>\s?/gu, " leuwih gedé ti ");
    s = s.replace(/\s?÷\s?/gu, " dibagi ");

    return s;
}
