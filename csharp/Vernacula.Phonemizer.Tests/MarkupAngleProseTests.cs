/**
 * Prose in angle brackets is READ, not stripped as a tag. All inputs are synthetic.
 * Ported from test/markup-angle-prose.test.ts.
 */
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class MarkupAngleProseTests
{
    private static string Strip(string s) => Core.Markup.StripMarkup(s);

    [Fact]
    public void ProseIsKeptAsParentheses()
    {
        Assert.Equal("Before (a longer note here) after.", Strip("Before <a longer note here> after."));
        Assert.Equal("(Question for the team: was the widget tested?)",
            Strip("<Question for the team: was the widget tested?>"));
        Assert.Equal("(I think so)", Strip("<I think so>"));
    }

    [Fact]
    public void ComparisonsAreLeftAlone()
    {
        Assert.Equal("3 < 5 and 7 > 2", Strip("3 < 5 and 7 > 2"));
        Assert.Equal("x<y and z>w", Strip("x<y and z>w"));
        Assert.Equal("a lone < here", Strip("a lone < here"));
    }

    [Fact]
    public void RealTagsAreStillRemoved()
    {
        Assert.Equal("Year 2024 end", Strip("Year <i>2024</i> end"));
        Assert.Equal("bold", Strip("<B>bold</B>"));
        Assert.Equal("link", Strip("<a href=\"https://x.example/y\">link</a>"));
        Assert.Equal("xy", Strip("<br/>x<br />y<br>"));
        Assert.Equal("z", Strip("<ref name=\"n1\"/>z"));
        Assert.Equal("s", Strip("<span class='q' style=\"c:r\">s</span>"));
        Assert.Equal("t", Strip("<p class=lead>t</p>"));
    }

    [Fact]
    public void SupDigitsStillBecomeSuperscripts()
    {
        Assert.Equal("2.802×10¹⁰", Strip("2.802×10<sup>10</sup>"));
        Assert.Equal("km²", Strip("km<sup>2</sup>"));
        Assert.Equal("4th", Strip("4<sup>th</sup>"));
    }
}
