/**
 * Somali (so) text normalization — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the pipeline speaks. Pure text→text; no IPA.
 *
 * Counts are from the LANGUAGE-FILTERED so.wikipedia dump (`tools/normalization/filter-by-language.py
 * --lang so`, 70,854 paragraphs). ⚠ The filter matters less here than it did for Sundanese — so.wikipedia is
 * 88.5% Somali against su's 75.9% — but it is still applied, because the cheap check is worth more than the
 * assumption and the artifact records it.
 *
 * ⚠ SOMALI WRITES THE ENGLISH CONVENTION, DECISIVELY, and that is the opposite of its Austronesian
 * neighbours in this repo:
 *
 *     comma  + exactly 3 digits   2,381,741   ×3,598     ← thousands
 *     period + exactly 3 digits   2.381       ×190
 *     period + 1-2 digits         0.53        ×3,082     ← decimal
 *     comma  + 1-2 digits         0,53        ×84
 *
 * 19:1 and 37:1. Both separators were CLAUSE PUNCTUATION, so a grouped number came apart into three spoken
 * clauses — `2,381,741` read *laba , saddex boqol iyo kow iyo siddeetan , todoba boqol…*.
 *
 * ⚠ THE BIGGEST SINGLE CLASS IN THE CORPUS IS ALREADY CORRECT AND IS DELIBERATELY UNTOUCHED (playbook trap
 * 16 — check whether the seam exists). Somali attaches bound morphology to a numeral with a hyphen, ×7,498:
 *
 *     -kii ×3,023 · -aad ×1,436 · -meeyadii ×800 · -dii ×547 · -ka ×440 · -tii ×230
 *
 * `2010-kii` already reads *laba kun iyo toban kii* — the engine's TOKEN splits on the hyphen and both halves
 * are ordinary Somali. A rule here would have to re-join them and would gain nothing. Same for `1aad` →
 * *kow aad*, the ordinal.
 *
 * ⚠ AND SOMALI ⟨c⟩ IS /ʕ/, WHICH IS WHY THE LATIN ABBREVIATIONS ARE NOT MERELY UNREAD BUT AUDIBLY WRONG.
 * `CE` read as *ʕe*, `BC` as *bʕ*, `°C` as *ʕ* — the g2p is correct to do that, since ⟨c⟩ is a real Somali
 * consonant; it is the abbreviations that have to be spent before they reach it.
 */
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";

/**
 * The shared symbol tier. Somali marks number on the noun but the measure words below are used in their
 * citation form after a numeral throughout the corpus, so each CountForms is a single entry.
 *
 * Sourced by whole-word count on the filtered corpus (playbook 5e):
 *   boqolkiiba ×499 · kiiloomitir ×403 · mitir ×780 · hektar ×134 · doolar ×102 · shilin ×78 ·
 *   iyo ×76,283 · laba jibaaran ×123 (the SQUARE, literally "two multiplied": `kiiloomitir laba jibaaran`)
 *
 * ⚠ `%` FOLLOWS ITS NUMBER, on a split the corpus itself makes: `N boqolkiiba` ×251 against `boqolkiiba N`
 * ×163. Both orders are real Somali; the tier's default (suffix) is the commoner one.
 * ⚠ NO `kg`: the abbreviation occurs ×51 and no Somali word for it is attested — `kiilo` ×143 outside
 * `kiiloomitir` is the loose "kilo", never a declared unit, and `kiilogaram` is absent. Left unread rather
 * than invented, and it is the one unit slot this corpus cannot fill.
 */
const SYMBOLS = makeSymbolNormalizer({
    percent: ["boqolkiiba"],
    currency: { $: ["doolar"], "US$": ["doolar Maraykanka"], "€": ["yuuro"], "Sh.So.": ["shilin Soomaali"] },
    // milyan ×1,506 · bilyan ×519 · malyan ×36 · tirilyan ×2 · kun ×1,355. ⚠ `balyan` was in this list and
    // scores ZERO — dropped. A magnitude that is not written cannot strand a currency noun.
    magnitudes: ["kun", "malyan", "milyan", "bilyan", "tirilyan"],
    units: { km: ["kiiloomitir"], m: ["mitir"], cm: ["sentimitir"], mm: ["milimitir"], ha: ["hektar"], mi: ["mayl"] },
    // ⚠ `cubo` FOR THE CUBE, NOT `saddex jibaaran`. The parallel form to `laba jibaaran` is what the pattern
    // suggests and it scores ZERO in 70,854 paragraphs; `cubo` ×4 is what the corpus actually writes, and it
    // writes it in exactly this frame — `11.548 Sentimitir cubo cm³`. Caught by auditing every declared word
    // against the corpus rather than trusting the symmetry.
    exponentWords: { squared: ["laba jibaaran"], cubed: ["cubo"] },
    unitPer: "halkii",
    rateDenominators: { s: "ilbiriqsi", h: "saacad" },
    ampersand: "iyo",
    multiply: { times: "ku dhufan" },
});

