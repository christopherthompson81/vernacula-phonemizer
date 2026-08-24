/**
 * Shared MARKUP stripping — render HTML to the text it stands for, before any engine sees it.
 *
 * A phonemizer handed `<i>` should render it, not read it, so this is the engine's problem to absorb rather
 * than the caller's to pre-clean: left alone, tags reach the phoneme stream and are SPOKEN (`km<sup>2</sup>`
 * came out as "sup … sup"). Applied at the single dispatch point in the registry, like the Roman-numeral pass,
 * so it reaches every engine instead of being reimplemented per language.
 *
 * ⚠ ORDER: tags are stripped BEFORE entities are decoded. The other way round, `&lt;i&gt;` — an author writing
 * ABOUT a tag, which must stay literal — would decode to `<i>` and then be stripped as markup.
 */

using System.Text;

namespace Vernacula.Phonemizer.Core;

public static class Markup
{
    /** The named entities that actually occur, plus the handful any text realistically carries. */
    private static readonly IReadOnlyDictionary<string, string> NAMED = new Dictionary<string, string>
    {
        ["amp"] = "&",
        ["lt"] = "<",
        ["gt"] = ">",
        ["quot"] = "\"",
        ["apos"] = "'",
        ["nbsp"] = "\u00a0",
        ["laquo"] = "«",
        ["raquo"] = "»",
        ["ldquo"] = "“",
        ["rdquo"] = "”",
        ["lsquo"] = "‘",
        ["rsquo"] = "’",
        ["hellip"] = "…",
        ["ndash"] = "–",
        ["mdash"] = "—",
        ["deg"] = "°",
        ["times"] = "×",
        ["middot"] = "·",
        ["euro"] = "€",
        ["pound"] = "£",
        ["yen"] = "¥",
        // An unknown entity is deliberately left literal (see the decoder), which is right for a name nothing can
        // render. These are listed because each maps to a character the engine ALREADY reads, and the NUMERIC forms
        // (`&#178;` → `²`) already worked — so leaving the named ones literal sent "km ampersand sup two semicolon"
        // to the phoneme stream. Each pairs with the machinery that reads it: sup1-3 → exponent rules, frac →
        // vulgar-fraction fold, minus/plusmn → sign rules, cent/micro/permil → symbol tier.
        ["sup1"] = "¹",
        ["sup2"] = "²",
        ["sup3"] = "³",
        ["frac12"] = "½",
        ["frac14"] = "¼",
        ["frac34"] = "¾",
        ["minus"] = "−",
        ["plusmn"] = "±",
        ["micro"] = "µ",
        ["permil"] = "‰",
        ["cent"] = "¢",

        // ── THE SPACE FAMILY — DECODED FAITHFULLY SINCE #935 ────────────────────────────────────────────
        // ⚠ THIS USED TO BE A DELIBERATE INFIDELITY: `nbsp` and `thinsp` folded to an ASCII space because 42 of
        // the 188 engines de-grouped a thousands separator ONLY on U+0020 — their grouping classes were `[ ]`,
        // not `[ \u00a0\u202f\u2009]` — so decoding faithfully read `1 904 569` as three numbers in all 42.
        // The comment then said the general fix belonged in the engines' grouping classes, not here. It did, and
        // that is what #925 and #935 did: the classes were widened fleet-wide and the population re-measured
        // BEHAVIOURALLY (every engine × the four space characters, not by reading source). 57 engines differed;
        // now 1 does, and not by losing a numeral — Tibetan's tokenizer treats an ASCII space as a phrase
        // boundary, so the ASCII form gains pauses the NBSP form does not. Both read every digit.
        // ⚠ `&bull;` STAYS A SPACE, and for its own unrelated reason. U+2022 is read by NOTHING — it is silent
        // in all 188 — so a faithful decode would trade the audible-but-wrong *and bull* for a silent deletion.
        // A bullet is a list marker whose reading IS a break, which is what a space already gives;
        // `languages/quechua` reached the same conclusion locally on the same corpus instance
        // (`&nbsp;&bull; 100 ¢ = 1 $`).
        ["thinsp"] = "\u2009",
        ["bull"] = " ",

        // ── THE INVISIBLE FORMATTING CONTROLS — decoded FAITHFULLY, because the fleet strips them ──────────
        // ⚠ THE HAZARD HERE IS THE OPPOSITE ONE: these decode to characters that render as nothing, so
        // decoding is right only if the engines then strip them — otherwise a visible literal becomes an
        // invisible defect, and `ZERO-WIDTH` is a leak class precisely because that is a real failure mode.
        // Measured before adding, all 188 engines × both characters: ZERO leaks. U+200C additionally does the
        // ONE thing it means in 26 Indic engines — it suppresses the join without inserting a break — so the
        // faithful decode is also the more correct one. Left literal they were spoken: kaa's Persian gloss
        // `فضل&zwnj;الله` read *zwnʒ*, and pnb's `&lrm;` read *lˈɝm* (a leak no gate can see — the IPA token is
        // not byte-identical to the source run, so the raw-Latin differential never fires).
        ["lrm"] = "\u200e",
        ["zwnj"] = "\u200c",

        // ── PRECOMPOSED ACCENTED LATIN — readable only since the accent work, which is what licenses these ──
        // These are here BECAUSE of `f269a4b` and the `latinPhone` last resort, not independently of it: before
        // that work the decoded letter was DELETED by a dozen engines, and decoding would have swapped a wrong
        // word for a missing one. Re-measured after it, all 188 engines: each letter is READ in 186-188 of them.
        // oc is the corpus that needs them — its dump escapes the accent inside ordinary words, so the entity
        // sits mid-token and the literal is not merely wrong, it SHATTERS the word:
        //     `fon&ccedil;age`   *fu ksedil , ad͡ʒe*  → *funsad͡ʒe*      `p&egrave;s`  *p eɡɾabe , s* → *pɛs*
        //     `peri&ograve;de`   *peɾi uɡɾabe , de*  → *peɾjɔde*        `N&ograve;rd` *n uɡɾabe , ɾt* → *nɔɾt*
        // ps is the same shape in a Perso-Arabic dump (`trypa&ocirc;` *tɹˈɪpə ˈʌʃəɚk* → *tɹˈaᶦpʰaᶷ*).
        ["aacute"] = "á",
        ["agrave"] = "à",
        ["ccedil"] = "ç",
        ["eacute"] = "é",
        ["egrave"] = "è",
        ["ecirc"] = "ê",
        ["iacute"] = "í",
        ["icirc"] = "î",
        ["ocirc"] = "ô",
        ["ograve"] = "ò",

        // ⚠ DELIBERATELY ABSENT, THOUGH ALL NINE OCCUR IN THE MINED CORPORA — `&fnof;` (lo), `&gamma;` (gd),
        // `&phi;` `&lambda;` (sn), `&Pi;` `&alpha;` `&nu;` (si), `&real;` `&image;` (yo). The test for a row
        // here is not "does it occur", it is "does the engine READ what it decodes to", and these fail it:
        //   · `ℜ` `ℑ` are read by NOTHING, not even el — silent in all 188. Decoding trades yo's audible
        //     *ati real* for a deletion, which is the `<sub>` trap below in another costume.
        //   · `ƒ` is WORSE than silent: it survives into the IPA in 93 of 188 engines, lo among them, so
        //     decoding `&fnof;(x)` swaps a spoken *fnˈɔː* for a raw U+0192 in the phoneme stream.
        //   · The Greek letters split on CONTEXT, which a per-entity table cannot express. A RUN of two or
        //     more is routed to the Greek reader by the script router and read correctly everywhere — si's
        //     `&Pi;&alpha;&nu;` would go from six spurious words (*sahə pʰaᶦ , sahə æɫfə , sahə nuː*) to *pan*
        //     — but a LONE letter is silently deleted in 186 of 188, which is gd's `&gamma;-iarann` and both
        //     of sn's. Adding the three that happen to occur in a run and not the three that do not would make
        //     the decoder's behaviour depend on which letters a corpus reached for. The defect worth fixing is
        //     the lone-letter deletion, and it lives in the foreign/router fall-through, not in this table.
    };

