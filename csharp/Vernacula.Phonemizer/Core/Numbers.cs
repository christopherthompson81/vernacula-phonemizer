/**
 * Native number rendering — GENERAL, not abugida-specific (declarative, portable).
 *
 * ⚠ NUMBER COMPOSITION IS BESPOKE PER NUMBERING SYSTEM — there is no universal magnitude structure — so each
 * system contributes its own `<system>NumberWords` that decomposes an integer into an ordered list of
 * number-WORD spellings. `renderNumber` is the reusable seam: it takes a composer plus a word→IPA renderer and
 * stitches the result. The composer defaults to `indicNumberWords`; a non-Indic language passes its own.
 */

namespace Vernacula.Phonemizer.Core;

/** A number-composition strategy: integer → ordered number-word spellings (`null` = un-authored gap). */
public delegate List<string?> NumberComposer(double n, NumbersDef d);

// ⚠ NOT SEALED: the TS declares `interface FaNumbersDef extends NumbersDef`, so a language may add its own
// fields to the shared schema (Persian adds the connective enclitic's IPA). Persian is the first to do it.
public class NumbersDef
{
    public string[] Units = []; // 0..9 spellings
    public string[]? Teens; // 10..19 spellings (Indic irregular teens; omitted by systems that compose them, e.g. Turkic oʻn+unit)
    public Dictionary<string, string> Tens = new(); // "20".."90" (round) spellings (Turkic includes "10")
    public string[]? Hundreds; // 0..9 → the irregular round-hundred spellings (Western/Slavic: сто, двісті, триста…), read by westernNumberWords
    // Magnitude words. hundred/thousand are universal; Indic adds lakh/crore, Western/Turkic million/billion.
    public MagnitudesDef Magnitudes = new();

    public sealed class MagnitudesDef
    {
        public string Hundred = "";
        public string Thousand = "";
        public string? Lakh;
        public string? Crore;
        public string? Million;
        public string? Billion;
    }

    /** Optional full irregular 21..99 spellings (keyed by the number); overrides tens+unit composition. */
    public Dictionary<string, string>? Compound;
    /**
     * Order of the 21..99 FALLBACK when no `compound` spelling is authored. The default is UNIT then TENS
     * (the Hindi-belt *ekchālīs* shape). ⚠ DRAVIDIAN LANGUAGES ARE THE OTHER WAY ROUND — Kannada
     * ಇಪ್ಪತ್ತೊಂದು, Malayalam ഇരുപത്തിയൊന്ന് — and read "one twenty" under the default.
     */
    public string? CompoundOrder; // "unit-tens" | "tens-unit"
    /**
     * Read a bare 100/1000/lakh/crore as the magnitude word ALONE — Kannada ನೂರು, not *ondu nūru. Opt-in,
     * because the Hindi-belt languages genuinely do say *ek sau* and *ek hazār*.
     *
     * ⚠ It applies to EVERY magnitude, not only hundred and thousand: a version that stopped at thousand
     * still read "one lakh" and "one crore" while correctly saying a bare hundred.
     */
    public bool BareMagnitude;
    /**
     * COUNT-AGREEING MAGNITUDE NOUNS. `magnitudes` holds one invariant string per magnitude, which is a
     * grammatical error in every language whose magnitude word is a NOUN that inflects for its count —
     * Norwegian read 2 000 000 as *to million, where it is to millionER. Where a magnitude appears here,
     * these forms replace the invariant one; the index comes from `magnitudeCountForm`.
     *
     * This is the two-form (sg/pl) case only. The three-form Slavic paradigm PLUS multiplier-gender
     * agreement is a strict superset, and `eastSlavicNumberWords` (uk/be) already implements it — that
     * composer is the place to look before widening this one.
     */
    public Dictionary<string, string[]>? MagnitudeParadigm; // keys: "thousand" | "million" | "billion"
    /**
     * count → index into `magnitudeParadigm`. Default: singular at exactly 1, plural otherwise, which is the
     * Germanic/Romance rule. A language whose split is elsewhere (Latvian is singular after any count
     * ending in 1 except 11) supplies its own; `slavicCountForm` is the ready-made 3-way selector.
     */
    public Func<double, int>? MagnitudeCountForm;
    /** Optional decimal-point word (Hindi दशमलव); when present the text path reads N.M as int दशमलव digit-by-digit. */
    public string? DecimalWord;
}

