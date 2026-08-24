/**
 * The DEFAULT foreign-run phonemizer: how an engine reads a run of text in a script it does not own,
 * plus the host stack and the neural-OOV memo the foreign path reads.
 * Ported from src/core/foreign.ts — see that file for the corpus evidence.
 */
namespace Vernacula.Phonemizer.Core;

public static class Foreign
{
    /** Reads a run of foreign (non-native-script) text to canonical IPA (TS `ForeignPhonemizer`). */
    private static Func<string, string>? defaultForeign;

    /** Register the fallback used for unclaimed foreign runs. Called by the registry at load. */
    public static void SetDefaultForeign(Func<string, string> f)
    {
        defaultForeign = f;
    }

    /** The registered fallback, or null if none — in which case unclaimed runs stay dropped. */
    public static Func<string, string>? GetDefaultForeign()
    {
        return defaultForeign;
    }

    /** Script-aware reading (TS `ScriptReader`): null stands for the TS `undefined` — the router declines. */
    private static Func<string, string, string?>? scriptReader;

    /** Register the script router. Called by the registry at load, like `setDefaultForeign`. */
    public static void SetScriptReader(Func<string, string, string?> f)
    {
        scriptReader = f;
    }

    /**
     * The host language currently being read, as a STACK — reading a foreign run calls back into another
     * engine, so this nests. Synchronous throughout, so a plain stack is sufficient: no AsyncLocal, and
     * deliberately not one — see WithHost below.
     */
    private static readonly List<string> hosts = new();

    public static void PushHost(string lang)
    {
        hosts.Add(lang);
    }
    public static void PopHost()
    {
        // JS Array.prototype.pop() on an empty array is a no-op.
        if (hosts.Count > 0) hosts.RemoveAt(hosts.Count - 1);
    }

    /**
     * Run one SYNCHRONOUS render with `lang` as the host, restoring the previous host afterwards.
     *
     * ⚠ `fn` IS `Func<T>` AND NOT `Func<Task<T>>` ON PURPOSE — do not add an async overload. The stack is
     * only correct while every push and its pop sit in the same synchronous turn; hold a host across an
     * `await` and two concurrent callers interleave into each other's frames. The async (neural) entries
     * each end in a synchronous engine call and must wrap THAT, not the whole task.
     */
    public static T WithHost<T>(string lang, Func<T> fn)
    {
        PushHost(lang);
        try
        {
            return fn();
        }
        finally
        {
            PopHost();
        }
    }

    /**
     * Read one foreign run in the current host's context. `undefined` when there is no router, no host, or
     * the router declines (an unknown script, or a target equal to the host — which would hand the engine
     * back text its own tokenizer already refused, and recurse).
     *
     * DEPTH IS CAPPED. A pathological document alternating scripts could otherwise nest engine calls without
     * bound; three levels is far past anything real (a Latin brand inside a Greek quote inside Thai).
     */
    public static string? ReadForeignRun(string run)
    {
        var host = hosts.Count > 0 ? hosts[hosts.Count - 1] : null;
        if (scriptReader == null || host == null || hosts.Count > 3) return null;
        return scriptReader(run, host);
    }

    /**
     * NEURAL OOV READINGS for words inside embedded foreign runs, resolved by the async entries and consulted
     * by the default (English) foreign reader. A plain unscoped memo, not a scoped override like WithHost: a
     * reading is keyed on a bare lowercased g2pKey, so it is context-free and there is nothing to restore.
     *
     * ⚠ C# PORT NOTE (ordering): the TS `foreignOov` is a JS Map, whose iteration order is INSERTION
     * ORDER even across deletes — `keys().next()` is always the OLDEST surviving entry. A .NET
     * Dictionary does NOT preserve order once entries have been removed (freed slots are reused), so
     * insertion order is tracked in a parallel queue. A key is enqueued only when it is NEW to the map
     * (a re-`set` of a live key keeps its original JS Map position, exactly as here), so the queue
     * mirrors the Map's key order one-to-one; the eviction loop still skips any entry no longer
     * present, defensively.
     */
    private static readonly Dictionary<string, string> foreignOov = new();
    private static readonly Queue<string> foreignOovOrder = new();

    /** Cap the memo — oldest-first eviction. A re-tag costs one BiLSTM call, so a miss is cheap and
     *  correctness never depends on a hit. */
    private const int FOREIGN_OOV_MAX = 20_000;

    /** Record one neural reading for `g2pKey`. Called by the async entries' pre-pass. */
    public static void AddForeignOov(string g2pKey, string ipa)
    {
        if (foreignOov.Count >= FOREIGN_OOV_MAX)
        {
            while (foreignOovOrder.Count > 0)
            {
                var oldest = foreignOovOrder.Dequeue();
                if (foreignOov.Remove(oldest)) break; // skip stale entries (none arise; see note above)
            }
        }
        if (!foreignOov.ContainsKey(g2pKey)) foreignOovOrder.Enqueue(g2pKey);
        foreignOov[g2pKey] = ipa;
    }

    /**
     * Drop every memoized reading. ⚠ FOR BATCH TOOLS THAT RENDER MANY LANGUAGES IN ONE PROCESS: the memo is
     * static and survives across languages, so without this a later language picks up an earlier one's
     * BiLSTM readings through the foreign reader and its output is not reproducible standalone. Not called
     * by the engine itself — a long-lived server wants the memo warm.
     */
    public static void ClearForeignOov()
    {
        foreignOov.Clear();
        foreignOovOrder.Clear();
    }

    /** The neural reading for `g2pKey`, or null — the shape English's `oovOverride` expects. */
    public static string? LookupForeignOov(string g2pKey)
    {
        return foreignOov.TryGetValue(g2pKey, out var ipa) ? ipa : null;
    }
}
