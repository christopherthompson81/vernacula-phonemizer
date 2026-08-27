/**
 * Bambara (bm) text normalization — the pre-tokenizer pass. Every rule emits DIGITS wherever a number is
 * involved and lets the engine's own number path speak them, so this layer carries no number words.
 *
 * Ported from src/languages/bambara/normalize.ts, whose 115-line header and per-step notes carry the corpus
 * counts behind every word, every guard and every refusal — the homoglyph census, the elision/pronoun-mark
 * split, why no one-letter unit key is declared, why `kg` keeps leaking visibly, and the `kɛnɛ`/`kɛmɛsarada`
 * collocations. Nothing is re-derived here.
 */
using System.Text;
using System.Text.RegularExpressions;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Bambara;

public static class Normalize
{
    /** ⚠ THE UNIT NOUN COMES BEFORE THE NUMBER IN BAMBARA, which is why these are local and not the shared
     *  tier's — `NormalizeSymbols` can only postpose. The symbol is nevertheless written after the figure,
     *  so the rewrite REORDERS. Longest key first: `km²`/`km2` must be tried before `km`, or the exponent is
     *  orphaned as a number. */
    private static readonly (string Sym, string Word)[] UNITS =
    [
        ("km²", "kilomɛtɛrɛ kɛnɛ"), ("km2", "kilomɛtɛrɛ kɛnɛ"),
        ("m²", "mɛtɛrɛ kɛnɛ"), ("m2", "mɛtɛrɛ kɛnɛ"),
        ("km", "kilomɛtɛrɛ"), ("cm", "santimɛtɛrɛ"), ("mm", "milimɛtɛrɛ"),
    ];

    private static readonly Func<string, string> BARE_UNITS = NormalizeSymbols.MakeBareUnitNormalizer(
        UNITS.Select(u => new KeyValuePair<string, string>(u.Sym, u.Word)));

    /** A magnitude word may stand between the figure and its unit, and the unit rule has to hop it or the
     *  adjacency it matches on is not there. Left in place, not consumed — they are ordinary words already. */
    private const string MAG = "million|milion|miliyon|miliyɔn|milyɔn|miliyar|milyar";

    private static readonly JsRe RANGE = JsRegex.Compile(
        "(?<![\\d.,:\\p{L}\\p{M}-])(\\d+)\\s?[-–—]\\s?(\\d+)(?![\\d\\p{L}\\p{M}-]|,\\d)", "gu");

    /** ⚠ CONSONANT + APOSTROPHE + VOWEL ONLY. The same mark is also used in this wiki's non-standard oral
     *  transcription to split a PRONOUN off the following word, where gluing would fuse two words into one;
     *  every one of those has a VOWEL on the left and every genuine elision a CONSONANT. */
    private static readonly JsRe ELISION =
        JsRegex.Compile("(?<![\\p{L}\\p{M}])([bcdfghjklmnprstwyzɲŋ])['’ʼ]([aeɛiɔou])", "giu");

    /**
     * Expand an abbreviation whose OWN trailing dot is ambiguous with the sentence period: the dot is
     * consumed only when the sentence visibly continues, so a real pause is never deleted.
     */
    private static string ExpandDotted(string s, string body, string word)
    {
        var atEnd = JsRegex.Compile($"(?<![\\p{{L}}\\p{{M}}]){body}\\.(?=[ \\u00a0]*(?:$|\\p{{Lu}}))", "gu");
        var inline = JsRegex.Compile($"(?<![\\p{{L}}\\p{{M}}]){body}\\.", "gu");
        return inline.Replace(atEnd.Replace(s, $"{word}."), word);
    }

    /** Homoglyphs for Bambara's non-ASCII letters — none of ⟨ɛ ɔ ɲ⟩ is on a French AZERTY keyboard, so the
     *  wiki's writers reach for look-alikes and the tokenizer then ENDS THE WORD at the character, dropping
     *  it. ⟨ʃ⟩ U+0283 is deliberately absent: ×3, and its target is genuinely uncertain. */
    private static readonly Dictionary<string, string> HOMOGLYPH =
        new() { ["ε"] = "ɛ", ["ԑ"] = "ɛ", ["ᴐ"] = "ɔ", ["ɳ"] = "ɲ" };
    private static readonly JsRe HOMOGLYPH_RE =
        JsRegex.Compile($"[{string.Concat(HOMOGLYPH.Keys)}]", "gu");

