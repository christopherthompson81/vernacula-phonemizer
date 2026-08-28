/**
 * Latin-American Spanish (es-419) — the "neutral"/pan-American standard, an ACCENT VARIANT of the Castilian
 * `es` engine (not a separate language). Reuses the Spanish engine whole and applies two categorical,
 * pan-regional mergers to its output: SESEO (θ→s) and YEÍSMO (ʎ→ʝ). Context-free, so no information is lost.
 * Ported from src/languages/spanish-419/spanish-419.ts — see that file for what is deliberately NOT applied
 * (coda /s/-aspiration, final /n/→[ŋ], voseo: regional, not part of the neutral standard).
 *
 * ⚠ THE REGISTRY ALREADY ROUTED `es-419` HERE AND NOTHING ANSWERED. `Registry.Build` has carried
 * `case "es-419": return Create("spanish-419")` since the switch was mirrored from the TypeScript, but no
 * factory was ever registered under that key, so every call threw `port pending: spanish-419`. The parity
 * gate could not see it: it iterates GOLDEN FILES, and no accent variant has one.
 */
using Vernacula.Phonemizer.Core;
using Vernacula.Phonemizer.Languages.Spanish;

namespace Vernacula.Phonemizer.Languages.Spanish419;

public static class Spanish419
{
    /** Castilian IPA → Latin-American: seseo (θ→s) + yeísmo (ʎ→ʝ). Context-free, no information lost. */
    public static string ToLatinAmerican(string castilian) =>
        castilian.Replace("θ", "s").Replace("ʎ", "ʝ");

    /** One es-419 word → canonical IPA (Castilian engine + the seseo/yeísmo mergers). */
    public static string PhonemizeWord(string word) =>
        ToLatinAmerican(SpanishPhonemizer.PhonemizeWord(word));

    private sealed class Es419Language(ILanguage inner) : ILanguage
    {
        // ⚠ AN ACCENT VARIANT IS A WHOLE-STRING DELTA over the base engine's output, so a trace token records
        // the CASTILIAN reading and the utterance ships the American one. Reported (#1150).
        public string Text(string input)
        {
            var pre = inner.Text(input);
            var o = ToLatinAmerican(pre);
            Core.Trace.NoteRewrite("accent:es-419", pre, o);
            return o;
        }
    }

    /**
     * Build the Latin-American Spanish phonemizer. ⚠ `americas: true` is not decoration — it selects the
     * ORDINAL first-of-the-month in the normalization layer (*el primero de enero*, where Spain says *el uno
     * de enero*). That flag is the only thing `spanish.jsonc`'s `months` table is read for; in `es` the rule
     * is a no-op. See the es lift.
     */
    public static ILanguage CreateSpanish419() =>
        new Es419Language(SpanishPhonemizer.CreateSpanish(americas: true));

    internal static void RegisterSelf()
    {
        Registry.Register("spanish-419", CreateSpanish419);
        // Numeral WORDS are identical to `es` — the RAE *Ortografía* is co-published with the Asociación de
        // Academias, so «siglo XXI» = *siglo veintiuno* on both sides of the Atlantic. The same policy object
        // is registered rather than a copy, so the two cannot drift.
        Registry.RegisterRomanPolicy("es-419", Spanish.RomanOrdinals.ROMAN_POLICY);
    }
}
