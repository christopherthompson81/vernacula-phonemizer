// The Kurmanji era marker's year guard — the portable half of test/kurmanji.test.ts's era case.
//
// ⚠ NOT IN THE 200-ROW GOLDEN, so the parity gate cannot reach it: both engines agreed on the wrong
// reading. `b.z.` and `BZ` are also two letters with stops, so the rule ate a PERSON'S INITIALS —
// `B. Z. Goldberg` read *bɛrˈiː zɑːjiːnˈeː ɡoːldbˈɛrɡ*, "before Christ Goldberg".
//
// The corpus supplies the guard for free: all twelve mined instances have a digit against the marker on one
// side or the other, because dating a year is the marker's whole job. Both the claims and the refusals are
// pinned here — a refusal nothing asserts is indistinguishable from an oversight.
using KurmanjiNormalize = Vernacula.Phonemizer.Languages.Kurmanji.Normalize;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class KurmanjiEraTests
{
    [Theory]
    // CLAIMED — every shape the mined corpus actually writes, on both sides of the year.
    [InlineData("sedsala 4an b.z.", "sedsala çaran berî zayînê")] // a digit + its bound suffix, then the marker
    [InlineData("sala 4000 BZ", "sala 4000 berî zayînê")]         // the bare two-letter spelling
    [InlineData("b.z. 550", "berî zayînê 550")]                   // the marker BEFORE its year
    [InlineData("(B.Z. 95–36)", "(berî zayînê 95–36)")]           // …behind an opening bracket
    [InlineData("558 b.z.- 530 b.z.", "558 berî zayînê- 530 berî zayînê")] // a span, both endpoints marked
    // REFUSED — no year in reach, so these are initials, and unread beats confidently wrong.
    [InlineData("B. Z. Goldberg", "B. Z. Goldberg")]
    [InlineData("Rêvebir BZ hat", "Rêvebir BZ hat")]
    public void TheEraMarkerIsClaimedOnlyBesideAYear(string input, string want) =>
        Assert.Equal(want, KurmanjiNormalize.NormalizeKurmanji(input));
}
