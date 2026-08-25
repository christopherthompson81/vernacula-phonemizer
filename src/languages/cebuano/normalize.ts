/**
 * Cebuano (ceb) text normalization — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the pipeline speaks. Pure text→text; no IPA.
 *
 * ⚠⚠ THE CORPUS IS FLEURS, NOT ceb.wikipedia, AND THAT IS THE MOST IMPORTANT DECISION IN THIS FILE.
 * ceb.wikipedia is the second-largest Wikipedia on earth and is ~99% Lsjbot-generated: a 1,845 MB dump for a
 * 20M-speaker language, built from a handful of templates. Eight random articles drawn while writing this
 * were eight bot stubs from two moulds:
 *
 *     "Kaliwatan sa gasang ang Muricella dubia. Una ning gihulagway ni Nutting ni adtong 1910."
 *     "Bukid ang Gamar Gutta sa Indiya. Nahimutang ni sa distrito sa Gadchiroli … 1,100 km sa …"
 *
 * Mining that would not measure Cebuano, it would measure two sentence templates — every `grouped`, `range`
 * and `units` instance would be the same clause with different nouns. This is the su lesson one step further
 * on: there the contamination was another LANGUAGE, here it is the same language written by a machine, which
 * no language filter can detect. So the artifact is FLEURS ceb_ph (train+dev+test, column 3 cased, 1,932
 * unique human-translated sentences) and every count below is from it.
 *
 * ⚠ THE PRICE IS SMALL COUNTS, and they are quoted honestly rather than inflated. FLEURS is 1,932 sentences
 * against a dump's tens of thousands, so `%` is ×4 where a dump would say thousands. A rule resting on ×4 is
 * marked as such. 27 of 35 cells are covered; the 8 empty ones are a FLEURS-SIZE limit, and the playbook's
 * `fetch --fill` is deliberately NOT used because it would draw from the bot wiki.
 *
 * ⚠ CEBUANO WRITES THE ENGLISH CONVENTION: comma groups thousands (×41), the period marks the decimal (×19),
 * and neither is written the other way even once. Both were clause punctuation, so `1,100 km` read as
 * *usa , usa ka gatos* — one, pause, one hundred, with the value destroyed.
 *
 * ⚠ ONE SEAM ALREADY WORKS AND IS LEFT ALONE (trap 16): the ordinal `ika-20 nga siglo` already reads
 * *ika kaluhaan nga siglo*, because ⟨ika⟩ is an ordinary Cebuano prefix and the hyphen falls out. ×34.
 */
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { MANIFEST } from "./manifest.ts";

/**
 * The shared symbol tier. Cebuano marks plurality with the particle `mga`, not on the noun, and its Spanish
 * loan units are written both ways after a numeral (`83 kilometro` ×6 / `70 kilometros` ×9 — genuinely
 * mixed), so each CountForms is the single citation form rather than a guessed singular/plural pair.
 *
 * Sourced by whole-word count on the FLEURS corpus (playbook 5e):
 *   porsyento ×16 (commoner than the `%` sign itself, ×4) · kilometro ×21 · metro ×14 · dolyar ×4 ·
 *   ug ×1,176 · pilo ×14 (`8 ka pilo sa gidaghanong tubig` — the MULTIPLICATION sense) · kada ×129 (per)
 */
const SYMBOLS = makeSymbolNormalizer({
    percent: MANIFEST.symbolTier.percent,
    currency: MANIFEST.symbolTier.currency,
    units: MANIFEST.symbolTier.units,
    rateDenominators: MANIFEST.symbolTier.rateDenominators,
    unitPer: MANIFEST.symbolTier.unitPer,
    exponentWords: MANIFEST.symbolTier.exponentWords,
    magnitudes: MANIFEST.symbolTier.magnitudes,
    ampersand: MANIFEST.symbolTier.ampersand,
    multiply: MANIFEST.symbolTier.multiply,
});

/** Dotted abbreviations, and the list is SHORT ON PURPOSE — see the header note at step 6. */
const DOTTED_ABBREV: Readonly<Record<string, string>> = {
    dr: "Doktor", jr: "Junior", sr: "Senior", st: "Santo", mr: "Ginoo", mrs: "Ginang", prof: "Propesor",
};
const ABBREV_ALT = Object.keys(DOTTED_ABBREV).sort((a, b) => b.length - a.length).join("|");

