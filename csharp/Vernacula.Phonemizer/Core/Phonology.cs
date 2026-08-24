/**
 * Loader for the shared native-abugida phonology tables (`phonology.jsonc`, beside this module).
 * Ported from src/core/phonology.ts — see that file for the corpus evidence.
 */
namespace Vernacula.Phonemizer.Core;

/** Universal (not language-specific) phonology tables, loaded from data/native/_shared/phonology.jsonc. */
public sealed class Phonology
{
    /** IPA onset → place of articulation (matched by longest key prefix). */
    public Dictionary<string, string> PlaceOfArticulation { get; set; } = new();

    /** place of articulation → homorganic nasal. */
    public Dictionary<string, string> HomorganicNasal { get; set; } = new();
}

public static class PhonologyLoader
{
    private static Phonology? _cached;
    private static readonly object Gate = new();

    /** Read + parse the shared phonology tables (JSONC — strip comments). Memoized after first call. */
    public static Phonology LoadSharedPhonology()
    {
        lock (Gate)
        {
            return _cached ??= Jsonc.ParseJsonc<Phonology>(
                File.ReadAllText(DataPath.Resolve("core/phonology.jsonc")));
        }
    }
}