/** Compass points for the COORDINATE sense of `°`, keyed lowercase because the rule matches case-insensitively. */
const COMPASS: Readonly<Record<string, string>> = {
    n: "waqooyi", s: "koonfur", e: "bari", w: "galbeed",
};

/** Every rule emits DIGITS where a number is involved and lets the engine's own number path speak them. */
export function normalizeSomali(input: string): string {
    let s = input;

    // ── 1. DE-GROUP THOUSANDS — FIRST, and the most destructive defect this layer repairs ───────────────
    // ×3,598 comma + ×190 period. `.`/`,` are both clause punctuation and the TOKEN splits on `\d+`, so a
    // grouping separator became a PAUSE and the value came apart: `2,381,741 kiiloomitir` was spoken as three
    // clauses. ⚠ EXACTLY THREE DIGITS PER GROUP, REPEATED, is the disambiguation — `0.53` (two) and `2.5`
    // (one) are decimals and must survive untouched. The trailing guard rejects only a following DIGIT, so a
    // group followed by the decimal separator (`1,234.56`, ×49) still de-groups.
    s = s.replace(/(?<![\d.,])(\d{1,3}(?:,\d{3})+)(?!\d)/gu, (m) => m.replaceAll(",", ""));
    s = s.replace(/(?<![\d.,])(\d{1,3}(?:\.\d{3})+)(?!\d)/gu, (m) => m.replaceAll(".", ""));

    // ── 2. THE GLUED CALENDAR LETTERS — BEFORE the tier, which would otherwise strand the `M` ──────────
    // ⚠ ORDER IS LOAD-BEARING HERE AND THE PROBE FOUND IT: with this after the shared tier, `$2M` had its
    // `$2` claimed as currency first, leaving an orphan `M` to glue onto the noun — *laba doolarM*. Spent
    // here, the tier sees `$2 milyan` and hops the magnitude correctly.
    // ⚠ THE GLUED CALENDAR LETTERS, ×567 + ×25, and they are the largest era class in the language — bigger
    // than every spaced marker combined. A Hijri year is written `728H`, `1332H`, and (×305) as a TWO-DIGIT
    // early-Islamic year, `sanadkii 18H`, `bishii Safar 12H`. All of them read as a stray letter h.
    s = s.replace(/(?<![\p{L}\p{M}])(\d+)H(?![\p{L}\p{M}])/gu, "$1 Hijri");
    // ⚠ `M` IS SPLIT BY DIGIT COUNT AND THAT SPLIT IS LOAD-BEARING: three or four digits is the MIILAADI year
    // (`1999M`, `766M`, ×25), one or two is MILLION (`$2M`, `8M oo higtar`, `1M oo ay beeraty`, ×21). Reading
    // the short form as an era would date a sum of money to the year 2; reading the long form as a magnitude
    // would make the year 1999 into 1,999 million. Counted before either rule was written.
    s = s.replace(/(?<![\p{L}\p{M}])(\d+)M(?![\p{L}\p{M}])/gu,
        (_m, n: string) => (n.length >= 3 ? `${n} Miilaadi` : `${n} milyan`));

    // ── 3. CLOCK — BEFORE the decimal rule, which would otherwise claim `2:00` and `8:15` ───────────────
    // ×288 (`9:00 Subaxnimo`, `8:15 PM`, `12:25`). The colon is clause punctuation, so the time read as two
    // numbers with a pause between them. `saacaddu waa` ("the hour is") is the corpus's frame; the minutes
    // are joined with `iyo` ("and"), which is how Somali builds every compound numeral and needs no separate
    // sourcing — it is the same ×76,283 conjunction the ampersand rule spends.
    // ⚠ ON THE HOUR THE MINUTES DROP OUT, as in every language treated so far.
    s = s.replace(/(?<![\d.:])([01]?\d|2[0-3]):([0-5]\d)\b(?!\.?\d)/gu,
        (_m, h: string, min: string) => (Number(min) === 0 ? `${Number(h)}` : `${Number(h)} iyo ${Number(min)}`));

    // ── 4. THE SHARED TIER — percent, currency, units, rates, exponents, `&`, `×` ───────────────────────
    // ⚠ BEFORE THE DECIMAL RULE ("units before decimals", the playbook's own coupling): the tier matches a
    // unit or a sign only when a NUMBER is adjacent, and rewriting `84.3` to `84 dhibic 3` destroys that
    // adjacency — `84.3 boqolkiiba` would put the percent word after the fraction instead of after the
    // number. AFTER de-grouping, or the tier sees `2,381,741 km` as `741 km`.
    s = SYMBOLS(s);

    // ── 5. DECIMALS → `dhibic` ─────────────────────────────────────────────────────────────────────────
    // ×3,082 period + ×84 comma, every one previously a clause pause mid-number.
    //
    // ⚠⚠ THE WORD IS AN INFERENCE FROM SENSE, NOT AN ATTESTATION OF THE READING, and it is labelled as one.
    // `dhibic` occurs ×40 in the corpus and ×21 across 20 Wikipedia articles (attest.ts), and EVERY instance
    // is the word meaning POINT/DOT in some other sense — the northernmost point of Africa, the freezing
    // point, a deep point cut into rock. Not one is a decimal separator. Nothing else is closer: `nuqte` and
    // `meeldhibic` are absent outright, `faaruq` means "empty", and the ×46 `point` hits are English text
    // inside the Somali wiki. espeak ships no Somali dictionary at all and the kaikki referee is 233 words.
    //
    // It ships anyway, for the reason the Wu, Jin, Xiang, Madurese and Lingala layers ship theirs: **a
    // written corpus is the weakest evidence there is about how a SYMBOL is spoken** — writers type `0.53`
    // and never spell out how they would say it, so the word can be in universal spoken use and score zero
    // (the Igbo `ǹtụ̀kpọ` lesson, playbook §"corpus silence is not a refusal"). What IS established is that
    // `dhibic` is the Somali word for a point or dot. The alternative is 3,082 decimals read with a clause
    // break where the point was.
    // ⚠ The fractional part is read DIGIT BY DIGIT, which is what a decimal is; the integer part keeps the
    // engine's ordinary cardinal composition.
    s = s.replace(/(\d)[.,](\d{1,2})(?![\d.,])/gu, (_m, a: string, b: string) => `${a} dhibic ${[...b].join(" ")}`);

    // ── 6. ERA MARKERS ─────────────────────────────────────────────────────────────────────────────────
    // ⚠ `C.H.` IS SOMALI'S OWN AND THE CORPUS GLOSSES IT: `1391 ilaa 1271 C.H (Ciise Hortiis)` — "before
    // Christ", spelled out in the same sentence. ×121, and it read as *ʕ . h .*: two letters and two clause
    // pauses. The Latin era letters ×454 are the borrowed set, and they are worse than unread because ⟨c⟩ is
    // /ʕ/ — `BC` was *bʕ*. `Miilaadi` ×47 is the corpus's word for the Christian era, `Hijri` ×61 for the
    // Islamic one.
    // ⚠ LONGEST FIRST, and BCE before BC or the `E` is stranded.
    s = s.replace(/(\d)\s*C\.?\s?H\.?(?![\p{L}\p{M}])/gu, "$1 Ciise Hortiis");
    // ⚠ AND ITS COUNTERPART `C.D` ×213 — "Ciise Dabadiis", after Christ — which the first draft missed
    // entirely because the probe list was built from `C.H.` and never asked what the OTHER direction was.
    // Glossed in the corpus the same way (`Ciise Dabadiis` ×2) and written both spaced and glued
    // (`70 C.D. Rooma`, `900 – 1870 CD`). ⚠ THE LEADING DIGIT IS WHAT KEEPS IT OFF `CD-yada iyo Internetka`
    // — compact discs, in the same corpus.
    s = s.replace(/(\d)\s*C\.?\s?D\.?(?![\p{L}\p{M}])/gu, "$1 Ciise Dabadiis");
    s = s.replace(/(\d)\s*(?:BCE|BC)(?![\p{L}\p{M}])/gu, "$1 Ciise Hortiis");
    s = s.replace(/(\d)\s*(?:CE|AD)(?![\p{L}\p{M}])/gu, "$1 Miilaadi");
    s = s.replace(/(\d)\s*AH(?![\p{L}\p{M}])/gu, "$1 Hijri");
    // ── 7. RANGES → `ilaa` ("up to") ───────────────────────────────────────────────────────────────────
    // ×2,690, and `ilaa` is one of the commonest words in the language (×11,059) in exactly this sense
    // (`1391 ilaa 1271`, `27 ilaa 39 boqolkiiba`). The hyphen was dropped, leaving two numbers abutting.
    // ⚠ THE TWO GUARDS THE SUNDANESE RUN PAID FOR, carried over rather than re-earned: do not double a
    // connective the text already wrote (`ilaa`/`inta u dhaxaysay`), and do not claim a HYPHEN CHAIN, which
    // is an identifier rather than a span. ⚠ AND A THIRD, SPECIFIC TO SOMALI AND THE REASON THIS RULE IS
    // ORDERED HERE: the bound-suffix form `2010-kii` is a hyphen between a number and a WORD, so the
    // digits-both-sides requirement is what keeps this rule off the language's single commonest pattern.
    s = s.replace(
        /(?<!\b(?:ilaa|dhaxaysay|inta)\s)(?<![\d.,\p{L}-])(\d+)\s?[-–]\s?(\d+)(?![\d.,-])/gu,
        "$1 ilaa $2",
    );

    // ── 8. FRACTIONS ───────────────────────────────────────────────────────────────────────────────────
    // ×235. `1/2` read as *kow laba* — the slash dropped, two bare numbers. `nus` ("half") ×149 and `rubuc`
    // ("quarter") ×74 are the corpus's own words for the two that have one; everything else composes with
    // `meelood` ("parts"), the ordinary Somali fraction frame.
    s = s.replace(/(?<![\d/])(\d{1,3})\/(\d{1,3})(?![\d/])/gu, (_m, a: string, b: string) => {
        const [n, d] = [Number(a), Number(b)];
        if (n === 1 && d === 2) return "nus";
        if (n === 1 && d === 4) return "rubuc";
        return `${a} ${b} meelood`;
    });

    // ── 9. DEGREES ─────────────────────────────────────────────────────────────────────────────────────
    // `°` ×664 dropped outright; `°C` additionally read the C as /ʕ/. `darajo` ×105, and the corpus writes
    // the full phrase — `5 darajo Celsius` — which is where both words come from.
    s = s.replace(/(\d)\s?°\s?C\b/giu, "$1 darajo Celsius");
    s = s.replace(/(\d)\s?°\s?F\b/giu, "$1 darajo Fahrenheit");
    s = s.replace(/(\d)\s?°\s?([NSEW])(?![\p{L}\p{M}])/giu,
        (_m, d: string, dir: string) => `${d} darajo ${COMPASS[dir.toLowerCase()]!}`);
    s = s.replace(/(\d)\s?°/gu, "$1 darajo");

    // ── 10. SIGNS ───────────────────────────────────────────────────────────────────────────────────────
    // Sourced from the filtered corpus: `ka badan` ×2,109 ("more than"), `ka yar` ×561 ("less than"),
    // `ku dar` ×439 ("add"), `laga jaray` ×17 ("subtracted"), `u dhiganta` ×214 ("equivalent to").
    // ⚠ PLUS BEFORE MINUS, the coupling the Sundanese run found: run the other way, the minus arm claims the
    // bracketed operand of `5 + (−3)` and the `+` is dropped, silently turning a sum into a difference.
    s = s.replace(/(\S)\+\s?(\(?\s?[-−]?\d)/gu, "$1 ku dar $2");
    s = s.replace(/(^|\s)\+\s?(\(?\s?[-−]?\d)/gu, "$1ku dar $2");
    s = s.replace(/(^|[\s(])[-−–](\d)/gu, "$1laga jaray $2");
    // ⚠ `±` IS ONE CHARACTER (U+00B1) and no `+` rule can match inside it — ×22, and it needs its own arm.
    s = s.replace(/±/gu, " ku dar ama laga jaray ");
    s = s.replace(/\s?=\s?/gu, " u dhiganta ");
    s = s.replace(/\s?<\s?/gu, " ka yar ");
    s = s.replace(/\s?>\s?/gu, " ka badan ");
    s = s.replace(/\s?÷\s?/gu, " loo qeybiyay ");

    return s;
}
