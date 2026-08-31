/**
 * Lithuanian / lietuvių (lt) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is
 * not already a pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * ⚠ NO SHARED SYMBOL TIER IS WIRED, AND THE REASON IS TRAP 14 IN ITS PUREST FORM. Lithuanian is a
 * seven-case language whose EVERY counted noun takes the Baltic three-way concord — `1 procentas`,
 * `2 procentai`, `10 procentų` — and `Core/NormalizeSymbols.cs` holds ONE invariant string per unit. It
 * cannot say any of them. A digit becomes words in the TOKENIZER, downstream of this whole layer, so a rule
 * that emits `$1 <noun> $2` on digits can never make the noun agree, because at that moment there is no word
 * to agree WITH. Every rule below therefore words-ifies its own operand through `NumberToWords` and calls
 * the engine's own `Agree` — the same function the magnitude nouns already use — and then claims the unit
 * the tier can no longer see.
 *
 * The full corpus evidence, the counts behind every reading, and the list of what is DELIBERATELY NOT DONE
 * (no ordinals anywhere, no bare-`°` rule, no clock beyond the marked one, no fractions, no equals word, no
 * dimension cross, no sports score, no tilde, no English decimal dot) live in the TypeScript original,
 * src/languages/lithuanian/normalize.ts. This port reproduces its behaviour exactly; it does not restate
 * the sourcing.
 */
using System.Text.RegularExpressions;
using Vernacula.Phonemizer.Core;
using static Vernacula.Phonemizer.Core.Boundaries;
using static Vernacula.Phonemizer.Core.Rewriter;

namespace Vernacula.Phonemizer.Languages.Lithuanian;

public static class Normalize
{
    private static LithuanianNormalization NRM => Manifest.MANIFEST.Normalization;
    private static LithuanianAgreement N(string k) => NRM.CountedNouns[k];
    private static string W(string k) => NRM.Words[k];

    /** ASCII space or NO-BREAK space. Written as an ESCAPE, never as a literal — a literal U+00A0 collapses
     *  invisibly to a duplicate ASCII space under an editor or a copy-paste and the class silently becomes
     *  one alternative instead of two. */
    private const string SP = "[ \\u00a0\\u202f\\u2009]";  // space, NBSP, NNBSP, thin space

    /**
     * A digit run with an optional decimal comma, ANCHORED so it cannot start or end inside a longer number.
     * ⚠ Both edges, not one (trap 52). ⚠ NEITHER SEPARATOR IS REJECTED UNCONDITIONALLY — a separator only
     * belongs to the number when a DIGIT follows it, or every figure that ENDS A CLAUSE is declined.
     * ⚠ AND A COLON IS REJECTED ON BOTH EDGES, WHICH IS WHERE THE "NO CLOCK" REFUSAL IS ACTUALLY
     * IMPLEMENTED. A refusal that no guard enforces is a comment, not a refusal.
     */
    private const string NUM = "(?<![\\d.,:])(\\d+(?:,\\d+)?)(?!\\d|[.,]\\d|:)";

    /**
     * GENDER. Lithuanian's 1–9 inflect for gender and `NumberToWords` emits the MASCULINE citation form,
     * which is correct for a bare numeral and wrong the moment this layer supplies a noun: `4 val.` is
     * *keturios valandos*, never *keturi valandos*. Only the FINAL unit word of a composed numeral carries
     * it — *dvidešimt keturios* — so the swap is on the last token, and only 1–9 differ at all.
     */
    private static string Feminise(string words)
    {
        var parts = words.Split(' ');
        var last = parts.Length > 0 ? parts[^1] : "";
        var i = IndexOfOrdinal(Manifest.MANIFEST.Numbers.Units, last);
        if (i < 0) return words; // ends in a teen, a ten or a magnitude noun — all gender-invariant
        parts[^1] = Manifest.MANIFEST.Numbers.UnitsFem[i];
        return string.Join(" ", parts);
    }

    private static int IndexOfOrdinal(IReadOnlyList<string> list, string needle)
    {
        for (var i = 0; i < list.Count; i++) if (string.Equals(list[i], needle, StringComparison.Ordinal)) return i;
        return -1;
    }

    /** Parse an operand the rules captured. Returns the words and the concord form for a counted noun. */
    private static string Quantity(string raw, LithuanianAgreement forms)
    {
        var parts = raw.Split(',');
        var intPart = parts[0];
        var frac = parts.Length > 1 ? parts[1] : null;
        var n = Js.Number(intPart);
        if (double.IsNaN(n) || double.IsInfinity(n)) return raw;
        // A DECIMAL takes the GENITIVE. Lithuanian puts a fractional quantity's noun in the genitive
        // ("16,27 mlrd. eurų", "45,7 laipsnių Celsijaus" — both attested), and the alternative would be to
        // agree with a whole-number part the speaker never says on its own.
        var noun = frac is null ? Numbers.Agree(n, forms) : forms.Gen;
        var num = Bare(raw);
        return $"{(forms.Fem == true ? Feminise(num) : num)} {noun}";
    }

    /** The magnitude noun for an abbreviation standing between a figure and its unit or currency, agreeing
     *  with the figure — or the empty string when there is none. */
    private static string MagWords(string num, string? mag)
    {
        if (mag is null) return "";
        LithuanianAgreement? forms = null;
        foreach (var (re, f) in MAGS) if (re.IsMatch(mag)) { forms = f; break; }
        if (forms is null) return "";
        return " " + (num.Contains(',') ? forms.Gen : Numbers.Agree(Js.Number(num.Split(',')[0]), forms));
    }

