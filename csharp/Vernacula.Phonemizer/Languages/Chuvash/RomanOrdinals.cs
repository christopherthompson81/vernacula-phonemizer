/**
 * Chuvash Roman-numeral reading. A century is an ORDINAL: `XVIII ӗмӗр` is *вун саккӑрмӗш ӗмӗр*; the shared
 * cardinal pass gives *вун саккӑр ӗмӗр*, which means "eighteen centuries". Chuvash ordinal formation is an
 * invariant -мӗш on the full numeral, so this file imports Normalize.cs's derivation rather than authoring
 * a second copy.
 * Ported from src/languages/chuvash/romanOrdinals.ts.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Chuvash;

public static class RomanOrdinals
{
    /** Bounded at 100: above that a Roman numeral is a year or a regnal number, and the cardinal is right. */
    public static string? Ordinal(int n) => n >= 1 && n <= 100 ? Normalize.OrdinalOf(n) : null;

    /**
     * `ӗмӗр` (century) in the cases the corpus writes — ⚠ AND IN BOTH ENCODINGS, WHICH IS NOT OPTIONAL:
     * `core/roman.ts` runs at `romanPass`, BEFORE the shared character-level pre-passes (including
     * `foldCyrillicConfusables`), so this policy sees the text as the writer typed it, with the Latin ⟨ĕ⟩,
     * and a regex written for the folded ⟨ӗ⟩ alone matched nothing.
     */
    private static readonly JsRe CONTEXT =
        JsRegex.Compile("^([ӗĕ]м[ӗĕ]р(те|тен|ти|ччен|че|сем|сене|сенче|[ӗĕ]|[ӗĕ]нче|[ӗĕ]н)?)$", "iu");

    public static readonly RomanPolicy ROMAN_POLICY = new()
    {
        Ordinal = Ordinal,
        OrdinalBefore = CONTEXT,
        OrdinalAfter = CONTEXT,
    };
}
