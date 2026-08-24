// Does every ported language actually START?
//
// ⚠ A STATIC-INITIALIZER FAULT IS TOTAL AND ARRIVES DISGUISED. A language's grapheme tables and regexes are
// `static readonly`, so a malformed one throws `TypeInitializationException` on FIRST USE — not at build,
// not at registration. The parity gate then reports every one of that language's 200 rows as differing,
// which reads as a porting mistake in the engine rather than as one bad character in one pattern.
//
// It has happened twice, both times from the SAME cause and in different scripts. A composition-exclusion
// character (a precomposed code point NFC will not rebuild from its parts — Bengali ড় U+09DC, Devanagari
// क़ U+0958, and ~70 others) arrived DECOMPOSED as base + nukta. Inside a regex character class the extra
// character inverts a range:
//
//     Invalid pattern '[क-हक़-य़]\z' at offset 8. [x-y] range in reverse order.
//
// Bengali lost 400 rows to it (#891) and Marathi 200. NFC cannot repair either — that is what a composition
// exclusion means — so "just normalize" is not a fix and the character has to be right in the source.
//
// ⚠ WHY THIS SHAPE RATHER THAN A UNICODE SWEEP. The obvious guard — "no source file may contain a
// decomposed exclusion" — is WRONG here, and measurably so: the TypeScript carries 94 such sequences on
// purpose, because Indic text is commonly authored decomposed and the engines are written to match their
// own corpora. A blanket ban would fail on correct code. What is never acceptable is a language that
// cannot initialize, so that is what this asserts, and it needs no Unicode table to do it.
using Vernacula.Phonemizer;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class LanguageInitializationTests
{
    /// <summary>Every code with a golden — i.e. every language the parity gate can speak for. Read off the
    /// goldens directory rather than listed, so a newly ported language is covered the day it lands.</summary>
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
        while (dir is not null && !Directory.Exists(Path.Combine(dir, "goldens")))
            dir = Path.GetDirectoryName(dir);
        Assert.NotNull(dir);
        return Path.Combine(dir!, "goldens");
    }

    /// <summary>Build the engine and run its FIRST golden row through it. The row is the language's own
    /// script, so it reaches the tables and patterns a synthetic probe would miss; and one row is enough,
    /// because what is being tested is that the type initializers run at all.</summary>
    [Theory]
    [MemberData(nameof(PortedCodes))]
    public void PortedLanguageInitializesAndPhonemizes(string code)
    {
        Registry.EnsureLanguages();
        var first = File.ReadLines(Path.Combine(GoldensDir(), $"{code}.tsv")).First().Split('\t')[0];
        var ex = Record.Exception(() => Phonemizer.Phonemize(first, code));
        // ⚠ AN UNPORTED LANGUAGE IS NOT A FAILURE — `NotImplementedException` is the registry's DELIBERATE
        // report that no engine exists yet, and 76 of the 109 goldens are still in that state. Every OTHER
        // exception is the fault this test exists for.
        if (ex is NotImplementedException) return;
        Assert.True(ex is null, $"{code} failed to initialize or phonemize: {ex}");
    }
}
