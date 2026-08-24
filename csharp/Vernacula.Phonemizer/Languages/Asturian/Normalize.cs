/**
 * Asturian (ast) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not
 * already a pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * EVIDENCE. `tools/corpus/mined/ast.jsonc` — ast.wikipedia dump, **1,343,097 paragraph segments**, the
 * largest artifact in the fleet. Corpus-wide counts for the classes claimed here: `year` 577,546 ·
 * `letter-name` 267,970 · `initialism` 257,306 · `abbrev` 216,569 · `ordinal-latin` 103,191 ·
 * `roman` 88,304 · `ranges` 84,805 · `decimals` 71,505 · `signs` 40,944 · `dotted` 37,753 ·
 * `grouped` 34,726 · `units` 27,763 · `percent` 17,570 · `exponent` 10,224 · `fractions` 9,623 ·
 * `clock` 8,840 · `signed-number` 8,541 · `era-marker` 8,442 · `rate` 4,727 · `degrees` 3,186 ·
 * `currency` 2,703.
 *
 * ⚠ THE DEGREE SIGN AND THE MASCULINE ORDINAL INDICATOR ARE SWAPPED, IN BOTH DIRECTIONS. `°` U+00B0 and
 * `º` U+00BA render near-identically at text size, and this corpus uses each of them for the other's job:
 *
 *     º as a DEGREE   `23ºC` · `perriba de los 30º de media` · `ente los 43º y los 42º de llatitú norte
 *                      y los 4º y los 7º de llonxitú oeste` · `un ángulu de alredor de 60º`
 *     ° as an ORDINAL `1758 - James Monroe, **5° presidente** de los Estaos Xuníos`
 *     ° as a degree   `16°C` · `44,9 °C` · `88°23' S` · `6.9 °` · `pol meridianu de 20° E`
 *
 * So NEITHER CODEPOINT IDENTIFIES THE SENSE, a codepoint-keyed rule is wrong in both directions, and a
 * fold in either direction destroys the other reading. ⚠ THE DISCRIMINATOR IS WHAT FOLLOWS, and it is
 * written as an ALLOW-LIST rather than a guess: the sign is read as a degree before a scale letter, a
 * prime-bearing minute, a compass letter, end-of-clause, or one of the connectives this corpus actually
 * writes after a bare degree (`de`, `y`, `col`, `na`). Sixteen instances qualify. The one ordinal
 * (`5° presidente`) does NOT, and is left unread rather than being told to say *cinco graos presidente*
 * — a defect that produces a READING is the worst kind (trap 56), and the status quo already drops it.
 *
 * ⚠ THE DOT GROUPS AND THE COMMA DECIMATES — the Ibero-Romance convention: `171.057 falantes`, `150.644`,
 * `20.413`, `21.035 €`, `1.012.292 €`, `17.500£`, `504.645 km²` against `0,54%`, `44,9 °C`, `38,5 °C`,
 * `1,5 y 2,5 millones`. ⚠ And the SPACE groups too (`25 000 y 35 000`), while the DOT also DECIMATES when
 * fewer than three digits follow (`132.46 km`, `6.9 °`). The three-digit test decides the dot; the comma
 * is always a decimal.
 *
 * ⚠ THE ROMAN NUMERAL IS A MONTH. `Calendariu republicanu francés (24-X-1793 - 31-XII-1805)`,
 * `Calendariu suecu (1-III-1700 - "30-II"-1711)`, `Calendariu revolucionariu soviéticu (1-X-1929 - 1940)`
 * — the day-`ROMAN`-year form. Before this layer `24-X-1793` read the `X` as the LETTER (the shared roman
 * pass declines a lone numeral) and `1-III-1700` read `III` as the bare number three. Neither is a month.
 *
 * ⚠ THERE IS NO CENTURY POLICY, and the reason is sourcing rather than grammar. `sieglu XX` is ×32 in the
 * retained text and the corpus NEVER spells one out; on the wiki `vixésimu` scores ×1 against `décimu`
 * ×27. Spanish, Galician and Catalan all have such a policy in this repo and Asturian's would be built on
 * one attestation of its commonest form. The shared cardinal pass reads `sieglu XX` as *sieglu venti*,
 * which is wrong in the same way theirs was before they were given a policy — recorded, not guessed.
 *
 * ⚠ AND A DENTAL FORMULA IS NOT A FRACTION. "según la fórmula dentaria **I 3/3, C 0-1/0-1, P 3-4/3
 * M 3/3**" — Roman-letter tooth classes with slashed counts, in the mammal articles. No fraction rule is
 * written; the `C` and `M` in that string are exactly the letters a Roman pass looks at, and the `0-1`
 * exactly what a range rule looks at.
 *
 * SOURCING — every word emitted is an ast.wikipedia TOKEN attestation whose examples were read; see
 * `tools/corpus/attest/ast.jsonc`.
 */

