/**
 * Aromanian / armãneashti cardinal number → words. Emits space-separated words so each element reads
 * through the g2p (Cunia orthography). Covers 0 … <10¹²; larger / unsafe values read digit-by-digit.
 *
 * ⚠ THE BALKAN CONTACT VOCABULARY keeps this off the shared composer: 20 is the opaque ⟨yinghits⟩
 * (where Romanian rebuilt a transparent decade), 100 the Slavic loan ⟨sutã⟩, the fused ⟨-sprã-⟩ "over"
 * series (unãsprãdzatsi "11"), the fused ⟨-sprãyinghits⟩ twenties (21–29, no connector), the ⟨shi⟩
 * connector on 31–99, and the pluralising hundred (sutã → suti). The feminine agreement of the magnitude
 * nouns (doi → dau before sutã / njilji / miliunã) is composed, not tabled.
 * Ported from src/languages/aromanian/numbers.ts — see that file for the sourcing.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Aromanian;

public static class Numbers
{
    private static readonly string[] ONES =
        ["nulã", "unu", "doi", "trei", "patru", "tsintsi", "shasi", "shapti", "optu", "nao"];
    private static readonly string[] TEENS =
        ["dzatsi", "unãsprãdzatsi", "dosprãdzatsi", "tresprãdzatsi", "patrusprãdzatsi", "tsisprãdzatsi",
         "shasprãdzatsi", "shaptisprãdzatsi", "optusprãdzatsi", "noauãsprãdzatsi"];
    // 21–29: the same infix over ⟨yinghits⟩ (20) instead of ⟨dzatsi⟩ (10) — one fused word, no connector.
    private static readonly string[] TWENTIES =
        ["", "unsprãyinghits", "doisprãyinghits", "treisprãyinghits", "patrusprãyinghits",
         "tsinsprãyinghits", "shasprãyinghits", "shaptisprãyinghits", "optusprãyinghits", "noauãsprãyinghits"];
    private static readonly string[] TENS =
        ["", "", "yinghits", "treidzãts", "patrudzãts", "tsindzãts", "shaidzãts", "shaptidzãts", "opdzãts",
         "noauãdzãts"];
    // 200–900: unit + the plural ⟨suti⟩; 2 takes the feminine ⟨dau⟩.
    private static readonly string[] HUNDREDS =
        ["", "", "dau suti", "trei suti", "patru suti", "tsintsi suti", "shasi suti", "shapti suti",
         "optu suti", "nao suti"];
    private const string HUNDRED = "unã sutã";
    private const string THOUSAND = "unã njilji";
    private const string THOUSANDS = "njilj";
    private const string MILLION = "unã miliunã";
    private const string MILLIONS = "miliunj";
    private const string AND = "shi";

    /** JS `words.replace(/(^|\s)doi$/u, "$1dau")` — the magnitude nouns are feminine, so a trailing
     *  ⟨doi⟩ agrees as ⟨dau⟩. Non-global: the `$` anchor admits one match, and the JS call has no `g`. */
    private static readonly JsRe FEMININE_DOI = JsRegex.Compile("(^|\\s)doi$", "u");

    private static string Feminine(string words) => FEMININE_DOI.Replace(words, "$1dau");

    /** 0 ≤ n < 100. 21–29 are the fused ⟨-sprãyinghits⟩ series; 31–99 take the ⟨shi⟩ connector. */
    private static string Below100(double n)
    {
        if (n < 10) return ONES[(int)n];
        if (n < 20) return TEENS[(int)(n - 10)];
        var t = (int)Math.Floor(n / 10);
        var u = (int)(n % 10);
        if (u == 0) return TENS[t];
        return t == 2 ? TWENTIES[u] : $"{TENS[t]} {AND} {ONES[u]}";
    }

    /** 0 ≤ n < 1000. unã sutã / dau suti … + the remainder juxtaposed (101 → unã sutã unu). */
    private static string Below1000(double n)
    {
        if (n < 100) return Below100(n);
        var h = (int)Math.Floor(n / 100);
        var r = n % 100;
        var head = h == 1 ? HUNDRED : HUNDREDS[h];
        return r != 0 ? $"{head} {Below100(r)}" : head;
    }

    /** 0 ≤ n < 10⁶. njilji is a feminine noun, so it pluralises (unã njilji, dau njilj, dzatsi njilj). */
    private static string Below1e6(double n)
    {
        if (n < 1000) return Below1000(n);
        var th = (int)Math.Floor(n / 1000);
        var r = n % 1000;
        var thousand = th == 1 ? THOUSAND : $"{Feminine(Below1000(th))} {THOUSANDS}";
        return r != 0 ? $"{thousand} {Below1000(r)}" : thousand;
    }

    /** Non-negative integer → Aromanian words. Out-of-range / unsafe values read digit-by-digit (never empty). */
    public static string NumberToWords(double n, string? raw = null)
    {
        // JS `Number.isSafeInteger(n)`: an integral double inside ±2^53 − 1.
        if (!(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991.0) || n < 0 || n >= 1e12)
        {
            var src = raw ?? Js.NumberToString(Math.Abs(n));
            // JS `[...src].map(d => ONES[Number(d)] ?? d)` — a non-digit code point ("e" in an exponent
            // form) is KEPT, not dropped.
            return string.Join(" ", Js.CodePoints(src).Select(d =>
            {
                var v = Js.Number(d);
                return double.IsInteger(v) && v >= 0 && v <= 9 ? ONES[(int)v] : d;
            }));
        }
        if (n == 0) return ONES[0]; // nulã
        if (n < 1e6) return Below1e6(n);
        var m = (int)Math.Floor(n / 1e6);
        var r = n % 1e6;
        // 10⁹ composes as Cunia's own gloss of the word — "unã njilji [di] miliunj", a thousand millions.
        var head = m == 1 ? MILLION : $"{Feminine(Below1e6(m))} {MILLIONS}";
        return r != 0 ? $"{head} {NumberToWords(r)}" : head;
    }
}
