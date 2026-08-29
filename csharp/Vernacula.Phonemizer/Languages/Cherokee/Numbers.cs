/**
 * Cherokee (chr / ᏣᎳᎩ) cardinal number → words, written in the CHEROKEE SYLLABARY (the only script this
 * engine reads — Cherokee.cs tokenizes [Ꭰ-Ᏽꭰ-ꮿ] and looks each character up in the 85-char table, so a
 * romanized numeral would phonemize to the EMPTY STRING). DECIMAL, and a bespoke compositor rather than a
 * shared `NumbersDef` because the tens CLIP before a unit (ᏔᎵᏍᎪᎯ 20 → ᏔᎵᏍᎪ ᏌᏊ 21) and the hundreds are
 * built by suffixing the TENS word, not the unit word.
 *
 * SOURCES (two, layered): 0–100 from the Cherokee Nation Language Department's syllabary numbers poster,
 * which spells all 79 compounds and CLIPS them; cross-checked against Montgomery-Anderson pp. 517–519,
 * which agrees on every romanization and states the compound rule outright. 0 and 200–1000 from English
 * Wiktionary + Omniglot.
 *
 * ⚠ WHAT IS EXTRAPOLATED IS DISCLOSED, NOT HIDDEN: the 200–900 series is DERIVED as ⟨tens word⟩ + ᏥᏆ
 * (which reproduces Omniglot exactly for 100–700; for 800/900 Omniglot's roots differ from the poster's
 * and the poster's are used for internal consistency), and the juxtaposition of a remainder onto a
 * hundred/thousand is extrapolated from the attested 21–99 pattern. The 1828 *Cherokee Phoenix* reports an
 * explicit additive particle ᏫᏚᎾᏢᏗ, which is NOT emitted for want of modern corroboration.
 *
 * ATTESTED/COMPOSED RANGE: 0 … 999,999. At 10⁶ and above there is no modern numeral this file trusts, so
 * it falls back to DIGIT-BY-DIGIT rather than invent one.
 * Ported from src/languages/cherokee/numbers.ts.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Cherokee;

public static class Numbers
{
    /** 0..10. 8 is ᏣᏁᎳ (chaneela) per the poster + the grammar, not the ᏧᏁᎳ some word lists give. */
    private static readonly string[] UNITS =
        ["ᏃᏘ", "ᏌᏊ", "ᏔᎵ", "ᏦᎢ", "ᏅᎩ", "ᎯᏍᎩ", "ᏑᏓᎵ", "ᎦᎵᏉᎩ", "ᏣᏁᎳ", "ᏐᏁᎳ", "ᏍᎪᎯ"];
    /** 11..19 — a SUPPLETIVE series (-Ꮪ / -ᎦᏚ), not derivable from the units: the grammar calls these
     *  patterns "unpredictable … should be treated as distinct words". */
    private static readonly string[] TEENS =
        ["ᏌᏚ", "ᏔᎵᏚ", "ᏦᎦᏚ", "ᏂᎦᏚ", "ᏍᎩᎦᏚ", "ᏓᎳᏚ", "ᎦᎵᏆᏚ", "ᏁᎳᏚ", "ᏐᏁᎳᏚ"];
    /** 20..90, the full (standalone) forms; index 2..9. All end in ᏍᎪᎯ (skohi 'ten'). */
    private static readonly string[] TENS =
        ["", "ᏍᎪᎯ", "ᏔᎵᏍᎪᎯ", "ᏦᏍᎪᎯ", "ᏅᎩᏍᎪᎯ", "ᎯᏍᎩᏍᎪᎯ", "ᏑᏓᎵᏍᎪᎯ", "ᎦᎵᏆᏍᎪᎯ", "ᏁᎳᏍᎪᎯ", "ᏐᏁᎳᏍᎪᎯ"];

    /** U+13BF ⟨hi⟩ — the syllable the tens word DROPS before a following unit (ᏔᎵᏍᎪᎯ → ᏔᎵᏍᎪ). */
    private const string HI = "Ꭿ";
    /** ⟨tsiqua⟩: ᏍᎪᎯ+ᏥᏆ = ᏍᎪᎯᏥᏆ 100, ᏔᎵᏍᎪᎯ+ᏥᏆ = ᏔᎵᏍᎪᎯᏥᏆ 200 … */
    private const string HUNDRED_SUFFIX = "ᏥᏆ";
    private const string THOUSAND = "ᎢᏯᎦᏴᎵ"; // ⟨iyagayvli⟩

    /** The clipped (pre-unit) shape of a tens word: ᏔᎵᏍᎪᎯ → ᏔᎵᏍᎪ (poster: "21- ᏔᎵᏍᎪ ᏌᏊ"). */
    private static string Clip(string t) =>
        t.EndsWith(HI, StringComparison.Ordinal) ? t[..^HI.Length] : t;

    /** 1 ≤ n &lt; 100. */
    private static string Below100(int n)
    {
        if (n <= 10) return UNITS[n];
        if (n < 20) return TEENS[n - 11]; // TEENS[0] is 11 (10 lives in UNITS)
        var t = n / 10;
        var u = n % 10;
        return u == 0 ? TENS[t] : $"{Clip(TENS[t])} {UNITS[u]}";
    }

    /** 1 ≤ n &lt; 1000. The hundred word for N×100 is the TENS word for N×10 plus ᏥᏆ. */
    private static string Below1000(int n)
    {
        if (n < 100) return Below100(n);
        var h = n / 100;
        var r = n % 100;
        var head = TENS[h] + HUNDRED_SUFFIX;
        return r == 0 ? head : $"{head} {Below100(r)}";
    }

    /** Non-negative integer → Cherokee syllabary number words. ≥ 10⁶ (no trusted magnitude) →
     *  digit-by-digit. */
    public static string NumberToWords(double n, string? raw = null)
    {
        // JS `Number.isSafeInteger(n)`: an integral double inside ±2^53 − 1.
        if (!(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991.0) || n < 0 || n >= 1e6)
        {
            var src = raw ?? Js.NumberToString(Math.Abs(n));
            return string.Join(" ", Js.CodePoints(src)
                .Where(c => c.Length == 1 && c[0] >= '0' && c[0] <= '9')
                .Select(c => UNITS[c[0] - '0']));
        }
        var v = (int)n;
        if (v < 1000) return Below1000(v);
        var th = v / 1000;
        var r = v % 1000;
        var head = th == 1 ? THOUSAND : $"{Below1000(th)} {THOUSAND}"; // bare ᎢᏯᎦᏴᎵ for 1,000
        return r == 0 ? head : $"{head} {Below1000(r)}";
    }
}
