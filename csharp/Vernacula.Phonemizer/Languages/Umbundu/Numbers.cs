/**
 * Umbundu (umb) cardinal number → words (space-separated; each word then runs through the g2p, so the IPA stays
 * consistent with the word engine).
 *
 * NUMERAL FORM CHOSEN — the CITATION / COUNTING series (mosi, vali, tatu, kwãla, tãlo, epandu, epandu vali,
 * ecelãla, ecea). Umbundu numerals 1–5 are adjectival and take noun-class concord, so there is no class-neutral
 * numeral; the counting series is what a speaker recites, and a TTS handed a bare integer has no noun to agree
 * with. 6–9 are QUINARY-BASED NOUNS ("epandu" and friends) and never inflect — hence identical in every slot.
 *
 * THE FORMATION (words + sources + the extrapolations are data in umbundu.jsonc "numbers"):
 *   • tens are multiplicative on the cl.6 plural: akwi avali (20), akwi atatu (30), akwi epandu (60).
 *   • hundreds are multiplicative on the cl.8 plural: ocita (100), ovita vivali (200), ovita epandu (600).
 *   • thousands/millions: ohulukãyi, ohulua — used invariant with a cl.8 multiplier; 10⁹ = ohulua ohulukãyi.
 *   • FOUR distinct multiplier series, one per magnitude slot (bare citation / after-"la" additive / cl.6 after
 *     akwi / cl.8 after ovita). They are separate tables in the manifest on purpose: reusing one series across
 *     the multiplier slots is the classic Bantu numeral bug (it is what makes 60 collide with 51).
 *   • the connective is "la", ELIDED to "l'" before a vowel-initial word (ekwi l'epandu = 16), so components
 *     chain as ovita vitãlo l'akwi atãlo la vitãlo (555).
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Umbundu;

public static class Numbers
{
    private static UmbunduNumbers N => Manifest.MANIFEST.Numbers;

    private static readonly JsRe VOWEL_INITIAL = JsRegex.Compile("^[aeiouãẽĩõũ]", "u");

    /** Chain the magnitude components with the connective "la", elided to "l'" before a vowel. */
    private static string Join(IReadOnlyList<string> parts)
    {
        var acc = "";
        foreach (var p in parts)
            acc = acc == "" ? p : VOWEL_INITIAL.IsMatch(p) ? $"{acc} {N.AndElided}{p}" : $"{acc} {N.And} {p}";
        return acc;
    }

    /** The magnitude components of 1 ≤ n, outermost first. `top` = this is a bare numeral (use the citation units). */
    private static List<string> Components(double n, bool top)
    {
        var parts = new List<string>();
        var m = Math.Floor(n / 1e6);
        if (m > 0) parts.Add(m == 1 ? N.Million : $"{N.Million} {Multiplier(m)}");
        var th = Math.Floor(n % 1e6 / 1000);
        if (th > 0) parts.Add(th == 1 ? N.Thousand : $"{N.Thousand} {Multiplier(th)}");
        var h = (int)Math.Floor(n % 1000 / 100);
        if (h == 1) parts.Add(N.HundredOne);
        else if (h > 1) parts.Add($"{N.Hundreds} {N.HundredsMult[h]}");
        var t = (int)Math.Floor(n % 100 / 10);
        if (t == 1) parts.Add(N.Ten);
        else if (t > 1) parts.Add($"{N.Tens} {N.TensMult[t]}");
        var u = (int)(n % 10);
        // A bare 1–9 is the citation form; a unit inside a compound sits in the additive (post-"la") slot.
        if (u > 0) parts.Add(top && parts.Count == 0 ? N.Units[u] : N.Additive[u]);
        return parts;
    }

    /** The multiplier of ohulukãyi / ohulua: the cl.8 series for 2–9, else the count rendered recursively. */
    private static string Multiplier(double k) =>
        k >= 2 && k <= 9 ? N.HundredsMult[(int)k] : Join(Components(k, false));

    /** A non-negative integer → space-separated Umbundu cardinal words. */
    public static string NumberToWords(double n)
    {
        if (!(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d) || n < 0)
            return string.Join(" ", Js.NumberToString(Math.Abs(n)).Select(d =>
                d == '0' ? N.Zero : d >= '1' && d <= '9' && d - '0' < N.Units.Count ? N.Units[d - '0'] : d.ToString()));
        if (n == 0) return N.Zero;
        return Join(Components(n, true));
    }
}