/** ⚠ NEVER `\b` — Asturian carries `á é í ó ú ñ ḷ ḥ`, which `\b` treats as boundaries (trap 1/23). */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Asturian;

public static class Normalize
{
    private const string NOT_BEFORE = "(?<![\\p{L}\\p{M}])";
    private const string NOT_AFTER = "(?![\\p{L}\\p{M}])";

    /** The Roman month numerals, 1–12, for the `24-X-1793` date form. Asturian month names, attested:
     *  `marzu` ×57, `xineru` ×34, `ochobre` ×27, `avientu` ×27 on ast.wikipedia. */
    private static readonly string[] MONTHS =
    {
        "", "xineru", "febreru", "marzu", "abril", "mayu", "xunu",
        "xunetu", "agostu", "setiembre", "ochobre", "payares", "avientu",
    };

    private static readonly IReadOnlyDictionary<string, int> ROMAN_MONTH = new Dictionary<string, int>(StringComparer.Ordinal)
    {
        ["I"] = 1, ["II"] = 2, ["III"] = 3, ["IV"] = 4, ["V"] = 5, ["VI"] = 6, ["VII"] = 7,
        ["VIII"] = 8, ["IX"] = 9, ["X"] = 10, ["XI"] = 11, ["XII"] = 12,
    };

    /**
     * What may follow a degree sign for it to BE a degree. Neither codepoint identifies the sense in this
     * corpus, so the continuation does: a scale letter, a compass letter, a prime-bearing minute,
     * end-of-clause, or one of four connectives.
     */
    private const string DEGREE_TAIL =
        "(?:\\s?[CF]|\\s?[NSEW]|\\s?\\d+\\s?[′']|\\s*(?:de|y|col|na)(?![\\p{L}\\p{M}])|\\s*[.,;:)»]|\\s*$)";

    private static readonly JsRe SPACE_GROUP = JsRegex.Compile(
        "(?<!\\d)(?<![\\d][.,])(\\d{1,3})((?:[    ]\\d{3})+)(?!\\d)", "gu");
    private static readonly JsRe SPACE_SEPS = JsRegex.Compile("[    ]", "gu");
    private static readonly JsRe DOT_GROUP = JsRegex.Compile(
        "(?<!\\d)(?<![\\d][.,])(\\d{1,3})((?:\\.\\d{3})+)(?!\\d)", "gu");
    private static readonly JsRe DOTS = JsRegex.Compile("\\.", "gu");
    private static readonly JsRe DOT_DECIMAL = JsRegex.Compile("(?<!\\d)(\\d+)\\.(\\d+)(?!\\d)", "gu");
    private static readonly JsRe SENTENCE_TAIL = JsRegex.Compile("^\\s*[\"»)']?\\s*$", "u");
    private static readonly List<(JsRe Re, string Word)> MULTI = new()
    {
        (JsRegex.Compile($"{NOT_BEFORE}e\\s?\\.\\s?C\\s?\\.", "gu"), "enantes de Cristu"),
        (JsRegex.Compile($"{NOT_BEFORE}d\\s?\\.\\s?C\\s?\\.", "gu"), "dempués de Cristu"),
    };
    private static readonly JsRe ROMAN_DATE = JsRegex.Compile(
        $"{NOT_BEFORE}(\\d{{1,2}})\\s?-\\s?(I{{1,3}}|IV|V|VI{{1,3}}|IX|XI{{0,2}})\\s?-\\s?(\\d{{3,4}}){NOT_AFTER}", "gu");
    private static readonly JsRe NUMERIC_DATE = JsRegex.Compile(
        $"{NOT_BEFORE}(\\d{{1,2}})\\s?-\\s?(\\d{{1,2}})\\s?-\\s?(\\d{{3,4}}){NOT_AFTER}", "gu");
    private static readonly JsRe CLOCK = JsRegex.Compile("(?<![\\d:.,])([01]?\\d|2[0-4]):([0-5]\\d)(?![\\d:.,])", "gu");
    private static readonly JsRe DEG_SCALE = JsRegex.Compile("(\\d)\\s?[°º]\\s?([CF])(?![\\p{L}\\p{M}])", "gui");
    private static readonly JsRe DEG_MIN = JsRegex.Compile("(\\d)\\s?[°º]\\s?(\\d+)\\s?[′']", "gu");
    private static readonly JsRe DEG = JsRegex.Compile($"(\\d)\\s?[°º](?={DEGREE_TAIL})", "gu");
    private static readonly JsRe MINUS = JsRegex.Compile("(^|(?<!\\d)[\\s(])[-−–]\\s?(\\d)", "gu");
    private static readonly JsRe DASH_RANGE = JsRegex.Compile("(\\d)\\s?[–—]\\s?(?=\\d)", "gu");
    private static readonly JsRe HYPHEN_RANGE = JsRegex.Compile(
        "(?<![\\d.,\\-\\/])(\\d+)\\s?-\\s?(\\d+)(?![\\d\\/])(?!\\s?-\\s?\\d)", "gu");
    private static readonly JsRe MULTI_SPACE = JsRegex.Compile("[^\\S\\n]{2,}", "gu");