    /** Just the words for an operand, with no noun — for the range and sign rules. */
    private static string Bare(string raw)
    {
        var parts = raw.Split(',');
        var intPart = parts[0];
        var frac = parts.Length > 1 ? parts[1] : null;
        var n = Js.Number(intPart);
        if (double.IsNaN(n) || double.IsInfinity(n)) return raw;
        // ⚠ `frac.split("")` is CODE UNITS in the TS — each unit read as its own digit.
        return frac is null
            ? Numbers.NumberToWords(n)
            : $"{Numbers.NumberToWords(n)} {W("decimalPoint")} "
              + string.Join(" ", frac.Select(d => Numbers.NumberToWords(Js.Number(d.ToString()))));
    }

    /**
     * IS ONE OF THESE WORDS ALREADY IN THE TEXT NEAR HERE? The trap-12 "do not say it twice" guard:
     *   · WORD-BOUNDED, never a bare substring test — `eur` is four characters inside *Europos*.
     *   · CASE-INSENSITIVE — this corpus capitalises a noun sentence-initially and inside a title.
     */
    private static bool SaidNear(string text, IReadOnlyList<JsRe> forms)
    {
        foreach (var f in forms) if (f.IsMatch(text)) return true;
        return false;
    }

    private static IReadOnlyList<JsRe> FormRes(params string[] forms) =>
        forms.Select(f => JsRegex.Compile($"{NOT_LETTER_BEFORE}{f}{NOT_LETTER_AFTER}", "iu")).ToArray();

    private static readonly IReadOnlyList<JsRe> DOLLAR_FORMS =
        FormRes("doleris", "dolerio", "doleriai", "dolerių", "dolerius", "dolerį");
    private static readonly IReadOnlyList<JsRe> EURO_FORMS =
        FormRes("euras", "euro", "eurai", "eurų", "eurus", "eurą");
    private static readonly IReadOnlyList<JsRe> POUND_FORMS =
        FormRes("svaras", "svaro", "svarai", "svarų", "svarus", "svarą");
    private static readonly IReadOnlyList<JsRe> LITAS_FORMS =
        FormRes("litas", "lito", "litai", "litų", "litus", "litą");

    /**
     * THE FIRST `n` WORDS AFTER A MATCH — the window `SaidNear` searches, and the reason it is a word count
     * and not a character count: 30 CHARACTERS reached a currency noun belonging to a DIFFERENT figure.
     */
    private static readonly JsRe NEXT_TWO_WORDS =
        JsRegex.Compile("^(?:[^\\p{L}\\p{M}]*[\\p{L}\\p{M}]+){0,2}", "u");

    private static string NextWords(string after)
    {
        var m = NEXT_TWO_WORDS.Match(after);
        return m.Success ? m.Value : "";
    }

    /** The FIRST WORD of either era phrase this layer inserts (`prieš mūsų erą` / `mūsų eros`), as a
     *  lookahead. Step 9's "a letter follows ⇒ this magnitude governs a noun" test must not fire on it. */
    private static readonly JsRe ERA_HEAD = JsRegex.Compile(
        "^" + SP + "*(?:"
        + string.Join("|", new[] { W("eraBefore"), W("eraOur") }.Select(w => w.Split(' ')[0]))
        + ")" + NOT_LETTER_AFTER, "u");

    /** The magnitude abbreviations, and the noun each expands to. ⚠ NO `g` FLAG — the TS spells these as
     *  plain literals and calls `.test` on them, which is stateless. A `g` here would make every other
     *  call fail through `lastIndex`. */
    /** ⚠ The two steps below build their patterns from `Re.Source` rather than from a second list of the
     *  same three strings, which is what the TS does (`re.source`) and for the same reason: a parallel array
     *  is a hand-maintained duplicate that can drift out of step with the table it mirrors. */
    private static readonly IReadOnlyList<(JsRe Re, LithuanianAgreement Forms)> MAGS = new[]
    {
        (JsRegex.Compile("mlrd", "u"), Manifest.MANIFEST.Numbers.Magnitudes.Billion),
        (JsRegex.Compile("mln", "u"), Manifest.MANIFEST.Numbers.Magnitudes.Million),
        (JsRegex.Compile("tūkst", "u"), Manifest.MANIFEST.Numbers.Magnitudes.Thousand),
    };

    /**
     * A CLOCK'S SEPARATOR LOSES ITS PAUSE BEHIND `val.` — and nothing else happens. NO WORD IS EMITTED;
     * what this removes is the CLAUSE PAUSE the colon was, and the full stop `8.46` was taking mid-figure.
     * ⚠ `a.m.`/`p.m.` are deliberately NOT in the marker set: removing the colon puts the minute field next
     * to the `a.`, and step 6's century abbreviation then reads `19 a.` as *devyniolika amžiaus*. Trading a
     * pause for a wrong WORD is the wrong side of trap 53.
     * ⚠ THE TRAILING GUARD REJECTS A DIGIT OR A SEPARATOR THAT CONTINUES THE NUMBER, NOT A CLAUSE MARK.
     */
    private static readonly JsRe CLOCK_MARKED =
        JsRegex.Compile("(?<![\\d.,:])([01]?\\d|2[0-3])[.:]([0-5]\\d)(?![\\d]|[.,:]\\d)(?=\\s*val\\b)", "gu");

