/**
 * Shared INITIALISM handling — decide what to do with an all-caps letter run before the tokenizer.
 * Ported from src/core/initialisms.ts — see that file for the corpus evidence.
 */

namespace Vernacula.Phonemizer.Core;

public sealed class InitialismData
{
    /** Letter → the orthographic form to emit for its NAME. English can emit most letters unchanged,
     *  because CMUdict carries all 26 single letters with their letter-name pronunciations. */
    public required Func<string, string?> LetterName { get; init; }
    /** LOWERCASE, IF THE LANGUAGE'S IS NOT JAVASCRIPT'S. */
    public Func<string, string>? Lower { get; init; }
    /**
     * LEXICAL: acronyms read letter-by-letter although their lowercase form is an ordinary word, so the
     * dictionary cannot express the distinction (`US` the country vs `us` the pronoun). Authored in the
     * language's manifest, not here.
     */
    public required IReadOnlySet<string> AcronymLetters { get; init; }
    /** Is this lowercase form RECORDED in the pronunciation dictionary? */
    public required Func<string, bool> IsRecorded { get; init; }
    /** OOV strategy: can this letter sequence be read as a word at all? */
    public required Func<string, bool> IsUnreadable { get; init; }
}

public sealed class PhonotacticsData
{
    /** Vowel LETTERS of the orthography (not phonemes) — the coarse syllabifiability test. */
    public required JsRe Vowels { get; init; }
    /** Two-consonant clusters the language can begin a word with. */
    public required IReadOnlySet<string> LegalOnsets { get; init; }
    /** Two-consonant clusters the language can end a word with. */
    public required IReadOnlySet<string> LegalCodas { get; init; }
    /**
     * The letters that count as LIQUIDS for signal 2 — the sounds that break up a consonant run and keep it
     * syllabifiable.
     */
    public JsRe? Liquids { get; init; }
    /** DIGRAPHS: two letters spelling ONE consonant phoneme. */
    public IReadOnlySet<string>? Digraphs { get; init; }
}

public static class Initialisms
{
    /** Combining marks that genuinely attach to LATIN — the diacritic blocks and their supplements. */
    public const string LATIN_MARK = "\\u0300-\\u036F\\u1AB0-\\u1AFF\\u1DC0-\\u1DFF\\uFE20-\\uFE2F";

    /** An all-caps run, or a caps run glued to digits (`A380`), bounded by letters and Latin diacritics. */
    private static readonly JsRe RUN_OR_CODE = JsRegex.Compile(
        "(?<![\\p{L}" + LATIN_MARK + "])\\p{Lu}{2,}(?![\\p{L}" + LATIN_MARK + "])"
        + "|(?<![\\p{L}" + LATIN_MARK + "])\\p{Lu}+(?=\\d)", "gu");
    /** PERSONAL INITIALS — `J. R. R.` — where each dotted letter is read by name. */
    private static readonly JsRe INITIAL_RUN =
        JsRegex.Compile("(?<![\\p{L}" + LATIN_MARK + "])(?:\\p{Lu}\\.[  ]*){2,}", "gu");
    private static readonly JsRe LONE_INITIAL =
        JsRegex.Compile("(?<=\\p{Lu}\\p{L}*[  ])(\\p{Lu})\\.(?=[  ]+\\p{Lu}\\p{Ll})", "gu");

    private static readonly JsRe UPPER = JsRegex.Compile("\\p{Lu}", "gu");
    private static readonly JsRe LOWER_TEST = JsRegex.Compile("\\p{Ll}", "u");
    private static readonly JsRe SPACE_TEST = JsRegex.Compile("\\s", "u");
    /**
     * JS `String.prototype.trim` trims the ECMAScript WhiteSpace+LineTerminator set (U+FEFF included, U+0085
     * excluded) — not .NET's `Trim()` set.
     */
    private static readonly JsRe JS_TRIM = JsRegex.Compile("^\\s+|\\s+$", "gu");

