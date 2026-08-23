/**
 * Loader for the shared native-abugida phonology tables (`phonology.jsonc`, beside this module).
 * Universal, output-affecting DATA (place-of-articulation + homorganic nasal) — see that file's header
 * for the data-vs-code split. Memoized: the file is read once.
 */
namespace Vernacula.Phonemizer.Core;

/**
 * Universal (not language-specific) phonology tables, loaded from data/native/_shared/phonology.jsonc.
 * These decide WHICH phoneme is produced (the anusvara homorganic nasal), so they are declarative data;
 * the classification LOGIC (longest-prefix match over the ties/dentals) lives in the engine (abugidaG2p).
 */
public sealed class Phonology
{
    /** IPA onset → place of articulation (matched by longest key prefix). */
    public Dictionary<string, string> PlaceOfArticulation { get; set; } = new();

    /** place of articulation → homorganic nasal. */
    public Dictionary<string, string> HomorganicNasal { get; set; } = new();
}

public static class PhonologyLoader
{
    // phonology.jsonc sits beside this module (src/core/ in the data tree)
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
