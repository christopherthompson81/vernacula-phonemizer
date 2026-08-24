/**
 * Digit-GROUPING SEPARATOR fidelity: the invisible space characters a language's degrouping rule accepts.
 *
 * ⚠ THESE CHARACTERS ARE INVISIBLE IN SOURCE, WHICH IS EXACTLY WHY THEY NEED A TEST. French typography groups
 * thousands with NBSP / narrow NBSP / thin space, and each engine's normalize declares a character class holding
 * those characters. Retyping such a class silently collapses it to plain spaces — the class still compiles,
 * still matches the ordinary-space form every golden happens to use, and quietly stops matching the real
 * typography. It reached SIX languages before an audit caught it: fr degrouped `1\u00a0040` to *un quarante*
 * instead of *mille quarante*, and es/en/ru/bg/oc/ast/qu carried the same latent break with no failing row.
 *
 * ⚠ THE CLASSES USED TO BE DELIBERATELY NON-UNIFORM and this test pinned each language to its own narrower set —
 * bg accepted space+NBSP+NNBSP but not thin, en and qu only space+NBSP. That is no longer true, and the change
 * is the point: #925 and #935 widened the whole fleet to the same class, because the narrowness was never a
 * language fact. It was a folded NBSP in 296 classes and an ASCII-only habit in the rest, and it cost readings —
 * `1\u00a0904\u00a0569` read as three numbers in 42 engines, which is why `&nbsp;` used to be decoded
 * dishonestly as a plain space to work around it (core/markup.ts).
 *
 * So the invariant is now FLEET-WIDE and uniform: for every ported language, a number grouped with ANY of the
 * three exotic spaces reads exactly as the unspaced number does. The TypeScript half of this guard lives in
 * test/markup-entities.test.ts and covers all 192 engines.
 */
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class GroupingSpaceTests
{
    private const string Nbsp = "\u00a0";
    private const string Nnbsp = "\u202f";
    private const string Thin = "\u2009";

    /// <summary>Every ported language, from the goldens directory — the same source LanguageInitializationTests
    /// uses, so a newly ported language is covered the day its golden lands.</summary>
    public static TheoryData<string> PortedCodes()
    {
        var data = new TheoryData<string>();
        foreach (var f in Directory.EnumerateFiles(GoldensDir(), "*.tsv").Order(StringComparer.Ordinal))
            data.Add(Path.GetFileNameWithoutExtension(f));
        return data;
    }

    private static string GoldensDir()
    {
        var dir = AppContext.BaseDirectory;
        while (dir is not null && !Directory.Exists(Path.Combine(dir, "goldens"))) dir = Path.GetDirectoryName(dir);
        Assert.NotNull(dir);
        return Path.Combine(dir!, "goldens");
    }

    /// <summary>Tibetan is the one engine that reads the two differently, and NOT by losing a numeral: its
    /// tokenizer treats an ASCII space as a phrase boundary (Tibetan separates with tsheg, not space), so the
    /// ASCII form gains clause pauses the NBSP form does not. Both read every digit.</summary>
    private static readonly IReadOnlySet<string> PauseOnAsciiSpace = new HashSet<string> { "bo" };

    /// <summary>⚠ THE COMPARISON IS AGAINST THE PLAIN-SPACE FORM, not against the unspaced number. Plenty of
    /// languages do not group with a space at all — their corpora group with `.` or `,` — and for those
    /// `1 904 569` is legitimately three numerals. What must never differ is WHICH space is used.</summary>
    [Theory]
    [MemberData(nameof(PortedCodes))]
    public void EverySpaceCharacterGroupsAlike(string lang)
    {
        if (PauseOnAsciiSpace.Contains(lang)) return;
        // ⚠ AN UNPORTED LANGUAGE IS NOT A FAILURE — `NotImplementedException` is the registry's deliberate report
        // that no engine exists yet, exactly as in LanguageInitializationTests.
        foreach (var shape in new[] { "5 000", "1 904 569", "3 850 km" })
        {
            string plain;
            try { plain = Phonemizer.Phonemize(shape, lang); }
            catch (NotImplementedException) { return; }
            foreach (var sep in new[] { Nbsp, Nnbsp, Thin })
                Assert.Equal(plain, Phonemizer.Phonemize(shape.Replace(" ", sep), lang));
        }
    }
}