/** Every rule emits DIGITS where a number is involved and lets the engine's own number path speak them. */
export function normalizeCebuano(input: string): string {
    let s = input;

    // ── 1. DE-GROUP THOUSANDS — FIRST, and the most destructive defect this layer repairs ───────────────
    // ×41, all comma-grouped; the period form is ×0 in this corpus. `.`/`,` are both clause punctuation and
    // the TOKEN splits on `\d+`, so `1,100 km` read *usa , usa ka gatos km* — the value gone.
    // ⚠ EXACTLY THREE DIGITS PER GROUP: `14.7` and `2.5` are decimals and must survive. The trailing guard
    // rejects only a following DIGIT, so a group followed by the decimal point still de-groups (`14,700.5`).
    s = s.replace(/(?<![\d.,])(\d{1,3}(?:,\d{3})+)(?!\d)/gu, (m) => m.replaceAll(",", ""));

    // ── 2. CLOCK — BEFORE the decimal rule, and before the tier ─────────────────────────────────────────
    // ×17, and the corpus writes the hour with `alas` ×11 (`mga alas 9:30 sa buntag`, `alas 07:19`). The
    // colon is clause punctuation, so every time read as two numbers with a pause between them.
    // ⚠ THE MINUTES ARE JOINED WITH `ug` ("and"), which is how Cebuano builds every compound numeral — the
    // same ×1,176 conjunction the ampersand rule spends, so it needs no separate sourcing. On the hour the
    // minutes drop out.
    const clock = (_m: string, h: string, min: string): string =>
        Number(min) === 0 ? `${Number(h)}` : `${Number(h)} ug ${Number(min)}`;
    s = s.replace(/(?<![\d.:])([01]?\d|2[0-3]):([0-5]\d)\b(?!\.?\d)/gu, clock);
    // ⚠ AND THE PERIOD-SEPARATED CLOCK, which the corpus diff found and no probe would have: this corpus
    // writes `12.00 GMT` and `15.00 UTC` beside `9:30 sa buntag` and `8:46 sa buntag`. Without this the
    // decimal rule claimed them — `12.00 GMT` read *napulo ug duha punto nol nol*, a time spoken as a
    // measurement. ⚠ THE DISAMBIGUATION IS THE FOLLOWING MARKER, not the digits: `6.34 pulgada` is the same
    // shape and IS a decimal, so only a timezone or a part-of-day licenses the clock reading.
    s = s.replace(/(?<![\d.:])([01]?\d|2[0-3])\.([0-5]\d)(?!\d)(?=\s*(?:GMT|UTC|[ap]\.?m\b|sa (?:buntag|hapon|gabii)))/giu, clock);
    // ⚠ AND THE MILITARY FORM, `0230 UTC` / `1200 GMT` — four digits and NO separator at all, which the
    // number path read as the cardinal *usa ka libo ug duha ka gatos*. ×2, both immediately before a
    // timezone, which is the only thing distinguishing them from an ordinary four-digit number (a YEAR is
    // the same shape). The timezone is required, not optional.
    s = s.replace(/(?<![\d.:])([01]\d|2[0-3])([0-5]\d)(?!\d)(?=\s*(?:GMT|UTC))/gu, clock);

    // ── 3. THE SHARED TIER — percent, currency, units, rates, `&`, `×` ──────────────────────────────────
    // ⚠ BEFORE THE DECIMAL RULE ("units before decimals", the playbook's coupling): the tier matches a unit
    // or a sign only when a NUMBER is adjacent, and rewriting `14.7` to `14 punto 7` destroys that — the
    // corpus's own `US$14.7 bilyones` is exactly the shape at risk. AFTER de-grouping, or `1,100 km` is
    // seen as `100 km`.
    s = SYMBOLS(s);

    // ── 4. DECIMALS → `punto` ──────────────────────────────────────────────────────────────────────────
    // ×19, every one previously a clause pause mid-number (`2.5 metros` → *duha . lima metros*).
    // ⚠ THE WORD IS AN INFERENCE FROM SENSE AND IS LABELLED AS ONE. `punto` ×20 and `puntos` ×12 are in the
    // corpus, but their senses are a point of exposure and SPORTS POINTS (`2,243 nga puntos`) — not one is a
    // decimal separator. `tuldok` ("dot") is ×1 and is a physical dot. This is the Zulu `amaphuzu` shape, and
    // it ships for the reason the Wu, Jin, Xiang, Lingala and Somali layers ship theirs: a written corpus is
    // the weakest evidence there is about how a SYMBOL is spoken — writers type `2.5` and never spell out how
    // they would say it. `punto` is the Spanish loan Cebuano uses for a point, and the alternative is 19
    // decimals read with a clause break.
    // ⚠ The fractional part is read DIGIT BY DIGIT, which is what a decimal is.
    s = s.replace(/(\d)\.(\d{1,2})(?![\d.,])/gu, (_m, a: string, b: string) => `${a} punto ${[...b].join(" ")}`);

    // ── 5. RANGES → `ngadto sa` ────────────────────────────────────────────────────────────────────────
    // ×12. The hyphen was dropped, leaving two numbers abutting with no connective — and for a YEAR SPAN
    // that is the commonest shape (`1990-1995`). `ngadto sa` ×65 is the corpus's own "to"; `hangtod` ×50 is
    // its "until", and either would serve.
    // ⚠ THE THREE GUARDS THE su AND so RUNS PAID FOR, carried rather than re-earned: do not double a
    // connective the text already wrote, do not claim a HYPHEN CHAIN (an identifier, not a span), and
    // require digits on BOTH sides — which is also what keeps this rule off `ika-20`, the ordinal prefix.
    s = s.replace(
        /(?<!\b(?:ngadto sa|hangtod|hangtud|gikan sa)\s)(?<![\d.,\p{L}-])(\d+)\s?[-–]\s?(\d+)(?![\d.,-])/gu,
        "$1 ngadto sa $2",
    );

    // ── 6. DOTTED ABBREVIATIONS ────────────────────────────────────────────────────────────────────────
    // ⚠ THE LIST IS SHORT BECAUSE THE COUNT WAS A LIE, and this is trap 2 caught in the act. A first
    // tabulation of `\b[A-Z][a-z]{1,4}\.` reported ×146 "abbreviations"; reading them showed the bulk were
    // SENTENCE ENDS — `Japan.` ×4, `China.` ×3, `Yuta.` ×3, `Sea.` ×2, `Hindu.` ×2. The genuine dotted
    // abbreviations are `Dr.` ×4, `Jr.` ×4, `St.` ×3 and a handful of personal initials, ~15 in all.
    // ⚠ SO THE RULE IS KEYED ON A CLOSED LIST, never on the shape. The German lesson (trap 4) is that a bare
    // `N.` rule must not claim a sentence-final period, and this corpus proves the hazard is live rather
    // than theoretical. The dot is KEPT, so a genuine sentence end is unaffected either way.
    s = s.replace(new RegExp(`\\b(${ABBREV_ALT})\\.`, "giu"),
        (_m, ab: string) => `${DOTTED_ABBREV[ab.toLowerCase()]!}`);

    // ── 7. FRACTIONS ───────────────────────────────────────────────────────────────────────────────────
    // ×1 in this corpus, so this is robustness for plausible input rather than a measured repair, and it is
    // labelled as such. `tunga` ("half") ×16 is the word for the one that has its own; everything else
    // composes with `kabahin` ("part"), the ordinary Cebuano fraction frame.
    s = s.replace(/(?<![\d/])(\d{1,3})\/(\d{1,3})(?![\d/])/gu, (_m, a: string, b: string) =>
        Number(a) === 1 && Number(b) === 2 ? "tunga" : `${a} kabahin sa ${b}`);

    // ── 8. SIGNS ───────────────────────────────────────────────────────────────────────────────────────
    // ⚠ ONLY THE TWO THIS CORPUS ATTESTS A WORD FOR. `+` ×2 and `°` ×2 occur; `=`, `<`, `>`, `±`, `÷` and `×`
    // are ×0, and more to the point NO Cebuano word for them is attested here — `katumbas` (equals) ×0,
    // `grado`/`digri` (degrees) ×0, `minus` ×0. Inventing six readings from a 1,932-sentence corpus is
    // exactly what the Fula `tere` lesson forbids, so they stay unread and are declared in defects.ts.
    // `dugang` ("additional, more") ×32 is the one arithmetic word the corpus does carry.
    s = s.replace(/(\S)\+\s?(\(?\s?[-−]?\d)/gu, "$1 dugang $2");
    s = s.replace(/(^|\s)\+\s?(\(?\s?[-−]?\d)/gu, "$1dugang $2");

    return s;
}