    private static readonly JsRe SCORE =
        JsRegex.Compile($"{NOT_LETTER_BEFORE}(?:rezultat|pergal|pralaimėj|lygus)", "iu");
    private static readonly JsRe HAS_NUO = JsRegex.Compile(
        $"{NOT_LETTER_BEFORE}(?:nuo|iki|apie|prieš|per|tarp){NOT_LETTER_AFTER}{SP}*$", "iu");
    private static readonly JsRe HAS_IKI = JsRegex.Compile($"{NOT_LETTER_BEFORE}iki{NOT_LETTER_AFTER}{SP}*$", "iu");
    private static readonly JsRe TEMPORAL =
        JsRegex.Compile($"^{SP}*(m\\.|d\\.|a\\.|met|dien|amž|tūkstantme)", "u");
    private static readonly JsRe FEM_UNIT =
        JsRegex.Compile($"^{SP}*(?:val\\.|min\\.|t{NOT_LETTER_AFTER})", "u");
    private static readonly JsRe RANGE = JsRegex.Compile(
        "(?<![\\d.,:/\\p{L}\\p{M}–—-])(\\d+(?:,\\d+)?)" + SP + "*[–—-]" + SP + "*(\\d+(?:,\\d+)?)"
        + "(?!\\d|[.,]\\d|:|[–—-])", "gu");

    private static readonly JsRe DEGROUP =
        JsRegex.Compile($"(?<=\\d)(?<!(?<![\\d\\.,])0){SP}(?=\\d{{3}}(?!\\d))", "gu");
    private static readonly JsRe DIMENSION_X = JsRegex.Compile($"(?<=\\d){SP}*x{SP}*(?=\\d)", "gu");

    private static readonly JsRe ERA_BEFORE_RE =
        JsRegex.Compile($"{NOT_LETTER_BEFORE}p(?:r)?\\.{SP}*m\\.{SP}*e\\.", "gu");
    private static readonly JsRe ERA_OUR_RE = JsRegex.Compile($"{NOT_LETTER_BEFORE}m\\.{SP}*e\\.", "gu");
    private static readonly JsRe THAT_IS_RE = JsRegex.Compile($"{NOT_LETTER_BEFORE}t\\.{SP}*y\\.", "gu");
    private static readonly JsRe P_PL = JsRegex.Compile($"{NOT_LETTER_BEFORE}p\\.{SP}*pl\\.", "gu");
    private static readonly JsRe S_PL = JsRegex.Compile($"{NOT_LETTER_BEFORE}š\\.{SP}*pl\\.", "gu");
    private static readonly JsRe V_ILG = JsRegex.Compile($"{NOT_LETTER_BEFORE}v\\.{SP}*ilg\\.", "gu");
    private static readonly JsRe R_ILG = JsRegex.Compile($"{NOT_LETTER_BEFORE}r\\.{SP}*ilg\\.", "gu");
    private static readonly JsRe T_METIS = JsRegex.Compile($"{NOT_LETTER_BEFORE}t{SP}*-{SP}*(?=me[tč])", "gu");

    private static readonly JsRe MINUS_SIGN = JsRegex.Compile("(^|[\\s(\\[])[-−–](?=\\d)", "gu");
    private static readonly JsRe PLUS_SIGN = JsRegex.Compile("(^|[\\s(\\[])\\+(?=\\d)", "gu");
    private static readonly JsRe PERCENT_SIGN = JsRegex.Compile($"{NUM}{SP}*%", "gu");
    private static readonly JsRe PERCENT_WORD =
        JsRegex.Compile($"{NUM}{SP}*proc{NOT_LETTER_AFTER}\\.?", "gu");
    private static readonly JsRe CELSIUS = JsRegex.Compile($"{NUM}{SP}*°{SP}*C{NOT_LETTER_AFTER}", "gui");
    private static readonly JsRe FAHRENHEIT = JsRegex.Compile($"{NUM}{SP}*°{SP}*F{NOT_LETTER_AFTER}", "gui");

    /** A magnitude may stand between the figure and its unit — `65,3 tūkst. km²`. */
    private const string MAG_MID_BODY = "(?:" + SP + "*(mlrd|mln|tūkst)\\.?)?";
    private const string MAG_SPELLED = "milijon\\p{L}*|milijard\\p{L}*|tūkstan\\p{L}*";

    private static readonly JsRe ABBREV_MAG_HEAD = JsRegex.Compile("^[\\s\\u00a0]*(?:mlrd|mln|tūkst)", "u");
    private static readonly JsRe GOVERNS_LETTER = JsRegex.Compile($"^{SP}*\\p{{L}}", "u");

    private static readonly JsRe DAY_RE = JsRegex.Compile($"{NUM}{SP}*d\\.", "gu");
    private static readonly JsRe CENTURY_RE = JsRegex.Compile($"{NUM}{SP}*a\\.", "gu");
    private static readonly JsRe HOUR_RE = JsRegex.Compile($"{NUM}{SP}*val\\.", "gu");
    private static readonly JsRe MINUTE_RE = JsRegex.Compile($"{NUM}{SP}*min\\.", "gu");
    private static readonly JsRe VAL_MOP = JsRegex.Compile("(?<![/\\p{L}\\p{M}])val\\.", "gu");
    /** ⚠ `min.` TAKES THE SAME MOP-UP AS `val.`, WHICH IT DID NOT HAVE (#1211) — see the call site. */
    private static readonly JsRe MIN_MOP = JsRegex.Compile("(?<![/\\p{L}\\p{M}])min\\.", "gu");
    /** ⚠ THE SYMBOL CURRENCIES ONLY, NEVER THE LETTER FORM `Lt` (#1211) — see the call site. */
    private static readonly IReadOnlyList<(string Sign, string Noun)> SIGN_ONLY =
        new[] { ("€", "euro"), ("\\$", "dollar"), ("£", "pound") };
    private static readonly JsRe MONTH_ABBREV = JsRegex.Compile($"{NOT_LETTER_BEFORE}[Mm]ėn\\.", "gu");
    private static readonly JsRe PVZ = JsRegex.Compile($"{NOT_LETTER_BEFORE}[Pp]vz\\.", "gu");
    private static readonly JsRe IR_KT = JsRegex.Compile($"{NOT_LETTER_BEFORE}ir{SP}+kt\\.", "giu");
    private static readonly JsRe NR = JsRegex.Compile($"{NOT_LETTER_BEFORE}[Nn]r\\.", "gu");
    private static readonly JsRe PSL = JsRegex.Compile($"{NOT_LETTER_BEFORE}[Pp]sl{NOT_LETTER_AFTER}\\.?", "gu");
    private static readonly JsRe GYV = JsRegex.Compile($"{NOT_LETTER_BEFORE}[Gg]yv\\.", "gu");
    private static readonly JsRe DECIMAL_COMMA =
        JsRegex.Compile("(?<![\\d.,])(\\d+),(\\d+)(?![\\d.,])", "gu");
    private static readonly JsRe AMP_ENTITY = JsRegex.Compile("&amp;", "gu");
    private static readonly JsRe AMPERSAND = JsRegex.Compile("\\s*&\\s*", "gu");
    private static readonly JsRe SPACE_RUN = JsRegex.Compile("[ \\t]{2,}", "gu");

