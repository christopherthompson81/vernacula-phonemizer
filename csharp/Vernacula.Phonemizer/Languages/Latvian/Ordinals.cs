/**
 * Latvian ORDINALS — the masculine definite adjective, declined into the cases the corpus's head nouns state.
 * Ported from src/languages/latvian/ordinals.ts, where the attestation for every stem and ending lives.
 *
 * ⚠ THE TABLE IS CLOSED TO MASCULINE HEAD NOUNS ON PURPOSE, so gender never has to be inferred: `gads`,
 * `gadsimts` and all twelve months are masculine, which is what makes the closed set closed.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Latvian;

public static class Ordinals
{
    /** The grammatical slots the definite adjective distinguishes, as far as this table needs them. */
    public enum Case { NomSg, GenSg, DatSg, AccSg, LocSg, NomPl, DatPl, AccPl, LocPl }

    /** The masculine DEFINITE adjective endings.
     *  ⚠ GENITIVE PLURAL AND ACCUSATIVE SINGULAR SHARE `-o` — a real syncretism, not a shortcut, which is why
     *  `gadu` needs no disambiguation. */
    private static readonly IReadOnlyDictionary<Case, string> ENDING = new Dictionary<Case, string>
    {
        [Case.NomSg] = "ais", [Case.GenSg] = "ā", [Case.DatSg] = "ajam", [Case.AccSg] = "o",
        [Case.LocSg] = "ajā", [Case.NomPl] = "ie", [Case.DatPl] = "ajiem", [Case.AccPl] = "os",
        [Case.LocPl] = "ajos",
    };

    /** The ordinal STEMS for 1–9 — irregular against the cardinals, so listed rather than derived. Index 0
     *  is unused: there is no zeroth. */
    private static readonly string[] STEM =
        ["", "pirm", "otr", "treš", "ceturt", "piekt", "sest", "septīt", "astot", "devīt"];

    /** 10–19 and the round tens take the CARDINAL as their stem. */
    private static readonly string[] TEEN =
    [
        "desmit", "vienpadsmit", "divpadsmit", "trīspadsmit", "četrpadsmit",
        "piecpadsmit", "sešpadsmit", "septiņpadsmit", "astoņpadsmit", "deviņpadsmit",
    ];
    private static readonly string[] TEN =
    [
        "", "", "divdesmit", "trīsdesmit", "četrdesmit",
        "piecdesmit", "sešdesmit", "septiņdesmit", "astoņdesmit", "deviņdesmit",
    ];

    /**
     * ⚠ THE TWO DECLENSIONS ARE NOT INTERCHANGEABLE. First-declension `-s` nouns take dat `-am` / acc `-u` /
     * loc `-ā`; second-declension `-is` nouns take `-im` / `-i` / `-ī`. Collapsing them would accept
     * *janvāram* and miss the `janvārī` the corpus actually writes.
     */
    private static Dictionary<string, Case> Decline(string stem, bool second, string? genitive = null) => new(StringComparer.Ordinal)
    {
        [second ? $"{stem}is" : $"{stem}s"] = Case.NomSg,
        [genitive ?? $"{stem}a"] = Case.GenSg,
        [second ? $"{stem}im" : $"{stem}am"] = Case.DatSg,
        [second ? $"{stem}i" : $"{stem}u"] = Case.AccSg,
        [second ? $"{stem}ī" : $"{stem}ā"] = Case.LocSg,
    };

    /** `gads` and `gadsimts` also occur in the PLURAL after an ordinal — *20. gados*, *5. gadsimtos*. */
    private static Dictionary<string, Case> DeclineWithPlural(string stem)
    {
        var f = Decline(stem, false);
        f[$"{stem}i"] = Case.NomPl;
        f[$"{stem}iem"] = Case.DatPl;
        f[$"{stem}us"] = Case.AccPl;
        f[$"{stem}os"] = Case.LocPl;
        return f;
    }

    /** ⚠ `aprīlis` PALATALISES IN THE GENITIVE — *aprīļa*, not *aprīla* — so its genitive is passed
     *  explicitly. The corpus has it 11 times in one article; the regular form is not Latvian. */
    public static readonly IReadOnlyDictionary<string, Case> HEAD_NOUN = BuildHeadNouns();

    private static Dictionary<string, Case> BuildHeadNouns()
    {
        var all = new Dictionary<string, Case>(StringComparer.Ordinal);
        void Add(Dictionary<string, Case> d) { foreach (var (k, v) in d) all[k] = v; }
        Add(DeclineWithPlural("gad"));
        Add(DeclineWithPlural("gadsimt"));
        Add(Decline("janvār", true));
        Add(Decline("februār", true));
        Add(Decline("mart", false));
        Add(Decline("aprīl", true, "aprīļa"));
        Add(Decline("maij", false));
        Add(Decline("jūnij", false));
        Add(Decline("jūlij", false));
        Add(Decline("august", false));
        Add(Decline("septembr", true));
        Add(Decline("oktobr", true));
        Add(Decline("novembr", true));
        Add(Decline("decembr", true));
        return all;
    }

    private static readonly JsRe THOUSAND_HEAD = JsRegex.Compile("^tūkstotis\\b", "u");

    /**
     * The number as a Latvian ORDINAL in the given case, or `null` when the composition is not one this file
     * is willing to claim.
     *
     * ⚠ ROUND HUNDREDS AND THOUSANDS ARE REFUSED, and refusing is the point. `200.` is *divsimtais* and
     * `2000.` *divtūkstošais* — FUSED forms, not the space-separated *divi simti* the cardinal compositor
     * emits — and `attest.ts` found `divsimtais`, `tūkstošais` and `divtūkstošais` at ZERO tokens each.
     * Composing them would be inventing a word to fill a slot.
     */
    public static string? OrdinalWords(double n, Case c)
    {
        if (!double.IsInteger(n) || n < 1 || n > 9999) return null;
        var end = ENDING[c];

        // Only the LAST element of a Latvian compound numeral is ordinal — *tūkstoš astoņi simti astoņdesmit
        // PIEKTAIS* — so the head is read as an ordinary cardinal.
        var within100 = n % 100;
        string atom;
        double head;
        /**
         * ⚠ THE BOUND IS 10, NOT 11, AND STARTING AT 11 DELETED THE NUMERAL. A last-two-digits value of
         * exactly 10 is not `n % 10 !== 0`, so it fell through to the round-tens arm and indexed `TEN[1]` —
         * the empty string, a placeholder that exists only because `TEN` is indexed by the tens digit and
         * there is no "onety". The ending was then emitted alone: `10.` → *ais*.
         */
        if (within100 >= 10 && within100 <= 19) { atom = TEEN[(int)within100 - 10]; head = n - within100; }
        else if (n % 10 != 0) { atom = STEM[(int)(n % 10)]; head = n - n % 10; }
        else if (within100 != 0) { atom = TEN[(int)(within100 / 10)]; head = n - within100; }
        else return null; // round hundred or thousand — see the note above

        if (head == 0) return atom + end;
        /**
         * ⚠ THE YEAR'S THOUSAND IS `tūkstoš`, NOT `tūkstotis`. Numbers.cs emits the noun *tūkstotis* because a
         * counted thousand IS a noun; in a year the same digit is the indeclinable numeral prefix — *tūkstoš
         * deviņi simti*, never *tūkstotis deviņi simti*.
         */
        var headWords = THOUSAND_HEAD.Replace(Numbers.NumberToWords(head), "tūkstoš");
        return $"{headWords} {atom}{end}";
    }
}
