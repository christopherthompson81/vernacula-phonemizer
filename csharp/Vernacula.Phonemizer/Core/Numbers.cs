/**
 * Native number rendering — GENERAL, not abugida-specific (declarative, portable).
 * Ported from src/core/numbers.ts — see that file for the corpus evidence.
 */

namespace Vernacula.Phonemizer.Core;

/** A number-composition strategy: integer → ordered number-word spellings (`null` = un-authored gap). */
public delegate List<string?> NumberComposer(double n, NumbersDef d);

// ⚠ NOT SEALED: the TS declares `interface FaNumbersDef extends NumbersDef`, so a language may add its own
public class NumbersDef
{
    public string[] Units = []; // 0..9 spellings
    public string[]? Teens; // 10..19 spellings (Indic irregular teens; omitted by systems that compose them, e.g. Turkic oʻn+unit)
    public Dictionary<string, string> Tens = new(); // "20".."90" (round) spellings (Turkic includes "10")
    public string[]? Hundreds; // 0..9 → the irregular round-hundred spellings (Western/Slavic: сто, двісті, триста…), read by westernNumberWords
    public MagnitudesDef Magnitudes = new();

    public sealed class MagnitudesDef
    {
        public string Hundred = "";
        public string Thousand = "";
        public string? Lakh;
        public string? Crore;
        public string? Million;
        public string? Billion;
        /** Balochi's 10^9 word (arab) — the TS core schema has no such magnitude; Balochi's own
         *  `BalNumbersDef` extends `magnitudes` with it, and this field is where that extension binds. */
        public string? Arab;
    }

    /** Optional full irregular 21..99 spellings (keyed by the number); overrides tens+unit composition. */
    public Dictionary<string, string>? Compound;
    /** Order of the 21..99 FALLBACK when no `compound` spelling is authored. Defaults to UNIT then TENS
     *  (the Hindi-belt shape); ⚠ the Dravidian languages are the other way round. */
    public string? CompoundOrder; // "unit-tens" | "tens-unit"
    /** Read a bare 100/1000/lakh/crore as the magnitude word ALONE — Kannada ನೂರು, not *ondu nūru. Opt-in,
     *  because the Hindi-belt languages genuinely do say *ek sau*. ⚠ It applies to EVERY magnitude, not only
     *  hundred and thousand. */
    public bool BareMagnitude;
    /** COUNT-AGREEING MAGNITUDE NOUNS, where the magnitude word is a noun that inflects for its count.
     *  Where a magnitude appears here these forms replace the invariant string in `Magnitudes`. Two-form
     *  (sg/pl) only — the three-form Slavic paradigm lives in the East-Slavic composer. */
    public Dictionary<string, string[]>? MagnitudeParadigm; // keys: "thousand" | "million" | "billion"
    /** count → index into `MagnitudeParadigm`. Default: singular at exactly 1, plural otherwise. */
    public Func<double, int>? MagnitudeCountForm;
    /**
     * Optional decimal-point word (Hindi दशमलव); when present the text path reads N.M as int दशमलव digit-by-
     * digit.
     */
    public string? DecimalWord;
}

public static class Numbers
{

    /**
     * The word for a SINGLE digit character, or null for anything else — the C# spelling of TypeScript's
     * `digitIndex` (#1165).
     *
     * ⚠ `(int)Js.Number(c)` IS THE WRONG INDEX AND ITS WRONGNESS IS SILENT. JS `Number()` maps every
     * whitespace character to 0 — space, tab, NBSP, NNBSP, thin space — and a C# cast of `NaN` is *also* 0,
     * so both engines answered a units lookup with the language's word for ZERO for each one. That set is
     * not incidental: it is exactly the fleet's own grouping-separator class, the characters de-grouping
     * rules exist to remove. A separator surviving into a digit-by-digit fallback was therefore SPOKEN, as
     * a digit the writer never typed.
     *
     * ⚠ AND IT RETURNS NULL RATHER THAN -1, WHICH IS THE ONE PLACE THE TWO ENGINES CANNOT BE SPELLED ALIKE:
     * TypeScript's `table[-1]` is `undefined` and composes with `?? c`, while C#'s would THROW. Returning
     * null lets the call sites keep the `?? c` shape their TS counterparts have.
     */
    public static string? DigitWord(IReadOnlyList<string> units, string c) =>
        c.Length == 1 && c[0] >= '0' && c[0] <= '9' && c[0] - '0' < units.Count ? units[c[0] - '0'] : null;
    /** INDIC (South Asian) number composition: 2-2-3 lakh/crore grouping. */
    public static readonly NumberComposer indicNumberWords = IndicNumberWordsFn;