    private static readonly JsRe YEAR_RE = JsRegex.Compile(
        $"{NUM}{SP}*m\\.({SP}*(?:{string.Join("|", Manifest.MANIFEST.Normalization.MonthsGen)}){NOT_LETTER_AFTER})?",
        "gu");

    /** The two-letter and one-letter unit keys, built once. See the TS for each guard's measurement. */
    private static readonly IReadOnlyList<(string Key, string Noun, bool Squarable)> UNIT_KEYS = new[]
    {
        ("km", "kilometre", true), ("mm", "millimetre", true), ("cm", "centimetre", true),
        ("kg", "kilogram", true), ("ha", "hectare", true),
        ("mg", "milligram", false),
    };
    private static readonly IReadOnlyList<(string Key, string Noun, string Extra)> ONE_LETTER = new[]
    {
        ("m", "metre", ""), ("t", "tonne", $"|{SP}*[-–—]"), ("g", "gram", ""),
    };

    private static readonly IReadOnlyList<(string Sign, string Noun, IReadOnlyList<JsRe> Spelled)> CURRENCIES = new[]
    {
        ("€", "euro", EURO_FORMS), ("\\$", "dollar", DOLLAR_FORMS),
        ("£", "pound", POUND_FORMS), ("Lt", "litas", LITAS_FORMS),
    };