    /**
     * LaTeX CONTROL SEQUENCES, as MediaWiki's `<math>` leaves them: `{\displaystyle W={\frac {Rv+Cm}{v+m}}}` was
     * recited as English (*dˈʌbəɫjuː dɪsplˈeᶦstaᶦɫ …*). Audible garbage rather than a dropped sign, and worse for it.
     *
     * A backslash followed by letters is never natural prose in these orthographies, so the pattern cannot reach
     * real text.
     *
     * ⚠ BRACES ARE STRIPPED ONLY WHEN A COMMAND WAS PRESENT. `{\frac {Rv+Cm}{v+m}}` is a math group whose braces
     * must go, but stripping `[{}]` unconditionally reaches ordinary prose (`a {curly} aside` → `a  curly  aside`).
     * The LaTeX command is what licenses treating braces as math.
     */
    private static readonly JsRe LATEX_CMD = JsRegex.Compile(@"\\[a-zA-Z]+\s?", "gu");
    /** Non-global twin for the presence test — `.test()` on a `/g` regex advances `lastIndex` and would make
     *  alternate calls disagree with themselves. */
    private static readonly JsRe HAS_LATEX = JsRegex.Compile(@"\\[a-zA-Z]+", "u");
    private static readonly JsRe MATH_BRACE = JsRegex.Compile("[{}]", "gu");