    private static List<string?> IndicNumberWordsFn(double n, NumbersDef d)
    {
        if (n < 10) return [d.Units[(int)n]];
        if (n < 20) return [d.Teens![(int)n - 10]];
        if (n < 100)
        {
            double t = Math.Floor(n / 10) * 10,
                u = n % 10;
            if (u == 0) return [d.Tens[Js.NumberToString(t)]];
            if (d.Compound != null && d.Compound.TryGetValue(Js.NumberToString(n), out var fused) && !string.IsNullOrEmpty(fused))
                return [fused];
            return d.CompoundOrder == "tens-unit"
                ? [d.Tens[Js.NumberToString(t)], d.Units[(int)u]]
                : [d.Units[(int)u], d.Tens[Js.NumberToString(t)]];
        }
        if (n < 1000)
        {
            double h = Math.Floor(n / 100),
                r = n % 100;
            var sup = d.Hundreds != null && (int)h < d.Hundreds.Length ? d.Hundreds[(int)h] : null;
            if (sup is not null && sup != "")
            {
                var supOut = new List<string?> { sup };
                if (r != 0) supOut.AddRange(IndicNumberWordsFn(r, d));
                return supOut;
            }
            var outp = new List<string?>();
            if (!(h == 1 && d.BareMagnitude)) outp.Add(d.Units[(int)h]);
            outp.Add(d.Magnitudes.Hundred);
            if (r != 0) outp.AddRange(IndicNumberWordsFn(r, d));
            return outp;
        }
        if (n < 100000)
        {
            double th = Math.Floor(n / 1000),
                r = n % 1000;
            var outp = new List<string?>();
            if (!(th == 1 && d.BareMagnitude)) outp.AddRange(IndicNumberWordsFn(th, d));
            outp.Add(d.Magnitudes.Thousand);
            if (r != 0) outp.AddRange(IndicNumberWordsFn(r, d));
            return outp;
        }
        if (n < 10000000)
        {
            double l = Math.Floor(n / 100000),
                r = n % 100000;
            var outp = new List<string?>();
            if (!(l == 1 && d.BareMagnitude)) outp.AddRange(IndicNumberWordsFn(l, d));
            outp.Add(d.Magnitudes.Lakh!);
            if (r != 0) outp.AddRange(IndicNumberWordsFn(r, d));
            return outp;
        }
        {
            double c = Math.Floor(n / 10000000),
                r = n % 10000000;
            var outp = new List<string?>();
            if (!(c == 1 && d.BareMagnitude)) outp.AddRange(IndicNumberWordsFn(c, d));
            outp.Add(d.Magnitudes.Crore!);
            if (r != 0) outp.AddRange(IndicNumberWordsFn(r, d));
            return outp;
        }
    }

    /**
     * WESTERN / Slavic decimal composition (units + teens + tens + hundreds + thousand/million/billion,
     * space-separated).
     */
    public static readonly NumberComposer westernNumberWords = WesternNumberWordsFn;

