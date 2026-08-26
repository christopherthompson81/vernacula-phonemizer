/**
 * THE PHONE A LATIN LETTER DENOTES, for a g2p that has NO RULE FOR IT — the alternative to a rule-scan's
 * fall-through branch, which silently DELETES the character.
 * Ported from src/core/latinPhones.ts — see that file for the corpus evidence.
 *
 * ⚠ IT FIRES ONLY WHERE THE LANGUAGE SAYS NOTHING. Consulted at the g2p's own fall-through branch, AFTER
 * every digraph and single-letter rule has been tried, so it can never override a language-specific
 * reading. That placement is the whole design: a letter can be unreadable ALONE and essential as part of a
 * SEQUENCE (Uzbek cannot read a bare ⟨c⟩ but writes /t͡ʃ/ as ⟨ch⟩), which is why this is not a
 * letter→letter substitution run before the g2p.
 */

using System.Text;

namespace Vernacula.Phonemizer.Core;

public static class LatinPhones
{
    /** Letter → the phone it denotes. */
    public static readonly IReadOnlyDictionary<string, string> LATIN_PHONE = new Dictionary<string, string>
    {
        ["b"] = "b",
        ["c"] = "k", // ⚠ AMBIGUOUS: /k/ (Latin) vs /ts/ (Slavic) vs /t͡ʃ/ (Italian) vs /s/ (French); /k/ is the base
        ["d"] = "d",
        ["f"] = "f",
        ["g"] = "ɡ", // ⚠ AMBIGUOUS: /ɡ/ vs /d͡ʒ/ before a front vowel (English, Italian). The plosive is the base value.
        ["h"] = "h", // ⚠ See the note below — `h` is the one row that can contradict a CORRECT silence.
        ["j"] = "j", // ⚠ AMBIGUOUS: /j/ (German, Dutch, Slavic, and the IPA value) vs /d͡ʒ/ (English) vs /x/ (Spanish)
        ["k"] = "k",
        ["l"] = "l",
        ["m"] = "m",
        ["n"] = "n",
        ["p"] = "p",
        ["q"] = "k", // /q/ is uvular in Arabic transcription but a plain velar in every Latin orthography using ⟨q⟩
        ["r"] = "r",
        ["s"] = "s",
        ["t"] = "t",
        ["v"] = "v",
        ["w"] = "w",
        ["x"] = "ks", // ⚠ POSITIONAL — see `X_INITIAL`. This is the medial/final value; word-initially it is /z/.
        ["y"] = "j", // ⚠ AMBIGUOUS: consonantal /j/ (English, Latin) vs vowel /i~y/ (Scandinavian, Welsh, Slavic ⟨y⟩)
        ["z"] = "z",
        ["a"] = "a",
        ["e"] = "e",
        ["i"] = "i",
        ["o"] = "o",
        ["u"] = "u",
        ["ç"] = "t͡ʃ", // ⚠ AMBIGUOUS: /t͡ʃ/ (Turkish, Azerbaijani, Albanian) vs /s/ (French, Portuguese, Catalan)
        ["ñ"] = "ɲ",
        ["ß"] = "s",
        ["ø"] = "ø",
        ["æ"] = "æ",
        ["œ"] = "œ",
        ["å"] = "oː",
        ["ö"] = "ø",
        ["ü"] = "y",
        ["ä"] = "ɛ",
        ["þ"] = "θ",
        ["ð"] = "ð",
        ["ł"] = "w", // Polish ⟨ł⟩ is /w/, not /l/ — the one accented row where the obvious guess is wrong
        ["ŋ"] = "ŋ",
        ["ɛ"] = "ɛ",
        ["ɔ"] = "ɔ",
        ["š"] = "ʃ",
        ["ž"] = "ʒ",
        ["č"] = "t͡ʃ",
        ["ć"] = "t͡ɕ",
        ["đ"] = "d͡ʒ",
        ["ħ"] = "ħ",
    };

    /** ⚠ WORD-INITIAL ⟨x⟩ IS /z/, NOT /ks/. The cluster is the letter's value between or after vowels, but
     *  no language that borrows ⟨x⟩ begins a word with it — emitting /ks/ there manufactures an initial
     *  cluster the source language does not have either. */
    private const string X_INITIAL = "z";

    private static readonly JsRe MarkOne = JsRegex.Compile(@"\p{M}", "u");
    private static readonly JsRe MarksRun = JsRegex.Compile(@"\p{M}+", "gu");

    /** The table proper, with the two positional rows applied — no fallback. */
    private static string? TablePhone(string c, PhoneOpts opts)
    {
        if (c == "h") return opts.IncludeH ? LATIN_PHONE["h"] : null;
        if (c == "x" && opts.Initial) return X_INITIAL;
        return LATIN_PHONE.TryGetValue(c, out var ph) ? ph : null;
    }

    /**
     * The phone for `ch`, or null if this table has nothing to say — the correct answer for anything that is
     * not a letter.
     *
     * ⚠ NOT FOR COMBINING MARKS: a mark is not a segment, and giving one a phone would invent a sound.
     *
     * ⚠ THE BASE-LETTER FALLBACK IS A LAST RESORT AND THE ORDER IS THE WHOLE POINT. The table is consulted
     * on the PRECOMPOSED character first, so a letter with a phonemic identity of its own keeps it (⟨ñ⟩
     * stays /ɲ/, ⟨ł⟩ stays /w/); only a character the table has never heard of is stripped to its base.
     * Folding first would silently destroy those rows.
     */
    public static string? LatinPhone(string ch, PhoneOpts? opts = null)
    {
        opts ??= new PhoneOpts();
        if (MarkOne.IsMatch(ch)) return null;
        var c = ch.ToLowerInvariant();
        var direct = TablePhone(c, opts);
        if (direct != null) return direct;
        // ⚠ .NET `Normalize` THROWS on an UNPAIRED SURROGATE where JS returns the string unchanged, and a
        // caller that indexes UTF-16 units (Fula's g2p walks `w[i]`, so an astral pass-through arrives one
        // half at a time) reaches this with exactly that. Unchanged is what the JS then does: NFD is a
        // no-op, the mark strip is a no-op, `baseCh === c`, and the function returns undefined. So does this.
        if (!IsWellFormedUtf16(c)) return null;
        var baseCh = MarksRun.Replace(c.Normalize(NormalizationForm.FormD), "");
        if (baseCh == c || baseCh.Length != 1) return null;
        return TablePhone(baseCh, opts);
    }

    /** Does every surrogate in `s` sit in a well-formed pair? `string.Normalize` demands it; JS does not. */
    private static bool IsWellFormedUtf16(string s)
    {
        for (var i = 0; i < s.Length; i++)
        {
            if (!char.IsSurrogate(s[i])) continue;
            if (!char.IsHighSurrogate(s[i]) || i + 1 >= s.Length || !char.IsLowSurrogate(s[i + 1])) return false;
            i++;
        }
        return true;
    }
}

public sealed class PhoneOpts
{
    /** Is this the first character of the word? Selects the initial allophone (currently ⟨x⟩ only). */
    public bool Initial { get; init; }
    /** Consult the table for ⟨h⟩. OFF BY DEFAULT: ⟨h⟩ is written and read as NOTHING in Italian, Galician,
     *  Aragonese and Asturian, and those engines fall through on it CORRECTLY — a fall-through cannot tell
     *  deliberate silence from a missing rule, so the caller declares it. */
    public bool IncludeH { get; init; }
}