    /** Normalize one Asturian input string. Pure text→text. Steps are ORDER-DEPENDENT. */
    public static string NormalizeAsturian(string input)
    {
        var s = input;

        // 1) SEPARATORS. ⚠ THREE CONVENTIONS IN ONE CORPUS. The DOT groups when exactly three digits follow
        //    it and decimates otherwise; the COMMA always decimates; the SPACE groups.
        //    ⚠ THE WHOLE NUMBER IS MATCHED AT ONCE (trap 63), and the trailing guard rejects a DIGIT and
        //    nothing else (trap 58).
        s = SPACE_GROUP.Replace(s, m => m.Groups[1].Value + SPACE_SEPS.Replace(m.Groups[2].Value, ""));
        s = DOT_GROUP.Replace(s, m => m.Groups[1].Value + DOTS.Replace(m.Groups[2].Value, ""));
        //    ⚠ AND WHAT IS LEFT CARRYING A DOT IS A DECIMAL. Doing it in the other order would turn every
        //    grouped figure into a decimal.
        s = DOT_DECIMAL.Replace(s, "$1,$2");

        // 2) THE ERA MARKER. `e.C.` / `d.C.`, both spacings, letter-by-letter with two false clause pauses
        //    each. The final dot is kept at a sentence end (trap 10).
        foreach (var (re, word) in MULTI)
        {
            var frozen = s;
            s = re.Replace(s, m =>
            {
                var rest = frozen[(m.Index + m.Value.Length)..];
                return SENTENCE_TAIL.IsMatch(rest) ? $"{word}." : word;
            });
        }

        // 3) THE ROMAN-MONTH DATE, before any range rule spends its hyphens. ⚠ THE ROMAN NUMERAL IS BOUNDED
        //    AT 12 AND MUST BE — that is the whole of what distinguishes a month from the year it sits
        //    between. The shared roman pass has already declined the lone `X`.
        s = ROMAN_DATE.Replace(s, m =>
        {
            if (!ROMAN_MONTH.TryGetValue(m.Groups[2].Value, out var mon)) return m.Value;
            return $"{m.Groups[1].Value} de {MONTHS[mon]} de {m.Groups[3].Value}";
        });

        // 3b) …AND THE SAME DATE ONCE THE SHARED ROMAN PASS HAS ALREADY EATEN IT: `1-III-1700` arrives here
        //     as `1-3-1700` while `24-X-1793` arrives intact. The month bound of 12 keeps this off an
        //     ordinary hyphen-joined trio; the 3-or-4-digit year keeps it off a dental formula's `0-1/0-1`.
        s = NUMERIC_DATE.Replace(s, m =>
        {
            var mon = Js.Number(m.Groups[2].Value);
            return mon >= 1 && mon <= 12
                ? $"{m.Groups[1].Value} de {MONTHS[(int)mon]} de {m.Groups[3].Value}"
                : m.Value;
        });

        // 4) THE CLOCK. The colon is clause punctuation, so `23:40 h.` read as *ventitrés , cuarenta*.
        //    The corpus writes the hour word after it, so the figures are left as FIGURES and only the
        //    colon is spent.
        s = CLOCK.Replace(s, "$1 $2");

        // 5) DEGREES — and the allow-listed continuation is the whole of the rule: `°` and `º` are used for
        //    each other's job in this corpus, so the sign is read as a degree only before one of the shapes
        //    that follows a real degree here, and the lone ordinal (`5° presidente`) falls through unread.
        s = DEG_SCALE.Replace(s, m =>
            $"{m.Groups[1].Value} graos {(m.Groups[2].Value.ToUpperInvariant() == "C" ? "Celsius" : "Fahrenheit")}");
        s = DEG_MIN.Replace(s, "$1 graos $2 minutos ");
        s = DEG.Replace(s, "$1 graos ");

        // 6) SIGNS. The minus INVERTS; the corpus's `-` before a figure is otherwise a range or a date.
        s = MINUS.Replace(s, "$1menos $2");

        // 7) RANGES. ⚠ THE DASH IS SPENT ON A PAUSE RATHER THAN A CONNECTIVE: Asturian writes `ente X y M`
        //    in full where it means it. ⚠ NOTHING MAY BE REQUIRED AFTER THE SECOND NUMBER (trap 58).
        s = DASH_RANGE.Replace(s, "$1, ");
        //    ⚠ AND THE SLASH IS PART OF THE GUARD: the dental formula writes `C 0-1/0-1`, where each `0-1`
        //    is a hyphenated pair flanked by a slash.
        s = HYPHEN_RANGE.Replace(s, "$1, $2");

        // A padded replacement doubles a space that was already there. SLOT-GAP is a defect class and this
        // pass should not be the one producing candidates for it.
        return MULTI_SPACE.Replace(s, " ");
    }
}