    private static List<string?> WesternNumberWordsFn(double n, NumbersDef d)
    {
        var H = d.Hundreds!; // Western systems carry the irregular round-hundred spellings
        string Mag(string key, double count)
        {
            string[]? forms = null;
            d.MagnitudeParadigm?.TryGetValue(key, out forms);
            if (forms == null || forms.Length == 0)
                return key switch
                {
                    "thousand" => d.Magnitudes.Thousand,
                    "million" => d.Magnitudes.Million!,
                    _ => d.Magnitudes.Billion!,
                };
            var i = (d.MagnitudeCountForm ?? (c => c == 1 ? 0 : 1))(count);
            // Clamp rather than index out: a 3-way selector against a 2-form table is a data error, and the
            // caller must not hear it as a missing word in its IPA.
            return forms[Math.Min(Math.Max(i, 0), forms.Length - 1)];
        }
        if (n < 10) return [d.Units[(int)n]];
        if (n < 20) return [d.Teens![(int)n - 10]];
        if (n < 100)
        {
            double t = Math.Floor(n / 10) * 10,
                u = n % 10;
            var outp = new List<string?> { d.Tens[Js.NumberToString(t)] };
            if (u != 0) outp.Add(d.Units[(int)u]);
            return outp;
        }
        if (n < 1000)
        {
            double h = Math.Floor(n / 100),
                r = n % 100;
            var outp = new List<string?> { H[(int)h] };
            if (r != 0) outp.AddRange(WesternNumberWordsFn(r, d));
            return outp;
        }
        if (n < 1_000_000)
        {
            double th = Math.Floor(n / 1000),
                r = n % 1000;
            var outp = new List<string?>();
            if (th != 1) outp.AddRange(WesternNumberWordsFn(th, d));
            outp.Add(Mag("thousand", th));
            if (r != 0) outp.AddRange(WesternNumberWordsFn(r, d));
            return outp;
        }
        if (n < 1_000_000_000)
        {
            double m = Math.Floor(n / 1_000_000),
                r = n % 1_000_000;
            var outp = new List<string?>();
            outp.AddRange(WesternNumberWordsFn(m, d));
            outp.Add(Mag("million", m));
            if (r != 0) outp.AddRange(WesternNumberWordsFn(r, d));
            return outp;
        }
        {
            double b = Math.Floor(n / 1_000_000_000),
                r = n % 1_000_000_000;
            var outp = new List<string?>();
            outp.AddRange(WesternNumberWordsFn(b, d));
            outp.Add(Mag("billion", b));
            if (r != 0) outp.AddRange(WesternNumberWordsFn(r, d));
            return outp;
        }
    }

    /** The form a noun takes at this count, with this much following it. */
    private static string DravidianForm(DravidianForms f, double count, bool hasRemainder) =>
        count == 1
            ? (hasRemainder ? f.Combining : f.Bare)
            : (hasRemainder ? (f.PluralOblique ?? f.Combining) : (f.Plural ?? f.Bare));

    /** 1-99. The fused `compound` spelling wins; without one, the ten and the unit are two words. */
    private static List<string> DravidianBelow100(double n, DravidianNumbersDef d)
    {
        if (n <= 0) return [];
        if (n < 10) return [d.Units[(int)n]];
        if (n < 20) return [d.Teens[(int)n - 10]];
        double t = Math.Floor(n / 10) * 10,
            u = n % 10;
        if (u == 0) return [d.Tens[Js.NumberToString(t)]];
        string? fused = null;
        d.Compound?.TryGetValue(Js.NumberToString(n), out fused);
        return fused != null ? [fused] : [d.Tens[Js.NumberToString(t)], d.Units[(int)u]];
    }

    /** 1-999. A suppletive hundred is ONE word; a count of exactly one is never spelled out. */
    private static List<string> DravidianBelow1000(double n, DravidianNumbersDef d)
    {
        double h = Math.Floor(n / 100),
            r = n % 100;
        if (h == 0) return DravidianBelow100(r, d);
        DravidianForms? sup = null;
        d.HundredForms?.TryGetValue(Js.NumberToString(h), out sup);
        if (sup != null)
        {
            var supOut = new List<string> { r > 0 ? sup.Combining : sup.Bare };
            supOut.AddRange(DravidianBelow100(r, d));
            return supOut;
        }
        var mag = DravidianForm(d.MagnitudeForms.Hundred, h, r > 0);
        var outp = new List<string>();
        if (h != 1) outp.Add(d.Units[(int)h]);
        outp.Add(mag);
        outp.AddRange(DravidianBelow100(r, d));
        return outp;
    }

    /** One magnitude group: its count, then the noun in the form that count and that remainder select. */
    private static List<string> DravidianGroup(
        string key,
        double count,
        bool hasRemainder,
        DravidianNumbersDef d)
    {
        DravidianForms? sup = null;
        if (key == "thousand") d.ThousandForms?.TryGetValue(Js.NumberToString(count), out sup);
        if (sup != null) return [hasRemainder ? sup.Combining : sup.Bare];
        var magForms = key switch
        {
            "hundred" => d.MagnitudeForms.Hundred,
            "thousand" => d.MagnitudeForms.Thousand,
            "lakh" => d.MagnitudeForms.Lakh,
            _ => d.MagnitudeForms.Crore,
        };
        var mag = DravidianForm(magForms, count, hasRemainder);
        if (count == 1) return [mag];
        // ⚠ RECURSIVE, not DravidianBelow1000 — the crore count runs past 999, and this index THREW where
        // the TS silently yielded undefined. See src/core/numbers.ts, which carries the finding.
        var outp = DravidianNumberWords(count, d);
        outp.Add(mag);
        return outp;
    }