    /**
     * `<sup>` is rendered to real superscript characters BEFORE the general tag pass removes its brackets.
     *
     * ⚠ THE ORDER IS THE WHOLE POINT. Stripping `<sup>10</sup>` first leaves the digits INLINE, so
     * `2.802×10<sup>10</sup>` becomes `2.802×1010` — the exponent merges into the mantissa and no later pass can
     * recover the boundary. This is survivable for units (`km<sup>2</sup>` → `km2`, which the symbol tier accepts
     * as an ASCII exponent after a letter), which is exactly why it hides until the base is a NUMBER.
     *
     * DIGITS AND SIGNS ONLY. `4<sup>th</sup>` keeps its letters as plain text (`4th`), which the ordinal rule
     * already reads; there is no superscript `th` worth inventing.
     *
     * ⚠ `<sub>` IS DELIBERATELY NOT MAPPED. Superscripts are READ — the exponent machinery speaks them — but
     * NOTHING reads a subscript digit, so rendering `<sub>2</sub>` to `₂` takes a form that was readable and makes
     * it silent:
     *     `CO2 levels`  → *kʰˈoᶷ tʰˈuː lˈɛvəɫz*   ← flattened ASCII; the 2 is spoken
     *     `CO₂ levels`  → *kʰˈoᶷ lˈɛvəɫz*         ← "correctly" rendered; the 2 is GONE
     * A transform is only a repair if something downstream can read what it produces. If a subscript reading is
     * ever wanted, the digit words come first and the mapping second.
     */
    private static readonly IReadOnlyDictionary<string, string> SUP_MAP = new Dictionary<string, string>
    {
        ["0"] = "\u2070",
        ["1"] = "\u00b9",
        ["2"] = "\u00b2",
        ["3"] = "\u00b3",
        ["4"] = "\u2074",
        ["5"] = "\u2075",
        ["6"] = "\u2076",
        ["7"] = "\u2077",
        ["8"] = "\u2078",
        ["9"] = "\u2079",
        ["-"] = "\u207b",
        ["+"] = "\u207a",
    };
    private static readonly JsRe SUP_TAG = JsRegex.Compile(@"<sup>([+-]?\d+)<\/sup>", "giu");

    /**
     * An HTML TAG. The name must start with a letter or `/`, which is what keeps ordinary prose safe: a
     * comparison like `5 < 6` or `a < b` has a space or digit after the `<` and is never matched.
     */
    private static readonly JsRe TAG = JsRegex.Compile(@"<\/?[a-zA-Z][^<>]*>", "gu");

