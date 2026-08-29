/**
 * Balochi (bal) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything the Balochi g2p
 * cannot already read into Balochi words the existing pipeline speaks. Pure text→text, no IPA.
 * Ported from src/languages/balochi/normalize.ts — see that file for the corpus evidence, the
 * attestation of every fold, and the ordering constraints between the rules.
 */
using System.Text;
using Vernacula.Phonemizer.Core;
using static Vernacula.Phonemizer.Core.Rewriter;

namespace Vernacula.Phonemizer.Languages.Balochi;

public static class Normalize
{
    /** Every digit the corpus writes, written out rather than \d (ASCII-only would miss most of this
     *  language's digit runs). Must agree with the engine's number token, \d+ after the registry's
     *  native-digit fold. */
    private const string D = "0-9\u06F0-\u06F9\u0660-\u0669";
    private const string AR = "\\u0620-\\u06FF\\u0750-\\u077F";

    /** Harakat and the other combining marks the corpus writes. Stripped only for a LEXICON LOOKUP. */
    private static readonly JsRe HARAKAT =
        JsRegex.Compile("[\u064B-\u0652\u0654\u0655\u0670\u065A\u06D6-\u06ED]", "gu");

    private static readonly JsRe HTML_ENTITY = JsRegex.Compile("&nbsp;|&#(?:x[0-9a-f]+|\\d+);", "giu");
    private static readonly JsRe ZERO_WIDTH = JsRegex.Compile("[\u200D\uFEFF\u200B]", "gu");
    private static readonly JsRe PRESENTATION = JsRegex.Compile("[\uFB50-\uFDFF\uFE70-\uFEFF]", "gu");
    private static readonly JsRe WORD = JsRegex.Compile($"[{AR}\u200C]+", "gu");

    /** Orthographic variants of letters the manifest already has — a different spelling of the same
     *  sound, which is what makes folding it safe. */
    private static readonly (string From, string To)[] EXACT =
    {
        ("ہ", "ه"), ("ۀ", "ه"), ("ة", "ه"),
        ("ګ", "گ"),
        ("ك", "ک"), ("ي", "ی"),
        ("ؤ", "و"), ("ۇ", "و"), ("ۈ", "و"),
        ("أ", "ا"), ("إ", "ا"), ("ٱ", "ا"),
        ("ۓ", "ے"), ("ې", "ے"), ("ێ", "ے"),
        ("ۆ", "ۏ"),
        ("ډ", "ڈ"), ("ټ", "ٹ"), ("ړ", "ڑ"),
    };

    /** The second fold: it exists ONLY to reach the lexicon, keyed on the Pakistan-alphabet spellings.
     *  Kept only when the lexicon knows the result. */
    private static readonly (string From, string To)[] TO_LEXICON =
    {
        ("ݔ", "ی"), ("ۏ", "و"), ("ے", "ی"),
    };

    /** What may sit between the two letters of an era abbreviation — the tatweel is why this is a
     *  constant. */
    private const string ERA_SEP = "[ـ\\s]*\\.?[ـ\\s]*";

    /** The era abbreviations, digit-anchored; the expansions are the corpus's own words. */
    private static readonly (string Body, string Word)[] ERA =
    {
        ($"[ھه]{ERA_SEP}ق", "هجری کمری"),
        ($"ق{ERA_SEP}م", "پیش چه میلاد"),
    };

    /** The SI length units. Longest key first — `m` must not win over `mm` or the `km` tail. */
    private static readonly (string Abbr, string Word)[] UNITS =
    {
        // ZWNJ inside the word — the joiner form keeps it ONE token.
        ("mm", "میلی‌متر"),
        ("km", "کیلومتر"),
        ("m", "متر"),
    };

    private static readonly Func<string, string> BARE_UNITS =
        NormalizeSymbols.MakeBareUnitNormalizer(UNITS.Select(u => new KeyValuePair<string, string>(u.Abbr, u.Word)));

    private static string ApplyAll(string w, (string From, string To)[] table)
    {
        var outp = w;
        foreach (var (from, to) in table) outp = outp.Replace(from, to, StringComparison.Ordinal);
        return outp;
    }