    /**
     * Text→text normalization for Lithuanian. A numbered, ORDER-DEPENDENT sequence; the coupling is stated
     * at each step because a future reader cannot recover it from the code.
     */
    public static string NormalizeLithuanian(string input)
    {
        // NFC. Lithuanian's ⟨ą č ę ė į š ų ū ž⟩ all have a decomposed encoding and every literal below is
        // written precomposed. `Core/HostWord.cs` NFCs per TOKEN, which is downstream of this whole file, so
        // a decomposed input would silently miss half these rules (trap 11).
        var t = Renormalize(input, System.Text.NormalizationForm.FormC);

        // 0) THE MARKED CLOCK loses the separator's pause. First, because the ordinal and decimal rules
        //    below both read a dot and would spend `8.46`'s before this could see it.
        t = Rewrite(t, CLOCK_MARKED, "$1 $2");

        // 1) FIXED MULTI-DOT PHRASES, ABOVE EVERY SINGLE-DOT RULE. ⚠ THE ERA PHRASE CONTAINS THE VERY LETTER
        //    THE YEAR RULE CLAIMS: in `pr. m. e.` the `m.` is *mūsų*, not *metai*. Step 10 running first
        //    would read `IV a. pr. m. e.` as "…pr. METAIS e." — the one ordering constraint in this file
        //    that produces a wrong WORD rather than a wrong pause, so it is first.
        t = Rewrite(t, ERA_BEFORE_RE, $" {W("eraBefore")} ");
        t = Rewrite(t, ERA_OUR_RE, $" {W("eraOur")} ");
        t = Rewrite(t, THAT_IS_RE, $" {W("thatIs")} ");
        //    COORDINATE DIRECTION SUFFIXES — the corpus SPELLS THEM OUT beside the abbreviated form.
        t = Rewrite(t, P_PL, " pietų platumos ");
        t = Rewrite(t, S_PL, " šiaurės platumos ");
        t = Rewrite(t, V_ILG, " vakarų ilgumos ");
        t = Rewrite(t, R_ILG, " rytų ilgumos ");
        //    `t-metis` — the MILLENNIUM, and the reason the one-letter `t` key below is not the tonne here.
        //    Only the `t-` prefix is replaced; the suffix is the writer's and carries the case (trap 10).
        t = Rewrite(t, T_METIS, "tūkstant");

        // 2) DE-GROUP THE THOUSANDS SEPARATOR — ABOVE ranges and above every rule that reads a number.
        //    ⚠ LITHUANIAN GROUPS WITH A SPACE, NOT A COMMA, WHICH INVERTS THE USUAL HAZARD: the comma is
        //    this language's DECIMAL separator, so "de-group commas first" would report 3,628 billion for
        //    `3,628 mlrd.`. Iterated to a FIXED POINT, because one pass consumes only the first of a pair;
        //    it terminates because every pass that does anything deletes a character.
        for (var prev = ""; prev != t;)
        {
            prev = t;
            t = Rewrite(t, DEGROUP, "");
        }

        //    THE DIMENSION CROSS, FOLDED TO THE SILENCE THE `×` SIGN ALREADY HAS. ⟨x⟩ is not a Lithuanian
        //    letter and the g2p's fallback read it as /z/ — a plausible phoneme with no basis (trap 56).
        //    Digit-flanked only, so `x1, x2, x3` and `x86` are untouched.
        t = Rewrite(t, DIMENSION_X, " ");

        // 3) RANGES — above the sign rules, because a spaced dash between two numbers is a SPAN and the
        //    minus rule would otherwise claim it.
        {
            var subject = t;
            t = Rewrite(t, RANGE, m =>
            {
                var a = m.Groups[1].Value;
                var b = m.Groups[2].Value;
                var off = m.Index;
                // A SPORTS SCORE IS NOT A SPAN — refused WHOLE, keyed on the words this corpus itself puts
                // in front of its three scores, anywhere in the 50 characters before the match.
                if (SCORE.IsMatch(subject[Math.Max(0, off - 50)..off])) return m.Value;
                // ⚠ DO NOT SAY `nuo` TWICE — and not after any other preposition either. `prieš 50 –65
                // tūkst. metų` already has its preposition; prefixing gave *prieš NUO 50 iki 65*.
                var before = subject[Math.Max(0, off - 14)..off];
                var hasNuo = HAS_NUO.IsMatch(before);
                // ⚠ A PRECEDING `iki` SUPPRESSES THE JOINER TOO: `Iki VII–VIII, o vietomis iki XII` came out
                // *iki septyni IKI aštuoni*. In that frame the dash is an alternation inside one bound, so
                // the whole match is refused and the two cardinals juxtapose.
                if (HAS_IKI.IsMatch(before)) return m.Value;
                // ⚠ A TEMPORAL SPAN DOES NOT TAKE THE CORRELATIVE — `1997–1998 metais` would put a
                // genitive-governing preposition in front of an instrumental. The century is temporal too.
                var after = subject[(off + m.Length)..Math.Min(subject.Length, off + m.Length + 10)];
                var temporal = TEMPORAL.IsMatch(after);
                var from = hasNuo || temporal ? "" : $"{W("rangeFrom")} ";
                // ⚠ THE LEFT OPERAND IS RE-EMITTED AS DIGITS so the tokenizer words-ifies it downstream, and
                // no rule here can make it AGREE. Harmless for a masculine noun, audible for a feminine one:
                // `truko 2–3 val.` came out *du iki trys valandos* where *dvi* is required.
                var femUnit = FEM_UNIT.IsMatch(after);
                return $"{from}{(femUnit ? Feminise(Bare(a)) : a)} {W("rangeTo")} {b}";
            });
        }

        // 4) THE SIGNS, above every rule that words-ifies an operand — `-5 °C` must still have its digit
        //    when the sign rule looks. Omitting a plus is lossless; omitting a MINUS inverts.
        t = Rewrite(t, MINUS_SIGN, $"$1{W("minus")} ");
        t = Rewrite(t, PLUS_SIGN, $"$1{W("plus")} ");

        // 5) PERCENT — the operand becomes WORDS here and the noun agrees with it, which is the trap-14 fix
        //    shape. ⚠ THE SPACE BEFORE `%` IS THE NORMAL LITHUANIAN FORM, not an edge case.
        t = Rewrite(t, PERCENT_SIGN, m => Quantity(m.Groups[1].Value, N("percent")));
        //    ⚠ THE DOT AFTER `proc` IS OPTIONAL AND THE WORD BOUNDARY IS WHAT IDENTIFIES IT.
        t = Rewrite(t, PERCENT_WORD, m => Quantity(m.Groups[1].Value, N("percent")));

        // 6) DEGREES — `°C` / `°F` only; the bare `°` is declined whole. POSTPOSED scale name, this corpus's
        //    own order. ⚠ ⟨C⟩ is a real Lithuanian grapheme reading /t͡s/, so `17 °C` came out *septyniolika
        //    t͡s* — trap 56 rather than a visible leak, and no DROP class can see it.
        t = Rewrite(t, CELSIUS, m => $"{Quantity(m.Groups[1].Value, N("degree"))} {W("celsius")}");
        t = Rewrite(t, FAHRENHEIT, m => $"{Quantity(m.Groups[1].Value, N("degree"))} {W("fahrenheit")}");

        // 7) UNITS. Local, agreeing, and ordered longest-key-first so `km` is tried before `m` and `km²`
        //    before `km`. Every operand is anchored on both edges (trap 52). A `/` on either side blocks the
        //    match, so a rate with no rate word declared is refused WHOLE rather than half (trap 54).
        //    ⚠ A MAGNITUDE MAY STAND BETWEEN THE FIGURE AND ITS UNIT and this step must claim it — step 9
        //    words-ifies `65,3 tūkst.` and thereby destroys the number–unit adjacency this step matches on.
        foreach (var (key, noun, squarable) in UNIT_KEYS)
        {
            var forms = N(noun);
            if (squarable)
            {
                // ⚠ THE SQUARED MODIFIER AGREES TOO, and it PRECEDES its noun: *kvadratinių kilometrų*. The
                // ASCII `km2` form is claimed beside `km²`, or the tier-less path reads the `2` as a NUMBER.
                var re = JsRegex.Compile(
                    $"(?<![/\\p{{L}}]){NUM}{MAG_MID_BODY}{SP}*{key}{SP}*[²2]{NOT_LETTER_AFTER}", "gu");
                t = Rewrite(t, re, m =>
                {
                    var num = m.Groups[1].Value;
                    var mag = m.Groups[2].Success ? m.Groups[2].Value : null;
                    var forced = mag is not null || num.Contains(',');
                    var q = forced
                        ? $"{Bare(num)}{MagWords(num, mag)} {forms.Gen}"
                        : Quantity(num, forms);
                    var sq = forced ? N("squared").Gen : Numbers.Agree(Js.Number(num.Split(',')[0]), N("squared"));
                    var words = q.Split(' ');
                    // The modifier goes immediately before the noun it agrees with, which is the last word.
                    return $"{string.Join(" ", words[..^1])} {sq} {words[^1]}";
                });
            }
            // ⚠ THE RIGHT GUARD REJECTS `/` AND NOTHING ELSE — IT MUST NOT CARRY THE DOT. It briefly did and
            // declined every CLAUSE-FINAL figure (`neviršija 600 km.`), leaving a raw `km` in the stream.
            {
                var re = JsRegex.Compile(
                    $"(?<![/\\p{{L}}]){NUM}{MAG_MID_BODY}{SP}*{key}{NOT_LETTER_AFTER}(?!/)", "gu");
                t = Rewrite(t, re, m =>
                {
                    var num = m.Groups[1].Value;
                    var mag = m.Groups[2].Success ? m.Groups[2].Value : null;
                    return mag is null
                        ? Quantity(num, forms)
                        : $"{Bare(num)}{MagWords(num, mag)} {forms.Gen}";
                });
            }
        }
        //    ⚠ THE ONE-LETTER `m`, `t` AND `g` KEYS, AND THE DOT IS THE DISCRIMINATOR THAT DOES MOST OF THE
        //    WORK WITHOUT DOING ALL OF IT. `m.` with a dot is the YEAR ×346 against ×1 metre, and bare `m`
        //    is the METRE ×17 against ×1 year. So `m` is the metre only when NO dot follows, and it must be
        //    SPACED from its number. ⚠ `t` HAD A COUNTER-EXAMPLE THAT OUTNUMBERS ITS TRUE POSITIVE 3:1 — the
        //    MILLENNIUM `III t - mečio` arrives here as `3 t - mečio`; a HYPHEN AFTER THE KEY rejects all four.
        foreach (var (key, noun, extra) in ONE_LETTER)
        {
            var forms = N(noun);
            var re = JsRegex.Compile(
                $"(?<![/\\p{{L}}]){NUM}{MAG_MID_BODY}{SP}{key}{NOT_LETTER_AFTER}(?![/.]{extra})", "gu");
            t = Rewrite(t, re, m =>
            {
                var num = m.Groups[1].Value;
                var mag = m.Groups[2].Success ? m.Groups[2].Value : null;
                return mag is null
                    ? Quantity(num, forms)
                    : $"{Bare(num)}{MagWords(num, mag)} {forms.Gen}";
            });
        }

        // 8) CURRENCY — POSTPOSED, this corpus's own order in every spelled-out instance. The SIGN however
        //    is written on both sides, so both are claimed and both emit the noun after the number.
        //    ⚠ THE MAGNITUDE SITS BETWEEN THE FIGURE AND THE CURRENCY and must be claimed here, because once
        //    the number is words the later magnitude step can no longer see it. ⚠ AND THE CURRENCY IS OFTEN
        //    ALREADY SPELLED OUT BESIDE ITS SIGN (trap 12), so `SaidNear` suppresses the word.
        //    ⚠ A SPELLED-OUT MAGNITUDE IS RE-EMITTED VERBATIM (trap 10) and the currency follows it in the
        //    genitive — `$24 MILIJONUS kasmet` came out *dvidešimt keturi DOLERIAI milijonus* otherwise.
        foreach (var (sign, noun, spelled) in CURRENCIES)
        {
            var forms = N(noun);
            string Money(string num, string? mag, string tail)
            {
                var abbrev = mag is not null && ABBREV_MAG_HEAD.IsMatch(mag);
                var n = Js.Number(num.Split(',')[0]);
                var numWords = Bare(num);
                var magPart = mag is null ? "" : abbrev ? MagWords(num, mag) : $" {Js.Trim(mag)}";
                // Don't say it twice — and when the noun is already there, the whole reading is the tail's.
                if (SaidNear(tail, spelled)) return $"{numWords}{magPart} ";
                var word = mag is not null || num.Contains(',') ? forms.Gen : Numbers.Agree(n, forms);
                return $"{numWords}{magPart} {word} ";
            }

            // Sign BEFORE the figure. `US$` / `JAV $` keep their letters; only the sign is claimed.
            {
                var re = JsRegex.Compile(
                    $"{sign}{SP}*{NUM}({SP}*(?:(?:mlrd|mln|tūkst)\\.?|{MAG_SPELLED}){NOT_LETTER_AFTER})?", "gu");
                var subject = t;
                t = Rewrite(t, re, m => Money(m.Groups[1].Value,
                    m.Groups[2].Success ? m.Groups[2].Value : null,
                    NextWords(subject[(m.Index + m.Length)..])));
            }
            // Sign AFTER the figure.
            {
                var re = JsRegex.Compile(
                    $"{NUM}({SP}*(?:(?:mlrd|mln|tūkst)\\.?|{MAG_SPELLED}){NOT_LETTER_AFTER})?{SP}*{sign}{NOT_LETTER_AFTER}",
                    "gu");
                var subject = t;
                t = Rewrite(t, re, m => Money(m.Groups[1].Value,
                    m.Groups[2].Success ? m.Groups[2].Value : null,
                    NextWords(subject[(m.Index + m.Length)..])));
            }
        }

        //    ⚠ AND A CURRENCY SIGN WHOSE FIGURE THIS LAYER DECLINED IS STILL READ (#1211), for exactly the
        //    reason the magnitude mop-up below gives — and it is the worse half of the two. `55.89 mlrd €`
        //    is an English-format decimal, refused outright by the operand anchor and correctly; the
        //    magnitude was then mopped up to *milijardų* and the `€` was NOT, and because `€` is not a
        //    letter the tokenizer never emitted it. So it did not LEAK, it VANISHED: an amount read with no
        //    currency, and nothing left over for any gate to see. Refusing to read the NUMBER is not a
        //    reason to delete the unit. With no count to agree with, the genitive plural.
        //    ⚠ THE SYMBOLS ONLY, NEVER `Lt`: two letters, and a bare-`Lt` mop-up would fire on any
        //    capitalised abbreviation spelled that way, while all four corpus `Lt` carry a claimable figure
        //    already. `€ $ £` cannot be anything but currency, which is what makes them safe with no operand.
        foreach (var (sign, noun) in SIGN_ONLY)
            t = Rewrite(t, JsRegex.Compile(sign, "gu"), $" {N(noun).Gen} ");

        // 9) THE REMAINING MAGNITUDE ABBREVIATIONS, whatever the currency step did not already claim.
        //    ⚠ A MAGNITUDE GOVERNING A FOLLOWING NOUN TAKES THE GENITIVE — "19 tūkst. hektarų" against a
        //    bare "20 tūkst." ⚠ BUT "ANY LETTER" ALSO MATCHED TEXT THIS LAYER ITSELF INSERTED: step 1
        //    rewrites `pr. m. e.` to *prieš mūsų erą*, so the slot holds a PREPOSITION and the genitive fired
        //    where `Agree(4)` gives *tūkstančiai*. The exclusion is the era words themselves.
        //    ⚠ THE KEY NEEDS A WORD BOUNDARY AFTER IT: `tūkst` is five characters inside *tūkstantmetis*.
        for (var i = 0; i < MAGS.Count; i++)
        {
            var forms = MAGS[i].Forms;
            var re = JsRegex.Compile($"{NUM}{SP}*({MAGS[i].Re.Source}){NOT_LETTER_AFTER}\\.?", "gu");
            var subject = t;
            t = Rewrite(t, re, m =>
            {
                var num = m.Groups[1].Value;
                var n = Js.Number(num.Split(',')[0]);
                var end = m.Index + m.Length;
                var tail = subject[end..Math.Min(subject.Length, end + 8)];
                var governs = GOVERNS_LETTER.IsMatch(tail) && !ERA_HEAD.IsMatch(tail);
                var word = num.Contains(',') || governs ? forms.Gen : Numbers.Agree(n, forms);
                return $"{Bare(num)} {word} ";
            });
        }

        //    ⚠ AND A MAGNITUDE WHOSE FIGURE THIS LAYER DECLINED IS STILL EXPANDED. `55.89 mlrd €` is an
        //    English-format decimal, refused outright and correctly — and that left `mlrd` alone in the
        //    phoneme stream as a raw four-consonant cluster. Refusing to read the NUMBER is not a reason to
        //    hand the abbreviation back to the g2p. With no count to agree with, the genitive plural.
        for (var i = 0; i < MAGS.Count; i++)
        {
            var forms = MAGS[i].Forms;
            var re = JsRegex.Compile($"{NOT_LETTER_BEFORE}(?:{MAGS[i].Re.Source}){NOT_LETTER_AFTER}\\.?", "gu");
            t = Rewrite(t, re, $" {forms.Gen} ");
        }

        // 10) THE DATE ABBREVIATIONS — the single biggest class in this corpus, and the one whose defect is a
        //     spurious SENTENCE BREAK rather than a bad word.
        //     ⚠ `m.` before a MONTH NAME → the genitive; otherwise the instrumental. AND A SMALL OPERAND IS
        //     A QUANTITY OF YEARS, NOT A DATE — the 1–2 digit and decimal cases are life expectancies and
        //     ages, which take the genitive too.
        //     ⚠ AND THIS RULE IS DELIBERATELY CASE-SENSITIVE, WHICH INVERTS TRAP 7: a capital `M.` is a
        //     PERSONAL INITIAL in this corpus, and the initialism pass claims those instead.
        t = Rewrite(t, YEAR_RE, m =>
        {
            var num = m.Groups[1].Value;
            var month = m.Groups[2].Success ? m.Groups[2].Value : null;
            var small = !num.Contains(',') && num.Length <= 2;
            var word = month is not null || num.Contains(',') || small ? W("yearGen") : W("yearInstr");
            return $"{Bare(num)} {word}{month ?? ""} ";
        });
        //     `d.` — every one a day of the month. ⚠ *diena* IS FEMININE AND THE NUMERAL WAS NOT:
        //     `balandžio 7 d.` came out *septyni dieną*. What this does NOT fix, said plainly: the day of a
        //     date is an ORDINAL in the ACCUSATIVE, and the ordinal series is measured and refused.
        t = Rewrite(t, DAY_RE, m => $"{Feminise(Bare(m.Groups[1].Value))} {W("day")} ");
        //     `a.` — the century, and it arrives here as DIGITS: Lithuanian is not in the registry's
        //     ROMAN_NATIVE, so `XIX a.` is `19 a.` before anything in this file runs.
        t = Rewrite(t, CENTURY_RE, m => $"{Bare(m.Groups[1].Value)} {W("centuryGen")} ");
        t = Rewrite(t, HOUR_RE, m => Quantity(m.Groups[1].Value, N("hour")));
        t = Rewrite(t, MINUTE_RE, m => Quantity(m.Groups[1].Value, N("minute")));
        //     ⚠ AND THE ABBREVIATION IS EXPANDED EVEN WHEN ITS FIGURE IS A CLOCK FIELD THIS LAYER REFUSES,
        //     or the `val.` left behind goes back to being a vowel-less cluster plus a spurious break. A
        //     LEADING `/` still blocks it: `515,3 km/val.` is a RATE refused whole by the unit step.
        t = Rewrite(t, VAL_MOP, $" {N("hour").Gen} ");
        //     ⚠ AND `min.` TAKES THE SAME MOP-UP, WHICH IT DID NOT HAVE (#1211). Its rule above needs a
        //     claimable numeral, so when the figure is a duration this layer refuses — `2:11.60 min.`,
        //     `1:09.02 min.`, both in the retained text — the abbreviation was left exactly where it started
        //     and reached the g2p as *mʲɪn* plus a spurious sentence break: verbatim the defect the header
        //     records as the reason `min.` was declared at all, reintroduced by the refusal. Nothing new is
        //     sourced — the noun is this file's own `minute` entry, genitive plural for want of a count.
        t = Rewrite(t, MIN_MOP, $" {N("minute").Gen} ");
        t = Rewrite(t, MONTH_ABBREV, $" {W("month")} ");

        // 11) THE REMAINING SINGLE-DOT ABBREVIATIONS. Each currently reaches the g2p as a vowel-less cluster
        //     PLUS a spurious sentence break. ⚠ THESE KEYS WERE WRITTEN CASE- AND SPELLING-NARROW AND THE
        //     CORPUS DOES NOT COOPERATE: `Pvz., vanduo` was declined, and `psl.`'s only instance is `Psl 47`
        //     — capitalised AND with no dot, so the rule matched nothing at all while looking like it
        //     covered the class. These five require no numeral, so the case tolerance costs nothing.
        t = Rewrite(t, PVZ, $" {W("forExample")} ");
        t = Rewrite(t, IR_KT, $" {W("etCetera")} ");
        t = Rewrite(t, NR, $" {W("number")} ");
        t = Rewrite(t, PSL, $" {W("page")} ");
        t = Rewrite(t, GYV, $" {W("inhabitants")} ");

        // 12) THE DECIMAL COMMA — LAST of the number rules, because every rule above reads its operand as
        //     DIGITS and this one destroys them. That inverts the fleet's usual "de-group first" ordering:
        //     in Lithuanian the comma IS the decimal separator, so there is no grouping comma to clear.
        t = Rewrite(t, DECIMAL_COMMA,
            m => $"{m.Groups[1].Value} {W("decimalPoint")} {string.Join(" ", m.Groups[2].Value.Select(c => c.ToString()))}");

        // 13) THE AMPERSAND — dropped outright today, which FUSES its neighbours. Spaced on both sides,
        //     always. `&amp;` is decoded above this layer but is folded here for a raw-text caller.
        t = Rewrite(Rewrite(t, AMP_ENTITY, "&"), AMPERSAND, $" {W("and")} ");

        // The insertions above pad with spaces so a word never fuses with its neighbour; collapse the runs.
        return Rewrite(t, SPACE_RUN, " ");
    }

