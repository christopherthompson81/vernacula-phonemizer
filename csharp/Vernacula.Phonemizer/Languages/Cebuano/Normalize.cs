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
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Cebuano;

public static class Normalize
{
    /**
     * The shared symbol tier. Cebuano marks plurality with the particle `mga`, not on the noun, and its Spanish
     * loan units are written both ways after a numeral (`83 kilometro` ×6 / `70 kilometros` ×9 — genuinely
     * mixed), so each CountForms is the single citation form rather than a guessed singular/plural pair.
     *
     * Sourced by whole-word count on the FLEURS corpus (playbook 5e):
     *   porsyento ×16 (commoner than the `%` sign itself, ×4) · kilometro ×21 · metro ×14 · dolyar ×4 ·
     *   ug ×1,176 · pilo ×14 (`8 ka pilo sa gidaghanong tubig` — the MULTIPLICATION sense) · kada ×129 (per)
     */
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Percent = new[] { "porsyento" },
        Currency = new Dictionary<string, IReadOnlyList<string>>
        {
            ["US$"] = new[] { "dolyar sa Estados Unidos" }, ["AUD$"] = new[] { "dolyar" },
            ["$"] = new[] { "dolyar" }, ["€"] = new[] { "euro" },
            // ⚠ `pound` ×3 IS THE CURRENCY AND `libra` ×5 IS NOT, which is why the sense had to be read rather
            // than the count. `libra` is the unit of WEIGHT here — *sobra sa 1,000 ka libras* — while the money
            // word appears as `Falkland pound (FKP)`. Taking the bigger number would have priced things in
            // pounds-avoirdupois.
            ["£"] = new[] { "pound" },
        },
        Magnitudes = new[] { "libo", "milyon", "bilyon", "bilyones", "trilyon", "trilyones" },
        Units = new Dictionary<string, IReadOnlyList<string>>
        {
            ["km"] = new[] { "kilometro" }, ["m"] = new[] { "metro" }, ["cm"] = new[] { "sentimetro" },
            ["mm"] = new[] { "milimetro" }, ["kg"] = new[] { "kilo" },
        },
        // `kwadrado` ×3, attested in exactly this frame — `783,562 kilometro kwadrado (300,948 sq mi)`. No cube
        // word occurs, so `cubed` is left undeclared rather than guessed.
        ExponentWords = new ExponentWordsDef { Squared = new[] { "kwadrado" } },
        UnitPer = "kada",
        RateDenominators = new Dictionary<string, string> { ["h"] = "oras", ["s"] = "segundo" },
        Ampersand = "ug",
        Multiply = new MultiplyDef { Times = "ka pilo" },
    });

    /** Dotted abbreviations, and the list is SHORT ON PURPOSE — see the header note at step 6. */
    private static readonly IReadOnlyDictionary<string, string> DOTTED_ABBREV = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["dr"] = "Doktor", ["jr"] = "Junior", ["sr"] = "Senior", ["st"] = "Santo",
        ["mr"] = "Ginoo", ["mrs"] = "Ginang", ["prof"] = "Propesor",
    };
    private static readonly string ABBREV_ALT = string.Join("|", DOTTED_ABBREV.Keys.OrderByDescending(k => k.Length));

    private static readonly JsRe GROUPED = JsRegex.Compile("(?<![\\d.,])(\\d{1,3}(?:,\\d{3})+)(?!\\d)", "gu");
    private static readonly JsRe COMMAS = JsRegex.Compile(",", "gu");
    private static readonly JsRe CLOCK_COLON = JsRegex.Compile("(?<![\\d.:])([01]?\\d|2[0-3]):([0-5]\\d)\\b(?!\\.?\\d)", "gu");
    private static readonly JsRe CLOCK_DOT = JsRegex.Compile(
        "(?<![\\d.:])([01]?\\d|2[0-3])\\.([0-5]\\d)(?!\\d)(?=\\s*(?:GMT|UTC|[ap]\\.?m\\b|sa (?:buntag|hapon|gabii)))", "giu");
    private static readonly JsRe CLOCK_MILITARY = JsRegex.Compile("(?<![\\d.:])([01]\\d|2[0-3])([0-5]\\d)(?!\\d)(?=\\s*(?:GMT|UTC))", "gu");
    private static readonly JsRe DECIMAL = JsRegex.Compile("(\\d)\\.(\\d{1,2})(?![\\d.,])", "gu");
    private static readonly JsRe RANGE = JsRegex.Compile(
        "(?<!\\b(?:ngadto sa|hangtod|hangtud|gikan sa)\\s)(?<![\\d.,\\p{L}-])(\\d+)\\s?[-–]\\s?(\\d+)(?![\\d.,-])", "gu");
    private static readonly JsRe ABBREV = JsRegex.Compile($"\\b({ABBREV_ALT})\\.", "giu");
    private static readonly JsRe FRACTION = JsRegex.Compile("(?<![\\d/])(\\d{1,3})\\/(\\d{1,3})(?![\\d/])", "gu");
    private static readonly JsRe PLUS_ATTACHED = JsRegex.Compile("(\\S)\\+\\s?(\\(?\\s?[-−]?\\d)", "gu");
    private static readonly JsRe PLUS_LEADING = JsRegex.Compile("(^|\\s)\\+\\s?(\\(?\\s?[-−]?\\d)", "gu");

    /** The clock reading: on the hour the minutes drop out, else they are joined with `ug`. */
    private static string Clock(string h, string min) =>
        Js.Number(min) == 0
            ? Js.NumberToString(Js.Number(h))
            : $"{Js.NumberToString(Js.Number(h))} ug {Js.NumberToString(Js.Number(min))}";

    /** Every rule emits DIGITS where a number is involved and lets the engine's own number path speak them. */
    public static string NormalizeCebuano(string input)
    {
        var s = input;

        // ── 1. DE-GROUP THOUSANDS — FIRST, and the most destructive defect this layer repairs ───────────────
        // ×41, all comma-grouped; the period form is ×0 in this corpus. `.`/`,` are both clause punctuation and
        // the TOKEN splits on `\d+`, so `1,100 km` read *usa , usa ka gatos km* — the value gone.
        // ⚠ EXACTLY THREE DIGITS PER GROUP: `14.7` and `2.5` are decimals and must survive. The trailing guard
        // rejects only a following DIGIT, so a group followed by the decimal point still de-groups (`14,700.5`).
        s = GROUPED.Replace(s, m => COMMAS.Replace(m.Value, ""));

        // ── 2. CLOCK — BEFORE the decimal rule, and before the tier ─────────────────────────────────────────
        // ×17, and the corpus writes the hour with `alas` ×11. The colon is clause punctuation, so every time
        // read as two numbers with a pause between them.
        // ⚠ THE MINUTES ARE JOINED WITH `ug` ("and"), which is how Cebuano builds every compound numeral — the
        // same ×1,176 conjunction the ampersand rule spends. On the hour the minutes drop out.
        s = CLOCK_COLON.Replace(s, m => Clock(m.Groups[1].Value, m.Groups[2].Value));
        // ⚠ AND THE PERIOD-SEPARATED CLOCK, which the corpus diff found and no probe would have: this corpus
        // writes `12.00 GMT` and `15.00 UTC` beside `9:30 sa buntag`. Without this the decimal rule claimed them.
        // ⚠ THE DISAMBIGUATION IS THE FOLLOWING MARKER, not the digits: `6.34 pulgada` is the same shape and IS
        // a decimal, so only a timezone or a part-of-day licenses the clock reading.
        s = CLOCK_DOT.Replace(s, m => Clock(m.Groups[1].Value, m.Groups[2].Value));
        // ⚠ AND THE MILITARY FORM, `0230 UTC` / `1200 GMT` — four digits and NO separator at all, which the
        // number path read as the cardinal. ×2, both immediately before a timezone, which is the only thing
        // distinguishing them from an ordinary four-digit number (a YEAR is the same shape).
        s = CLOCK_MILITARY.Replace(s, m => Clock(m.Groups[1].Value, m.Groups[2].Value));

        // ── 3. THE SHARED TIER — percent, currency, units, rates, `&`, `×` ──────────────────────────────────
        // ⚠ BEFORE THE DECIMAL RULE ("units before decimals", the playbook's coupling): the tier matches a unit
        // or a sign only when a NUMBER is adjacent, and rewriting `14.7` to `14 punto 7` destroys that. AFTER
        // de-grouping, or `1,100 km` is seen as `100 km`.
        s = SYMBOLS(s);

        // ── 4. DECIMALS → `punto` ──────────────────────────────────────────────────────────────────────────
        // ×19, every one previously a clause pause mid-number (`2.5 metros` → *duha . lima metros*).
        // ⚠ THE WORD IS AN INFERENCE FROM SENSE AND IS LABELLED AS ONE. `punto` ×20 and `puntos` ×12 are in the
        // corpus, but their senses are a point of exposure and SPORTS POINTS — not one is a decimal separator.
        // This is the Zulu `amaphuzu` shape: a written corpus is the weakest evidence there is about how a
        // SYMBOL is spoken. `punto` is the Spanish loan Cebuano uses for a point, and the alternative is 19
        // decimals read with a clause break.
        // ⚠ The fractional part is read DIGIT BY DIGIT, which is what a decimal is.
        s = DECIMAL.Replace(s, m =>
            $"{m.Groups[1].Value} punto {string.Join(" ", Js.CodePoints(m.Groups[2].Value))}");

        // ── 5. RANGES → `ngadto sa` ────────────────────────────────────────────────────────────────────────
        // ×12. The hyphen was dropped, leaving two numbers abutting with no connective — and for a YEAR SPAN
        // that is the commonest shape (`1990-1995`).
        // ⚠ THE THREE GUARDS THE su AND so RUNS PAID FOR, carried rather than re-earned: do not double a
        // connective the text already wrote, do not claim a HYPHEN CHAIN, and require digits on BOTH sides —
        // which is also what keeps this rule off `ika-20`, the ordinal prefix.
        s = RANGE.Replace(s, "$1 ngadto sa $2");

        // ── 6. DOTTED ABBREVIATIONS ────────────────────────────────────────────────────────────────────────
        // ⚠ THE LIST IS SHORT BECAUSE THE COUNT WAS A LIE. A first tabulation of `\b[A-Z][a-z]{1,4}\.` reported
        // ×146 "abbreviations"; reading them showed the bulk were SENTENCE ENDS — `Japan.` ×4, `China.` ×3.
        // The genuine dotted abbreviations are `Dr.` ×4, `Jr.` ×4, `St.` ×3 and a handful of initials, ~15.
        // ⚠ SO THE RULE IS KEYED ON A CLOSED LIST, never on the shape. The dot is KEPT, so a genuine sentence
        // end is unaffected either way.
        s = ABBREV.Replace(s, m => $"{DOTTED_ABBREV[m.Groups[1].Value.ToLowerInvariant()]}");

        // ── 7. FRACTIONS ───────────────────────────────────────────────────────────────────────────────────
        // ×1 in this corpus, so this is robustness for plausible input rather than a measured repair, and it is
        // labelled as such. `tunga` ("half") ×16 is the word for the one that has its own; everything else
        // composes with `kabahin` ("part"), the ordinary Cebuano fraction frame.
        s = FRACTION.Replace(s, m =>
            Js.Number(m.Groups[1].Value) == 1 && Js.Number(m.Groups[2].Value) == 2
                ? "tunga"
                : $"{m.Groups[1].Value} kabahin sa {m.Groups[2].Value}");

        // ── 8. SIGNS ───────────────────────────────────────────────────────────────────────────────────────
        // ⚠ ONLY THE TWO THIS CORPUS ATTESTS A WORD FOR. `+` ×2 and `°` ×2 occur; `=`, `<`, `>`, `±`, `÷` and `×`
        // are ×0, and more to the point NO Cebuano word for them is attested here. Inventing six readings from a
        // 1,932-sentence corpus is exactly what the Fula `tere` lesson forbids, so they stay unread.
        // `dugang` ("additional, more") ×32 is the one arithmetic word the corpus does carry.
        s = PLUS_ATTACHED.Replace(s, "$1 dugang $2");
        s = PLUS_LEADING.Replace(s, "$1dugang $2");

        return s;
    }
}
