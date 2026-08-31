/**
 * Lule Sami (smj) TEXT NORMALIZATION — Uralic (Sami), ~2k speakers in Sweden and Norway.
 *
 * ⚠ THIS LANGUAGE HAS NO CORPUS, AND THIS LAYER IS THEREFORE THE CORPUS-INDEPENDENT SUBSET AND NOTHING
 * ELSE. There is no FLEURS split, no mined artifact and no usable wiki, so not one rule here is argued from
 * instances — which is why not one of them emits a WORD. `Core/SeparatorHygiene.cs` spends the separators
 * that cannot be anything but separators, and every class that needs evidence stays open: `%`, currency,
 * degrees, the clock, the hyphen, the era marker and every abbreviation are untouched and still visible to
 * the leak gates.
 *
 * ⚠ THIS LANGUAGE IS NOT "TREATED". A grouped figure no longer reads as two or three sentences; nothing
 * else has been decided.
 *
 * SOURCING — none is claimed, because no word is emitted. That is the point.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.LuleSami;

public static class Normalize
{
    /** Normalize one Lule Sami input string. Pure text→text; emits no word. See the header. */
    public static string NormalizeLuleSami(string input) => SeparatorHygienePass.SeparatorHygiene(input);
}