    /**
     * DRAVIDIAN number composition — Indian 2-2-3 grouping like `IndicNumberWords`, but able to say the
     * things that composer structurally cannot.
     */
    public static List<string> DravidianNumberWords(double n, DravidianNumbersDef d)
    {
        if (!double.IsFinite(n) || n < 0) return [];
        if (n == 0) return [d.Units[0]];
        var parts = new List<string>();
        var crore = Math.Floor(n / 10000000);
        n %= 10000000;
        var lakh = Math.Floor(n / 100000);
        n %= 100000;
        var thou = Math.Floor(n / 1000);
        n %= 1000;
        if (crore > 0) parts.AddRange(DravidianGroup("crore", crore, lakh + thou + n > 0, d));
        if (lakh > 0) parts.AddRange(DravidianGroup("lakh", lakh, thou + n > 0, d));
        if (thou > 0) parts.AddRange(DravidianGroup("thousand", thou, n > 0, d));
        parts.AddRange(DravidianBelow1000(n, d));
        return parts;
    }

    /** Render an integer to canonical IPA: compose it to number words (`compose`, default Indic), then map
     *  each word through `word` (a native G2P word→IPA renderer). The generic, system-agnostic seam. */
    public static string RenderNumber(
        double n,
        NumbersDef d,
        Func<string, string> word,
        NumberComposer? compose = null)
    {
        compose ??= indicNumberWords;
        // ⚠ `Select(w => word(w))`, NOT `Select(word)` — Select has an (element, index) overload, so a bare
        // method group binds to it for any `word` with a second parameter and hands it the INDEX.
        return string.Join(" ", compose(n, d).Select(w => w == null ? "?" : word(w)));
    }

    /** THE DIGIT-AT-A-TIME READING — the fallback for a digit run `RenderNumber` must refuse (above 2^53 the
     *  float has already lost the low digits, so a composed reading would be confidently WRONG about the
     *  quantity). The cost is stated plainly: the reading is a DIGIT STRING, not a quantity. A non-digit
     *  character, or an empty `Units` entry, is skipped rather than guessed at. */
    public static string SpellDigits(string digits, NumbersDef d, Func<string, string> word)
    {
        var outp = new List<string>();
        foreach (var c in Js.CodePoints(digits))
        {
            var w = c.Length == 1 && c[0] >= '0' && c[0] <= '9' && (c[0] - '0') < d.Units.Length
                ? d.Units[c[0] - '0']
                : null;
            if (w == null || w == "") continue;
            outp.Add(word(w));
        }
        return string.Join(" ", outp);
    }
}

/** A Dravidian magnitude/hundred word's forms. */
public sealed class DravidianForms
{
    public string Bare = "";
    public string Combining = "";
    public string? Plural;
    public string? PluralOblique;
}

/** The data a Dravidian numeral needs beyond `indicNumberWords`. */
// NOT sealed: language defs (Kannada, Malayalam) extend it with their decimal word, exactly as the TS
public class DravidianNumbersDef
{
    public string[] Units = []; // 0..9
    public string[] Teens = []; // 10..19
    public Dictionary<string, string> Tens = new(); // "20".."90"
    /** Fused 21-99, keyed by the number. Absent ⇒ the two-word ten+unit reading (Telugu). */
    public Dictionary<string, string>? Compound;
    /** Suppletive round hundreds, keyed by the COUNT of hundreds (kn ಇನ್ನೂರು, ml ഇരുന്നൂറ്). */
    public Dictionary<string, DravidianForms>? HundredForms;
    /** Suppletive round thousands, keyed by the COUNT of thousands (ml രണ്ടായിരം, മൂവായിരം). */
    public Dictionary<string, DravidianForms>? ThousandForms;
    public MagnitudeFormsDef MagnitudeForms = new();

    public sealed class MagnitudeFormsDef
    {
        public DravidianForms Hundred = new();
        public DravidianForms Thousand = new();
        public DravidianForms Lakh = new();
        public DravidianForms Crore = new();
    }
}
