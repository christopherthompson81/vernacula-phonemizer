/**
 * Hebrew (he) pronunciation lexicon — a LOOKUP layer for the unvocalized (neural) path: a known skeleton
 * maps to a stored niqqud reading, rendered through the rule g2p so it stays in OUR convention.
 * Ported from src/languages/hebrew/lexicon.ts — see that file for the provenance.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Hebrew;

public static class Lexicon
{
    private static IReadOnlyDictionary<string, string>? cache; // skeleton → niqqud

    private static IReadOnlyDictionary<string, string> Load() =>
        // `optional: true` is the TS's `catch { }` — no lexicon shipped → empty, every lookup misses.
        cache ??= LoadTsv.LoadTsvMap("languages/hebrew", "he-lexicon.tsv", optional: true);

    /** The lexicon reading of an unvocalized word in OUR convention, or null if not a known non-homograph. */
    public static string? LexiconLookup(string skeleton) =>
        Load().TryGetValue(skeleton, out var niqqud) ? HebrewPhonemizer.PhonemizeWord(niqqud) : null;
}