    private static readonly JsRe ENTITIES = JsRegex.Compile("&nbsp;|&#(?:x[0-9a-f]+|\\d+);", "giu");
    private static readonly JsRe ZERO_WIDTH =
        JsRegex.Compile("[\\u200b\\u200c\\u200d\\u2060\\ufeff]", "gu");

    private static readonly JsRe INITIALISM = JsRegex.Compile(
        "(?<![\\p{L}\\p{M}.])((?:\\p{L}\\.){2,4})(?!\\p{L}\\.)(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe DOTS = JsRegex.Compile("\\.", "gu");
    private static readonly JsRe SENTENCE_CONTINUES = JsRegex.Compile("^[ \\u00a0]*(?:$|\\p{Lu})", "u");

    private static readonly JsRe ISBN = JsRegex.Compile(
        "(?<![\\p{L}\\p{M}])(ISBN(?:[- ]1[03])?)\\s*:?\\s*(\\d[\\d– -]*[\\dXx])", "gu");
    private static readonly JsRe ISBN_SEP = JsRegex.Compile("[– -]", "gu");

    private static readonly JsRe GROUP_COMMA =
        JsRegex.Compile("(?<![\\d.,])([1-9]\\d{0,2})((?:,\\d{3})+)(?![\\d]|,\\d)", "gu");
    private static readonly JsRe COMMAS = JsRegex.Compile(",", "gu");
    private static readonly JsRe GROUP_DOT =
        JsRegex.Compile("(?<![\\d.,])([1-9]\\d{0,2})((?:\\.\\d{3})+)(?![\\d]|\\.\\d)", "gu");
    // space, NBSP, NNBSP, thin space
    private static readonly JsRe GROUP_SPACE = JsRegex.Compile(
        "(?<![\\d.,])([1-9]\\d{0,2})((?:[ \\u00a0\\u202f\\u2009]\\d{3})+)(?![\\d]| \\d)", "gu");
    private static readonly JsRe SPACES = JsRegex.Compile("[ \\u00a0\\u202f\\u2009]", "gu");

    private static readonly JsRe LIT = JsRegex.Compile("[.*+?^${}()|[\\]\\\\]", "gu");

    private static readonly JsRe PERCENT =
        JsRegex.Compile("(\\d+(?:[.,]\\d+)?(?:\\s\\p{L}+)?)\\s?%", "gu");
    private static readonly JsRe PCT_NAMED =
        JsRegex.Compile($"(?:kɛmɛ ?sarada?)(?:\\s+(?:{MAG}))?\\s*$", "iu");
    private static readonly JsRe WORD_OR_DIGIT = JsRegex.Compile("[\\p{L}\\p{M}\\p{Nd}]", "u");

    private static readonly JsRe CURRENCY = JsRegex.Compile("(?<![\\p{L}\\p{M}])(US\\s?)?\\$\\s?(\\d)", "giu");
    private static readonly JsRe CUR_NAMED =
        JsRegex.Compile($"(?:dolar|dollars?|wari)(?:\\s+(?:{MAG}|wari))*\\s*$", "iu");

    private static readonly JsRe DECIMAL_ =
        JsRegex.Compile("(?<![\\d.,])(\\d+)[.,](\\d+)(?![\\d.,\\p{L}\\p{M}])", "gu");
    private static readonly JsRe AMPERSAND = JsRegex.Compile("\\s?&\\s?", "gu");

    public static string NormalizeBambara(string input)
    {
        // 1) NFC at the entry, so a literal in this file matches whichever normalization the corpus used —
        //    the era literal `K.Ɲ.` sits beside text full of `è ò ô é`, which do decompose.
        var s = input.Normalize(NormalizationForm.FormC);

        // 2) Entities and zero-width marks, BEFORE the ampersand rule at step 12, or `&nbsp;` is read as
        //    "and" followed by the letters n-b-s-p.
        s = ZERO_WIDTH.Replace(ENTITIES.Replace(s, " "), "");

        // 2b) ⚠ HOMOGLYPHS BEFORE ANY RULE THAT INSPECTS A LETTER: the elision rule has ⟨ɛ ɔ⟩ in its vowel
        //     class and the unit and range rules read letter boundaries, so a word still carrying a Greek
        //     epsilon is invisible to all of them in the way it is invisible to the tokenizer.
        s = HOMOGLYPH_RE.Replace(s, m => HOMOGLYPH[m.Value]);

        // 3) The elision apostrophe. Before step 4, so a name like `d'A.R.P.` cannot present the dotted rule
        //    with a stray consonant token.
        s = ELISION.Replace(s, "$1$2");

        // 4) Era marker, then dotted initialisms — before anything can read an interior dot as a phrase
        //    break, and before step 6, the other rule here that looks at dots.
        s = ExpandDotted(s, "K\\.Ɲ", "Krisita ɲɛ");

        //    ⚠ THE GENERIC RULE ONLY REMOVES THE DOTS — reading the letters is blocked at the data layer (no
        //    letter-name table exists for bm), so it fixes the spurious pause and leaves the letters.
        //    ⚠ CAPPED AT FOUR GROUPS WITH A LOOKAHEAD THAT REFUSES A LONGER RUN: the corpus has one 27-group
        //    line (the alphabet, `A.B.C.…Z.`), and `{2,4}` alone would eat four letters and leave 23 dots.
        var all4 = s;
        s = INITIALISM.Replace(s, m =>
        {
            var body = DOTS.Replace(m.Value, "");
            var rest = all4[(m.Index + m.Length)..];
            return SENTENCE_CONTINUES.IsMatch(rest) ? $"{body}." : body;
        });

        // 5) ISBN, before every numeric rule — an identifier is read DIGIT BY DIGIT, not as a quantity.
        //    ⚠ MUST PRECEDE THE RANGE RULE: its chain guard already rejects these, but claiming the
        //    identifier whole removes the question rather than resting it on one lookahead.
        s = ISBN.Replace(s, m =>
            $"{m.Groups[1].Value} {string.Join(" ", Js.CodePoints(ISBN_SEP.Replace(m.Groups[2].Value, "")))}");

        // 6) DIGIT DE-GROUPING, before every other numeric rule — a grouping mark is otherwise read as clause
        //    punctuation and the tail as a separate number. ⚠ EXACTLY THREE DIGITS PER GROUP is the whole
        //    discriminator, because both marks are also this corpus's decimal separators.
        //    ⚠ THE TRAILING GUARD EXCLUDES A FOLLOWING SEPARATOR+DIGIT, NOT A CLAUSE MARK: a plain
        //    `(?![\d.,])` refuses to de-group a number followed by its own sentence comma.
        s = GROUP_COMMA.Replace(s, m => COMMAS.Replace(m.Value, ""));
        s = GROUP_DOT.Replace(s, m => DOTS.Replace(m.Value, ""));
        s = GROUP_SPACE.Replace(s, m => SPACES.Replace(m.Value, ""));

        // 7) UNITS, before decimals — the number-unit adjacency is destroyed the moment a decimal is
        //    rewritten into spaced digits — and after de-grouping so `103 000 km2` is already one token.
        //    ⚠ CASE-INSENSITIVE, MEASURED: the corpus writes `13000 Km2` with a capital K.
        //    ⚠ THE OPERAND MUST INCLUDE ITS OWN DECIMAL TAIL, or the rule matches the FRACTIONAL part.
        //    ⚠ A SPAN TAKES ITS UNIT ONCE, IN FRONT, and that arm must run HERE rather than after step 8,
        //    which would already have spent the dash.
        foreach (var (sym, word) in UNITS)
        {
            var key = LIT.Replace(sym, m => "\\" + m.Value);
            s = JsRegex.Compile(
                    $"(?<![\\d.,:\\p{{L}}\\p{{M}}-])(\\d+)\\s?[-–—]\\s?(\\d+)\\s?{key}(?![\\p{{L}}\\p{{M}}\\d])",
                    "giu")
                .Replace(s, m =>
                {
                    var a = m.Groups[1].Value;
                    var b = m.Groups[2].Value;
                    return Js.Number(a) < Js.Number(b) ? $"{word} {a} fo {b}" : m.Value;
                });
            // ⚠ AND THE SINGLE-OPERAND ARM MUST REFUSE A SPAN'S SECOND HALF: a descending or chained span the
            // arm above just declined must reach RANGE whole, not with its tail already rewritten.
            s = JsRegex.Compile(
                    $"(?<![\\p{{L}}\\p{{M}}\\d.,])(?<!\\d\\s?[-–—]\\s?)(\\d+(?:[.,]\\d+)?)(\\s+(?:{MAG}))?\\s?{key}"
                    + "(?![\\p{L}\\p{M}\\d])",
                    "giu")
                .Replace(s, m =>
                    $"{word} {m.Groups[1].Value}{(m.Groups[2].Success ? m.Groups[2].Value : "")}");
        }
        // …and the ones with NO numeral at all. Last, so the counted arms keep every match they can make.
        s = BARE_UNITS(s);

        // 8) RANGES, before percent — a range OF percents must be claimed while both operands are still bare
        //    digits. Non-ascending pairs are deliberately left as the bare juxtaposition they already were.
        s = RANGE.Replace(s, m =>
        {
            var a = m.Groups[1].Value;
            var b = m.Groups[2].Value;
            return Js.Number(a) < Js.Number(b) ? $"{a} fo {b}" : m.Value;
        });

        // 9) PERCENT. ⚠ THE SIGN IS DROPPED, NOT READ, WHEN THE WORD IS ALREADY THERE — the guard looks left
        //    for it with an optional magnitude between. ⚠ THE SIGN WAS ALSO A TOKEN BOUNDARY, SO THE
        //    REPLACEMENT HAS TO SUPPLY ONE: the corpus writes the percentage hard against the following word
        //    (`10%ye`), and re-emitting the word alone welded it to that letter.
        var all9 = s;
        s = PERCENT.Replace(s, m =>
        {
            var n = m.Groups[1].Value;
            var end = m.Index + m.Length;
            // JS `all[off + whole.length]` — one UTF-16 code unit, or undefined past the end.
            var next = end < all9.Length ? all9[end].ToString() : null;
            var gap = next is not null && WORD_OR_DIGIT.IsMatch(next) ? " " : "";
            return PCT_NAMED.IsMatch(all9[..m.Index]) ? $"{n}{gap}" : $"{n} kɛmɛsarada{gap}";
        });

        // 10) CURRENCY. ⚠ ONLY `$` — `€`, `£` and `¥` are ×0 in the entire wiki and no Bambara name for any
        //     is attested. ⚠ `US$` IS THE SAME CURRENCY NAMED TWICE, so only the sign is consumed — and the
        //     code KEEPS ITS BOUNDARY, since `US$` writes it hard against the sign.
        var all10 = s;
        s = CURRENCY.Replace(s, m =>
        {
            var us = m.Groups[1].Success ? m.Groups[1].Value : null;
            var d = m.Groups[2].Value;
            return $"{(us is null ? "" : "US ")}{(CUR_NAMED.IsMatch(all10[..m.Index]) ? "" : "dolar ")}{d}";
        });

        // 11) DECIMALS, after every rule that needs the number intact. The separator becomes NOTHING and the
        //     fractional digits are spaced apart so the number path speaks them one at a time.
        //     ⚠ THE TRAILING GUARD EXCLUDES A FURTHER SEPARATOR as well as a letter, or a dotted DATE has its
        //     first field claimed and its second left as a pause.
        s = DECIMAL_.Replace(s, m =>
            $"{m.Groups[1].Value} {string.Join(" ", Js.CodePoints(m.Groups[2].Value))}");

        // 12) THE AMPERSAND. ⚠ SPACED ON BOTH SIDES DELIBERATELY: `A&B` deletes to `AB`, ONE token instead of
        //     two, so the replacement must insert the boundary the sign was supplying.
        s = AMPERSAND.Replace(s, " ani ");

        return s;
    }
}