    /**
     * Can this letter run be read as a Lithuanian word at all? Deliberately conservative — the load-bearing
     * signal is the absence of a vowel, which is what every acronym this corpus leaks has in common (`TSRS`,
     * `BVP`, `DVB`, `LDK`, `JT`, `TV`, `BSD`, `FC`).
     *
     * ⚠ NO DIGRAPH FOLD IS NEEDED HERE, unlike Hungarian's `ENSZ`: Lithuanian's digraphs ⟨ch dz dž⟩ are
     * marginal and none of them appears in an acronym in this corpus.
     */
    private static readonly Func<string, bool> IsUnreadableLithuanian = Initialisms.MakeUnreadableTest(
        new PhonotacticsData
        {
            Vowels = JsRegex.Compile("[aeiouyąęėįųū]", "u"),
            // Lithuanian permits a wide range of initial clusters; these are the two-consonant onsets its
            // own vocabulary writes (pr-, kr-, sl-, šv-, žm-, kn-, dv-, tv-, kv-, gv- …).
            LegalOnsets = new HashSet<string>(new[]
            {
                "pr", "br", "tr", "dr", "kr", "gr", "pl", "bl", "kl", "gl", "sl", "sm", "sn", "sp", "st", "sk",
                "sv", "kv", "gv", "dv", "tv", "šv", "šm", "šn", "šp", "št", "šk", "žm", "žv", "žl", "zn", "kn",
                "gn", "mn", "vl", "vr", "ml", "mr", "ps", "pt", "kt", "cv", "čr",
            }, StringComparer.Ordinal),
            LegalCodas = new HashSet<string>(new[]
            {
                "rs", "rt", "rd", "rk", "rg", "rn", "rm", "rb", "ls", "lt", "ld", "lk", "lg", "lb", "ns", "nt",
                "nd", "nk", "ng", "st", "sk", "ts", "ms", "mt", "mb", "ks", "ps", "pt", "št", "žt", "kt", "nč",
            }, StringComparer.Ordinal),
        });