    /**
     * WIKITABLE SYNTAX — not HTML, but it arrives by the same route (scraped text) and was likewise SPOKEN:
     * `|bgcolor="#F3F5DE"|` read as "bgcolor equals F 3 F 5 D E", a style attribute one hex digit at a time.
     *
     * ⚠ NARROW BY DESIGN, because `|` and `!` are ordinary characters in a way `<tag>` is not. Only these shapes
     * match, each unambiguous: a line-leading `{|` and the rest of its line (the table open), `|}` (close), a
     * line-leading `|` with optional `attr="value"` pairs (cell prefix), and `||` (inline separator). A bare `|`
     * mid-sentence is left alone — more likely prose or a phonetic bar than a table.
     *
     * ⚠ THE `{|` ARM IS ANCHORED TO LINE START because it consumes TO END OF LINE. Unanchored, a stray `{|` in
     * prose (set-builder notation, a code snippet) would delete the rest of the sentence.
     *
     * ⚠ NO `!` HEADER ARMS, though wikitables do use them. `!!` and a line-leading `!` occur nowhere in the corpora,
     * while `!` is ordinary sentence punctuation everywhere — the arms would have cost `Wow!! Amazing` its clause
     * break for no measured gain. `|` is the one character here that is not also prose punctuation.
     */
    private static readonly JsRe WIKITABLE = JsRegex.Compile(
        @"^[ \t]*\{\|[^\n]*|\|\}|^[ \t]*\|(?:[a-zA-Z-]+=(?:""[^""\n]*""|'[^'\n]*'|[^|\s]+)[ \t]*)*\|?|\|\|", "gmu");
    private static readonly JsRe ENTITY = JsRegex.Compile(@"&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z][a-zA-Z0-9]*);", "gu");

    /** Port of `Number.parseInt(digits, radix)` for the entity-reference bodies. The ENTITY regex guarantees
     *  every character is a valid digit for the radix, and JS parseInt yields a DOUBLE — exact far past
     *  0x10FFFF, which is all the range check below consumes. */
    private static double ParseIntRadix(string digits, int radix)
    {
        double v = 0;
        foreach (var c in digits)
        {
            var d = c <= '9' ? c - '0' : char.ToLowerInvariant(c) - 'a' + 10;
            v = v * radix + d;
        }
        return v;
    }

    /** Port of `String.fromCodePoint(cp)` for the decoder: JS returns a LONE SURROGATE for 0xD800-0xDFFF where
     *  .NET's ConvertFromUtf32 throws — a numeric reference to a surrogate must decode here exactly as in JS. */
    private static string FromCodePoint(int cp) =>
        cp is >= 0xD800 and <= 0xDFFF ? ((char)cp).ToString() : Js.FromCodePoint(cp);

    /** Strip HTML tags and decode character entities. Pure text→text; a string containing neither is
     *  returned unchanged, and the fast path makes that the common case. */
    public static string StripMarkup(string text)
    {
        if (
            !text.Contains('<') &&
            !text.Contains('&') &&
            !text.Contains('|') &&
            !text.Contains('!') &&
            !text.Contains('\\') &&
            !text.Contains('{') &&
            !text.Contains('}')
        )
            return text;
        // Wikitable first: a cell's contents may themselves be HTML, and the cell prefix is what hides them.
        // Then sup/sub, which must precede the general TAG pass — that pass deletes their brackets and leaves the
        // digits inline, which is exactly the flattening described above.
        // Braces only when a LaTeX command licensed it — see LATEX_CMD.
        var deLatex = HAS_LATEX.IsMatch(text) ? MATH_BRACE.Replace(LATEX_CMD.Replace(text, " "), " ") : text;
        var s = WIKITABLE.Replace(deLatex, " ");
        s = SUP_TAG.Replace(s, m =>
        {
            var d = m.Groups[1].Value;
            var sb = new StringBuilder();
            foreach (var c in Js.CodePoints(d)) sb.Append(SUP_MAP.TryGetValue(c, out var sup) ? sup : c);
            return sb.ToString();
        });
        s = TAG.Replace(s, "");
        return ENTITY.Replace(s, m =>
        {
            var whole = m.Value;
            var body = m.Groups[1].Value;
            if (body.StartsWith("#", StringComparison.Ordinal))
            {
                var cp =
                    body[1] == 'x' || body[1] == 'X'
                        ? ParseIntRadix(body[2..], 16)
                        : ParseIntRadix(body[1..], 10);
                // An out-of-range or unparseable reference is left as written rather than replaced with a
                // replacement character, so nothing is silently invented.
                return double.IsFinite(cp) && cp > 0 && cp <= 0x10ffff ? FromCodePoint((int)cp) : whole;
            }
            return NAMED.TryGetValue(body.ToLowerInvariant(), out var named) ? named : whole; // an unknown entity stays literal
        });
    }
}