    /// <summary>Build the Balochi normalizer. `knownWord` answers "is this exact Arabic-script spelling a
    /// headword of the cross-script lexicon?" — supplied by the engine, which owns the lexicon.</summary>
    public static Func<string, string> MakeBalochiNormalizer(Func<string, bool> knownWord) => input =>
    {
        // 1) NFC at the entry: the text mixes precomposed and decomposed forms, so a rule keyed on a
        //    literal would otherwise match a fraction of its instances. The engine NFCs again downstream,
        //    so this costs nothing.
        var s = Renormalize(input, NormalizationForm.FormC);

        // 2) HTML entities and the zero-width characters that are NOT orthography. ⚠ ZWJ IS REMOVED AND
        //    ZWNJ IS NOT, and the asymmetry is the engine's token class rather than a judgement about
        //    Balochi: the word class contains U+200C but not U+200D.
        s = Rewrite(Rewrite(s, HTML_ENTITY, " "), ZERO_WIDTH, "");

        // 3) ARABIC PRESENTATION FORMS, NFKC PER CHARACTER over a curated range — never a blanket
        //    s.Normalize("NFKC"), which would fold ² and ¾ along with the forms.
        s = Rewrite(s, PRESENTATION, m => m.Value.Normalize(NormalizationForm.FormKC));

        // 4) THE ORTHOGRAPHIC VARIANT FOLD — WORD-WISE AND LEXICON-FIRST, in four steps: a word the
        //    lexicon already knows is left alone; otherwise the harakat are stripped and the lexicon
        //    asked again; otherwise the Pakistan-alphabet respelling is tried and kept only if it hits;
        //    otherwise only the EXACT-value folds are applied.
        s = Rewrite(s, WORD, m =>
        {
            var w = m.Value;
            if (knownWord(w)) return w;
            var bare = HARAKAT.Replace(w, "");
            if (knownWord(bare)) return bare;
            var lex = ApplyAll(ApplyAll(bare, EXACT), TO_LEXICON);
            if (knownWord(lex)) return lex;
            return ApplyAll(w, EXACT);
        });

        // 5) DIGIT DE-GROUPING, before every other numeric rule. The leading guard keeps a year list out;
        //    the trailing guard excludes a following separator+digit.
        foreach (var mark in new[] { "،", ",", "٬" })
        {
            s = Rewrite(s, JsRegex.Compile(
                    $"(?<![{D}.,،٬])[{D}]{{1,3}}(?:(?<!(?<![{D}])0){mark}[{D}]{{3}})+(?![{D}]|{mark}[{D}])", "gu"),
                m => m.Value.Replace(mark, "", StringComparison.Ordinal));
        }

        // 6) ERA MARKERS, digit-anchored. The abbreviation's own trailing dot is consumed.
        foreach (var (body, word) in ERA)
        {
            s = Rewrite(s, JsRegex.Compile($"(?<=[{D}])[ـ\\s]*{body}{ERA_SEP}\\.?", "gu"), $" {word}");
            s = Rewrite(s, JsRegex.Compile($"{Boundaries.NOT_LETTER_BEFORE}{body}{ERA_SEP}\\.?\\s*(?=[{D}])", "gu"), $"{word} ");
        }

        // 7) SI LENGTH UNITS, before the decimal step: it must run while the number is intact.
        //    ⚠ THE SAME UNITS STANDING ALONE get the shared bare-unit pass.
        s = BARE_UNITS(s);
        foreach (var (abbr, word) in UNITS)
        {
            s = Rewrite(s, JsRegex.Compile(
                    $"(?<![{D}.,٫])([{D}]+(?:[.٫][{D}]+)?)[ \u00A0\u202F\u2009]?{abbr}(?![\\p{{L}}\\p{{M}}\u200C²³/])", "giu"),
                m => $"{m.Groups[1].Value} {word}");
        }

        // 8) DECIMALS, LAST, because every rule above needs the number intact — and the separator is
        //    replaced by a SPACE, never deleted.
        s = Rewrite(s, JsRegex.Compile($"(?<![{D}.])([{D}]+)\\.([{D}]+)(?![{D}]|\\.[{D}])", "gu"),
            m => $"{m.Groups[1].Value} {m.Groups[2].Value}");

        return s;
    };
}