    private static readonly Func<string, string> InitialismNormalizer =
        Initialisms.MakeInitialismNormalizer(new InitialismData
        {
            LetterName = l => Manifest.MANIFEST.Normalization.LetterNames.TryGetValue(l, out var v) ? v : null,
            AcronymLetters = new HashSet<string>(Manifest.MANIFEST.Normalization.AcronymLetters, StringComparer.Ordinal),
            // Lithuanian has no in-engine pronunciation dictionary — the g2p is a context-free rule scan and
            // the wikipron referee is an evaluation set, not a lookup — so, as in fi/sv/de/nl, every lexical
            // fact lives in `AcronymLetters` instead.
            IsRecorded = _ => false,
            IsUnreadable = w => IsUnreadableLithuanian(w),
        });

    /**
     * THE INITIALISM PASS. ⚠ ORDERING, VERIFIED END-TO-END RATHER THAN ASSERTED. It runs AFTER
     * `NormalizeLithuanian`, so the abbreviation dots are already spent — `1802 m.` is *metais* by now and
     * not EM, and `IV a. pr. m. e.` is the era phrase and not four letter names. And it runs after the
     * shared ROMAN pass, which is not in this file at all.
     */
    public static string NormalizeLithuanianInitialisms(string text) => InitialismNormalizer(text);
}