public static class Numbers
{
    /**
     * INDIC (South Asian) number composition: 2-2-3 lakh/crore grouping. Hindi 21-99 are irregular (not
     * compositional) and require their `compound` spellings; a missing one yields `null` (a marked gap).
     */
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
            // 21-99 fused spelling not authored → degrade to a best-effort two-word reading instead of leaking
            // a "?" into the IPA. Approximate (the real fused form differs) but readable; a full `compound`
            // map overrides it. The ORDER is language-specific — see `compoundOrder`.
            return d.CompoundOrder == "tens-unit"
                ? [d.Tens[Js.NumberToString(t)], d.Units[(int)u]]
                : [d.Units[(int)u], d.Tens[Js.NumberToString(t)]];
        }
        if (n < 1000)
        {
            double h = Math.Floor(n / 100),
                r = n % 100;
            // ⚠ A SUPPLETIVE ROUND HUNDRED WINS OUTRIGHT where the language declares one — Odia ଶହେ for 100,
            // which `bareMagnitude` cannot express: that only OMITS the leading "one" and would leave the wrong
            // word (ଶହ).
            var sup = d.Hundreds != null && (int)h < d.Hundreds.Length ? d.Hundreds[(int)h] : null;
            if (sup is not null && sup != "")
            {
                var supOut = new List<string?> { sup };
                if (r != 0) supOut.AddRange(IndicNumberWordsFn(r, d));
                return supOut;
            }
            var outp = new List<string?>();
            // Otherwise a bare hundred is just the magnitude word in the languages that declare it.
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
     * WESTERN / Slavic decimal composition (units + teens + tens + hundreds + thousand/million/billion, space-separated).
     * Shared by the East-Slavic (uk, be) and Armenian (hy) engines — they differ only in their DATA (`d.units` etc.),
     * routed through each language's own G2P by `renderNumber`. Needs the irregular round-hundred spellings in
     * `d.hundreds` (сто, двісті, …; Armenian հարյուր, երկուհարյուր, …). The leading "one" is OMITTED for a bare thousand
     * (тисяча / հազար, matching the bare hundred сто), but KEPT for million/billion (один мільйон — grammatical).
     *
     * ITS SCOPE, measured rather than assumed, because "why isn't this used more widely" is a recurring question.
     * Three engines read it (hy, nb, and uk/be below 1000); 115 languages compose privately, and 22 of those
     * files carry an explicit why-not. Four requirements gate entry, and a language must satisfy ALL of them:
     * irregular round hundreds expressible as a FLAT array; magnitudes that are single words per count;
     * tens-before-units; and NO connector between groups.
     *
     * A CONNECTOR SLOT WAS CONSIDERED AND DECLINED. It looks like the single highest-value knob — sq, oc, an,
     * ast, gl and is are each blocked on it alone — but the placement rule is different in every one of them:
     * Albanian puts ⟨e⟩ between ALL groups (një mijë e dyqind e tridhjetë e katër), Galician only between tens
     * and units, Occitan/Aragonese only inside the twenties, and Icelandic ⟨og⟩ only before a trailing
     * SINGLE-WORD remainder (eitt hundrað og einn, but eitt hundrað tuttugu og einn). One `connective: string`
     * field cannot express that set, and a placement enum with five members is the per-consumer knob this
     * consolidation exists to avoid — cf. the note in `dravidianNumberWords` on why Tamil does not migrate.
     * Revisit only if two languages are found to share a placement rule exactly.
     */
    public static readonly NumberComposer westernNumberWords = WesternNumberWordsFn;

    private static List<string?> WesternNumberWordsFn(double n, NumbersDef d)
    {
        var H = d.Hundreds!; // Western systems carry the irregular round-hundred spellings
        // The magnitude noun in the form its count selects, falling back to the invariant string when the
        // language authors no paradigm (which is most of them — Armenian's միլիոն does not inflect here).
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
            // Clamp rather than emit `undefined`: a 3-way selector against a 2-form table is a data error the
            // caller should not hear as the literal string "undefined" in its IPA.
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
            // omit the leading "one" for exactly 1000 (тисяча, not *один тисяча — a bare magnitude like the hundred сто)
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
        var outp = DravidianBelow1000(count, d);
        outp.Add(mag);
        return outp;
    }

    /**
     * DRAVIDIAN number composition — Indian 2-2-3 grouping like `indicNumberWords`, but able to say the
     * three things that composer structurally cannot, each of which made a whole language's numerals wrong:
     *
     *   1. FUSION. 21-99 is ONE word (kn ಇಪ್ಪತ್ತೊಂದು, ml ഇരുപത്തിയൊന്ന്), not two. `indicNumberWords` has a
     *      `compound` map for this, so this reason alone would not need a new composer; the next two do.
     *   2. SUPPLETIVE ROUND HUNDREDS/THOUSANDS. 200 is kn ಇನ್ನೂರು / ml ഇരുന്നൂറ്, 900 is ml തൊള്ളായിരം, and
     *      2000 is ml രണ്ടായിരം — single fused stems, not "two hundred"/"two thousand".
     *      `NumbersDef.hundreds` exists but only `westernNumberWords` reads it, and nothing expresses the
     *      thousands at all.
     *   3. COMBINING (oblique) MAGNITUDE FORMS. When a remainder follows, the noun changes: kn 1976 is
     *      ಸಾವಿರದ ಒಂಬೈನೂರಾ ಎಪ್ಪತ್ತಾರು, ml ആയിരത്തി തൊള്ളായിരത്തി എഴുപത്തിയാറ്. `indicNumberWords` emits the
     *      bare noun everywhere, so ml 1976 read ആയിരം ഒമ്പത് നൂറ് എഴുപത് ആറ് — five words for three, with
     *      the wrong hundred and no linkage.
     *
     * WHY IT IS HERE AND NOT A FOURTH PRIVATE COPY. Tamil, Telugu and Kannada each wrote their own composer
     * for overlapping subsets of the above; that duplication was the evidence, and named
     * Malayalam as the trigger to consolidate. It is, so this is that consolidation — te, kn and ml all read
     * it, and each of their corpus diffs is byte-identical across the migration.
     *
     * TAMIL DOES NOT MIGRATE, and the reason is recorded in tamil/numbers.ts: it fuses the COUNT into the
     * thousand for counts of 21-99 (23,000 = இருபத்தி மூவாயிரம், the ten's oblique plus a fused thousand),
     * and it spells a count of one as an attributive ஒரு before லட்சம்/கோடி. Neither is expressible here,
     * and inventing knobs for one consumer is what this consolidation exists to avoid.
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
        return string.Join(" ", compose(n, d).Select(w => w == null ? "?" : word(w)));
    }

    /**
     * THE DIGIT-AT-A-TIME READING — the fallback for a digit run `renderNumber` must refuse.
     *
     * ⚠ WHY THIS EXISTS. `Number.isSafeInteger` is used, correctly, to refuse composing a numeral whose low
     * digits the float has already lost: `9007199254740993` arrives as `…992`, so a composed reading would be
     * confidently WRONG about the quantity. That guard is right and stays. What was missing across the fleet
     * is the `else` — the numeral was either DELETED from the reading (11 engines) or its raw ASCII digits were
     * emitted straight into the IPA (44 engines), where no g2p reads them.
     *
     * Digit-at-a-time rather than BigInt, following commit 49f9a08's decision for Sinitic: every caller here
     * ALREADY reads a decimal tail this way, out of `d.units`, so the fallback needs no word the language's
     * data was never measured on — whereas composing a higher magnitude register (trillion, and above) would
     * invent words the dicts were never measured on and trade a silent drop for a confidently-wrong numeral.
     *
     * The cost is stated plainly: above 2^53 the reading is a DIGIT STRING, not a quantity. That is the honest
     * degradation, and it is what a speaker does with an account number anyway.
     *
     * Non-digit characters (a grouping comma, a stray sign) are skipped rather than guessed at. A `units`
     * entry that is empty is a genuine gap in the language's data and is likewise skipped, not invented.
     */
    public static string SpellDigits(string digits, NumbersDef d, Func<string, string> word)
    {
        var outp = new List<string>();
        foreach (var c in Js.CodePoints(digits))
        {
            var w = c.Length == 1 && c[0] >= '0' && c[0] <= '9' && (c[0] - '0') < d.Units.Length
                ? d.Units[c[0] - '0']
                : null;
            if (w == null || w == "") continue;
            // ⚠ `.map((w) => word(w))`, NOT `.map(word)`: Array.map passes (value, index, array), so a bare
            // reference hands the INDEX to any `word` with a second parameter — ckb's `phonemizeWord(word, oov?)`
            // received `0` as its OOV resolver and threw. Every engine's word reader passes through here.
            outp.Add(word(w));
        }
        return string.Join(" ", outp);
    }
}

/**
 * A Dravidian magnitude/hundred word's forms. `bare` and `combining` are the minimum — the combining
 * ("oblique") form is the one used when a remainder follows, and it is the joint that holds an Indian
 * numeral together: Kannada ಸಾವಿರದ, Malayalam ആയിരത്തി, Telugu నూట. `plural`/`pluralOblique` exist for
 * the languages that ALSO inflect the noun for a count above one (Telugu రెండు వందలు / రెండు వందల);
 * where they are absent the bare/combining pair is used at every count, which is Kannada and Malayalam.
 */
public sealed class DravidianForms
{
    public string Bare = "";
    public string Combining = "";
    public string? Plural;
    public string? PluralOblique;
}

/**
 * The data a Dravidian numeral needs beyond `indicNumberWords`. See `dravidianNumberWords` for why the
 * three extra fields exist; each of them is a thing `indicNumberWords` structurally cannot say.
 */
// NOT sealed: language defs (Kannada, Malayalam) extend it with their decimal word, exactly as the TS
// `interface KannadaNumbers extends NumbersDef` does.
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
