/**
 * SENTINEL MARKERS — the characters a pass inserts to hold a place, named once so no site has to spell an
 * invisible character inline (#1175). Mirrors src/core/markers.ts.
 *
 * ⚠ THE RAW SPELLING IS A REVIEW HAZARD, NOT A STYLE PREFERENCE, and it has two distinct failure modes.
 *
 * A raw NUL makes `file(1)` classify the source as `data`, and `grep` THEN SKIPS IT IN SILENCE — no match,
 * no error, no exit code. Every mechanical pass this repo's port reviews depend on — the
 * regex-by-codepoint diff, the table-membership diff, the missing-constant sweep — is a grep or a read over
 * the source. On a file in that state they all return zero findings and the reviewer reports it clean.
 *
 * A raw PUA character is arguably worse, because nothing flags it at all. `file` is happy, `grep` works,
 * and `const AGO = "…"` READS AS THE EMPTY STRING — so a reviewer diffing the TS `const AGO = ""` against
 * the C# `const string AGO = ""` calls them equal even if one of them genuinely were empty. That is a hole
 * in precisely the method used to catch transcription defects between the two engines.
 */
namespace Vernacula.Phonemizer.Core;

public static class Markers
{
    /** A private-use sentinel: cannot occur in real text, swapped back immediately after the pass that
     *  needs it. */
    public const string PUA_SENTINEL = "\ue000";

    /** A second PUA slot, for a pass that must nest two markers without collision (bengali's ⟨æ⟩). */
    public const string PUA_SENTINEL_2 = "\ue001";

    /** A sentinel that can never be a case ending or a lexicon key.
     *  ⚠ PREFER `PUA_SENTINEL` FOR NEW CODE — NUL earns nothing over a PUA code point and costs `grep`. */
    public const string NUL_SENTINEL = "\u0000";
}
