/**
 * Ukrainian Roman-numeral reading.
 * Ported from src/languages/ukrainian/romanOrdinals.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Ukrainian;

public static class RomanOrdinals
{
    /** Cardinal tens, read from the language's own number data (ukrainian.jsonc): двадцять, тридцять, … */
    private static IReadOnlyDictionary<string, string> TENS_CARDINAL => Manifest.DEF.Numbers.Tens;

    /** The NEUTER ordinal tables (ukrainian.jsonc `romanOrdinals`) — see the header on why they are not the
     *  masculine ones Normalize.cs uses. Apostrophe is U+0027, matching the manifest's orthography. */
    private static UkrainianRomanOrdinals ORD => Manifest.DEF.RomanOrdinals;

    /** Integer → Ukrainian ordinal, neuter nominative. */
    public static string? Ordinal(int n)
    {
        if (n < 1 || n > 100) return null;
        if (n == 100) return ORD.Hundredth;
        if (n < 20) return ORD.OneToNineteen[n];
        int t = n / 10, u = n % 10;
        if (u == 0) return ORD.Tens[t];
        // ⚠ A MISSING TENS KEY IS `undefined` IN JS, not a throw: the TS reads `TENS_CARDINAL[String(t * 10)]`
        // and returns `undefined` when the table has no such key, so the caller falls back to the cardinal.
        // `Dictionary`'s indexer would throw instead, which is a different behaviour at the same input.
        return TENS_CARDINAL.TryGetValue(Js.NumberToString(t * 10), out var tens) ? $"{tens} {ORD.OneToNineteen[u]}" : null;
    }

    /**
     * The nouns a Roman numeral is read as an ordinal next to (ukrainian.jsonc `romanOrdinals.context`) —
     * століття / сторіччя in the cases that occur, plus річниця ("L річниця") and з'їзд. вік is excluded on
     * purpose; see the header note on gender, and the jsonc, where the exclusion is visible as an absence.
     */
    private static readonly JsRe CONTEXT = JsRegex.Compile($"^(?:{string.Join("|", ORD.Context)})$", "iu");

    /** This policy always supplies `ordinal`, which is optional on `RomanPolicy`. */
    public static readonly RomanPolicy ROMAN_POLICY = new()
    {
        Ordinal = Ordinal,
        OrdinalBefore = CONTEXT,
        OrdinalAfter = CONTEXT,
    };
}