    /** Build the text→text initialism pass. */
    public static Func<string, string> MakeInitialismNormalizer(InitialismData d)
    {
        var lower = d.Lower ?? (s => s.ToLowerInvariant());
        string SpellInitials(string run) =>
            string.Join(" ", UPPER.Matches(run).Select(m => d.LetterName(lower(m.Value)) ?? m.Value));

        string Inner(string text)
        {
            if (!LOWER_TEST.IsMatch(text) && SPACE_TEST.IsMatch(JS_TRIM.Replace(text, ""))) return text;
            return RUN_OR_CODE.Replace(text, m =>
            {
                var tok = m.Value;
                var low = lower(tok);
                var spelled = SpellOut(low, d.LetterName);
                if (tok.Length < 2) return spelled ?? tok; // attached code: a letter, never a word
                if (d.AcronymLetters.Contains(low)) return spelled ?? tok; // lexical: a listed exception
                if (d.IsRecorded(low)) return tok; // lexical: the dictionary owns it
                if (d.IsUnreadable(low)) return spelled ?? tok; // OOV: nothing else could be said
                return tok; // OOV but pronounceable — the OOV g2p reads it as a word
            });
        }

        return rawText =>
        {
            var text = LONE_INITIAL.Replace(
                INITIAL_RUN.Replace(rawText, m => SpellInitials(m.Value) + " "),
                m =>
                {
                    var letter = m.Groups[1].Value;
                    return d.LetterName(lower(letter)) ?? letter;
                });
            return Inner(text);
        };
    }

    /** Letter-by-letter reading, or undefined if any character has no letter name — so the caller leaves the
     *  token alone rather than emitting a partial reading with characters silently missing. */
    private static string? SpellOut(string lower, Func<string, string?> letterName)
    {
        var names = Js.CodePoints(lower).Select(letterName).ToList();
        return names.All(n => n is not null) ? string.Join(" ", names) : null;
    }

    /** ⚠ THE DEFAULT LIQUID SET IS SCRIPT-AWARE BECAUSE THE ASCII ONE WAS SILENTLY OFF FOR A WHOLE SCRIPT. */
    public static readonly JsRe LIQUIDS = JsRegex.Compile("[lrлр]", "u");

    private static readonly JsRe LETTER_TEST = JsRegex.Compile("\\p{L}", "u");
    /** Strips the outer brackets off a declared vowel class so its body can compose into a negated one. */
    private static readonly JsRe CLASS_BRACKETS = JsRegex.Compile("^\\[|\\]$", "g");

    /** Build a "can this letter string be read as a word at all" test for one language. */
    public static Func<string, bool> MakeUnreadableTest(PhonotacticsData d)
    {
        var consonantRun = JsRegex.Compile("[^" + CLASS_BRACKETS.Replace(d.Vowels.Source, "") + "]{3,}", "u");
        bool IsConsonant(string ch) => LETTER_TEST.IsMatch(ch) && !d.Vowels.IsMatch(ch);
        var digraphs = d.Digraphs;
        /**
         * Rewrite each declared digraph to a single placeholder consonant, so the run test counts PHONEMES.
         */
        string Collapse(string w)
        {
            if (digraphs is null || digraphs.Count == 0) return w;
            var outp = new System.Text.StringBuilder(w.Length);
            for (var i = 0; i < w.Length; )
            {
                var hit = false;
                for (var n = 3; n >= 2; n--)
                {
                    if (i + n > w.Length) continue; // JS slice clamps; a short tail is simply not a digraph
                    if (digraphs.Contains(w.Substring(i, n)))
                    {
                        outp.Append('ẋ');
                        i += n;
                        hit = true;
                        break;
                    }
                }
                if (hit) continue;
                outp.Append(w[i]);
                i += 1;
            }
            return outp.ToString();
        }
        var liquids = d.Liquids ?? LIQUIDS;
        return word =>
        {
            var w = word.ToLowerInvariant();
            if (!d.Vowels.IsMatch(w)) return true;
            var run = consonantRun.Match(Collapse(w));
            if (run.Success && !liquids.IsMatch(run.Value)) return true;
            var head = w.Length < 2 ? w : w[..2];
            if (
                w.Length >= 2 && IsConsonant(w[0].ToString()) && IsConsonant(w[1].ToString()) &&
                !d.LegalOnsets.Contains(head) && digraphs?.Contains(head) != true
            )
                return true;
            var tail = w.Length < 2 ? w : w[^2..];
            if (
                tail.Length == 2 && IsConsonant(tail[0].ToString()) && IsConsonant(tail[1].ToString()) &&
                !d.LegalCodas.Contains(tail) && digraphs?.Contains(tail) != true
            )
                return true;
            return false;
        };
    }
}
