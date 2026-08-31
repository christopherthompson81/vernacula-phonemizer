/**
 * Luxembourgish cardinal number → words. Units-first and fused like German (eenanzwanzeg = 21,
 * fënnefandrësseg = 35), with the Eifeler Regel on the unit→tens connector: "an" survives before
 * ⟨n d t z h⟩ and a vowel, and reduces to "a" before any other consonant. The composition is the
 * shared units-first Germanic algorithm in Languages/Danish/UnitsFirstNumbers.cs.
 * Ported from src/languages/luxembourgish/numbers.ts — see that file for the sourcing and the
 * Wikipedia example pair that pins the connector's n-deletion.
 */
using Vernacula.Phonemizer.Core;
using Vernacula.Phonemizer.Languages.Danish;

namespace Vernacula.Phonemizer.Languages.Luxembourgish;

public static class Numbers
{
    private static LuxNumbersDef N => Manifest.MANIFEST.Numbers;

    // ⟨u⟩ is listed as a vowel head for completeness even though no tens word begins with it.
    private static readonly HashSet<string> N_KEEPERS =
        new(Js.CodePoints("ndtzh" + "aeiouäëéèáâôûüy"), StringComparer.Ordinal);

    /**
     * The Eifeler Regel as a text→text operation: a word-final ⟨n⟩ survives before ⟨n d t z h⟩ and
     * before a vowel, and is deleted before any other consonant. Before a pause (nothing following)
     * the ⟨n⟩ is kept.
     *
     * Exported because Normalize needs exactly the same rule for the words IT emits — the ordinal
     * ending, the fraction numerator and the left operand of a range joined by *bis*. One
     * definition, three callers, so the connector and the ordinal ending can never drift apart.
     */
    public static string ApplyEifelerRegel(string word, string following)
    {
        if (!word.EndsWith("n", StringComparison.Ordinal)) return word;
        var c = following.Length > 0 ? Js.ToLowerCase(following.AsSpan(0, 1).ToString()) : null;
        if (c is null) return word; // before a pause the ⟨n⟩ is retained
        return N_KEEPERS.Contains(c) ? word : word[..^1];
    }

    private static UnitsFirstDef? DEF_;
    private static UnitsFirstDef DEF => DEF_ ??= new UnitsFirstDef
    {
        Ones = N.Ones,
        Tens = N.Tens,
        CompoundOnes = N.CompoundOnes,
        // "an" → "a" when the following tens word starts with a consonant outside the n/d/t/z/h set.
        Connector = (_unit, tensWord) => ApplyEifelerRegel(N.Connector, tensWord),
        Hundred = N.Hundred,
        Thousand = N.Thousand,
        Million = N.Million,
        Billion = N.Billion,
        MulJoin = "", // German-style closed compounds: zweehonnert, zwielefdausend
        HundredRemJoin = "", // dräihonnertfënnefavéierzeg
        GroupJoin = " ", // magnitude groups are separate words: "zwielefdausend dräihonnert…"
    };

    /** Non-negative integer (&lt; 10¹²) → Luxembourgish words; larger / non-finite → digit-by-digit.
     *  `raw` is the TOKEN TEXT and must be threaded (#1080) — above 2^53 the double has already
     *  rounded. */
    public static string NumberToWords(double n, string? raw = null) =>
        UnitsFirstNumbers.UnitsFirstNumberToWords(n, DEF, raw);
}
