/**
 * The letter-boundary assertions, defined ONCE.
 * Ported from src/core/boundaries.ts — see that file for the fleet census and why `\b` is not equivalent.
 */
namespace Vernacula.Phonemizer.Core;

public static class Boundaries
{
    /** Nothing letter-like immediately to the LEFT. */
    public const string NOT_LETTER_BEFORE = "(?<![\\p{L}\\p{M}])";

    /** Nothing letter-like immediately to the RIGHT. */
    public const string NOT_LETTER_AFTER = "(?![\\p{L}\\p{M}])";
}
