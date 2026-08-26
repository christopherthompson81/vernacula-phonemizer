/**
 * Khmer / ភាសាខ្មែរ (km) text phonemizer — the two-series sesquisyllabic abugida per Huffman (1970): a unit
 * scan, coda assignment, then a render pass with word-wide series governance. Lexicon-first when shipped.
 * Ported from src/languages/khmer/khmer.ts — see that file for the corpus evidence and the defect history.
 */
using System.Text;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Khmer;

public sealed class KhmerDef
{
    public IReadOnlyDictionary<string, string[]> Consonants { get; init; } = new Dictionary<string, string[]>();
    public string[] Diacritics { get; init; } = [];
    public string[] PassiveConsonants { get; init; } = [];
    public string[] NasalConsonants { get; init; } = [];
    public IReadOnlyDictionary<string, string[]> Vowels { get; init; } = new Dictionary<string, string[]>();
    public IReadOnlyDictionary<string, string[]> VowelCombos { get; init; } = new Dictionary<string, string[]>();
    public IReadOnlyDictionary<string, string> Codas { get; init; } = new Dictionary<string, string>();
    /** U+17A3–U+17B3 → its IN-WORD reading (not the letter name); see the manifest for the provenance. */
    public IReadOnlyDictionary<string, string> IndependentVowels { get; init; } = new Dictionary<string, string>();
    public string[] Inherent { get; init; } = [];
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
}

public static class KhmerPhonemizer
{
    public static readonly KhmerDef DEF = LoadManifest.Load<KhmerDef>("languages/khmer", "khmer.jsonc");

    private const string COENG = "្";        // U+17D2 — subscript former
    private const string TOANDAKHIAT = "៍";  // U+17CD — silences the consonant it sits on
    private const string MUUSIKATOAN = "៉";  // U+17C9 — 2nd-series (o) → 1st-series (a)
    private const string TRIISAP = "៊";      // U+17CA — 1st-series (a) → 2nd-series (o)
    private const string BANTOC = "់";       // U+17CB — shortens the vowel; sits on a coda consonant
    private const string SAMYOK = "័";       // U+17D0 — samyok sannya
    private const string REAHMUK = "ះ";      // U+17C7 — adds an -h coda
    private const string NIKAHIT = "ំ";      // U+17C6 — adds an -m coda

    private static readonly HashSet<string> DIACRITICS = new(DEF.Diacritics, StringComparer.Ordinal);

    /** A long vowel shortened by the /bantaq/ (់). ⚠ iə → oə is BANTAQ-ONLY, which falls out of this table
     *  being consulted solely on `unit.shorten`. */
    private static readonly Dictionary<string, string> SHORTEN = new(StringComparer.Ordinal)
    {
        ["aː"] = "a", ["ɛː"] = "ɛ", ["eː"] = "e", ["oː"] = "o", ["uː"] = "u", ["iː"] = "i", ["ɨː"] = "ɨ",
        ["əː"] = "ə", ["ɔː"] = "ɔ", ["ɑː"] = "ɑ",
        ["iə"] = "oə",
    };

    private static readonly HashSet<string> PASSIVE = new(DEF.PassiveConsonants, StringComparer.Ordinal);
    private static readonly HashSet<string> NASAL = new(DEF.NasalConsonants, StringComparer.Ordinal);

    private sealed class Unit
    {
        public List<string> Ons = new();
        public string? Vs;
        public string? Post;
        public bool Bantaq;
        public string? Ser; // "a" | "o" | null
        public bool Bp;
        public string? Coda;
        public bool Shorten;
        public bool CodaShort;
        public bool Samyok;
        /** An INDEPENDENT VOWEL's literal IPA — the unit is a whole syllable nucleus with no onset letter. */
        public string? Iv;
        /** TS attaches this dynamically (`(cur as {drop?: boolean}).drop = true`); a field here. */
        public bool Drop;
    }

    /** The `vs` a unit carries when it IS an independent vowel — a SENTINEL, never looked up in `DEF.vowels`.
     *  Coda assignment asks `prev.vs !== null`, and an independent vowel's vowel IS written (as the letter). */
    private const string IV_VS = "\u0000";

    private static readonly Dictionary<string, string> LEX =
        LoadTsv.LoadTsvMap("languages/khmer", "km-lexicon.tsv", optional: true);
    private static readonly Dictionary<string, string> DICT =
        LoadTsv.LoadTsvMap("languages/khmer", "km-lexicon-dict.tsv", optional: true);
    private static readonly Dictionary<string, string> KAIKKI =
        LoadTsv.LoadTsvMap("languages/khmer", "km-lexicon-kaikki.tsv", optional: true);

    /** One Khmer word → canonical IPA. SHIPPED path: the wikipron-verified exceptions lexicon, then the kaikki
     *  tier, then the independent dictionary, then the rule engine. */
    public static string PhonemizeWord(string word)
    {
        if (LEX.TryGetValue(word, out var lex)) return lex;
        if (KAIKKI.TryGetValue(word, out var kaikki)) return kaikki;
        if (DICT.TryGetValue(word, out var dict)) return dict;
        return PhonemizeWordRules(word);
    }

    /** One Khmer word → canonical IPA by RULE ONLY — the non-circular referee-eval signal. */
    public static string PhonemizeWordRules(string word)
    {
        var s = Js.CodePoints(word);
        var n = s.Count;
        string? At(int k) => k >= 0 && k < n ? s[k] : null;

        // ---- PASS 1: scan into orthographic units ----------------------------------------------------
        var units = new List<Unit>();
        var i = 0;
        while (i < n)
        {
            var c = s[i];
            if (DEF.IndependentVowels.TryGetValue(c, out var ivIpa))
            {
                i += 1;
                units.Add(new Unit { Vs = IV_VS, Iv = ivIpa });
                continue;
            }
            if (!DEF.Consonants.ContainsKey(c)) { i += 1; continue; } // stray marks — nothing to say
            var ons = new List<string> { c };
            string? ser = null;
            i += 1;
            var muus = false;
            while (At(i) == MUUSIKATOAN || At(i) == TRIISAP)
            {
                ser = At(i) == MUUSIKATOAN ? "a" : "o";
                muus |= At(i) == MUUSIKATOAN;
                i += 1;
            }
            var bp = muus && ons[0] == "ប";
            while (At(i) == COENG && DEF.Consonants.ContainsKey(At(i + 1) ?? ""))
            {
                ons.Add(s[i + 1]);
                i += 2;
                while (At(i) == MUUSIKATOAN || At(i) == TRIISAP) { ser = At(i) == MUUSIKATOAN ? "a" : "o"; i += 1; }
            }
            var vs = DEF.Vowels.ContainsKey(At(i) ?? "") ? s[i] : null;
            if (vs is not null) i += 1;
            string? post = null;
            if (vs is not null && vs != REAHMUK && vs != NIKAHIT && (At(i) == REAHMUK || At(i) == NIKAHIT))
            {
                post = s[i];
                i += 1;
            }
            var silent = false;
            var bantaq = false;
            var samyok = false;
            while (DIACRITICS.Contains(At(i) ?? ""))
            {
                if (At(i) == TOANDAKHIAT) silent = true;
                if (At(i) == BANTOC) bantaq = true;
                if (At(i) == SAMYOK) samyok = true;
                i += 1;
            }
            if (!silent)
                units.Add(new Unit { Ons = ons, Vs = vs, Post = post, Bantaq = bantaq, Ser = ser, Bp = bp, Samyok = samyok });
        }
        if (units.Count == 0) return word;

        // ---- PASS 2: coda assignment -----------------------------------------------------------------
        for (var u = 1; u < units.Count; u++)
        {
            var cur = units[u];
            if (cur.Bantaq && cur.Vs is null && cur.Post is null && units[u - 1].Coda is null)
            {
                units[u - 1].Coda = cur.Ons[0];
                units[u - 1].Shorten = true;
                cur.Drop = true;
            }
        }
        for (var u = 1; u < units.Count - 1; u++)
        {
            var cur = units[u];
            var prev = units[u - 1];
            var next = units[u + 1];
            var nextIsBareFinal = u + 1 == units.Count - 1
                && next.Vs is null && next.Post is null && !next.Drop;
            if (cur.Vs is null && cur.Post is null && !cur.Bantaq && cur.Ons.Count == 1
                && !cur.Drop && cur.Coda is null && !nextIsBareFinal
                && prev.Coda is null && prev.Vs is not null)
            {
                prev.Coda = cur.Ons[0];
                cur.Drop = true;
            }
        }
        var live = units.Where(u => !u.Drop).ToList();
        var last = live[^1];
        if (live.Count >= 2 && last.Vs is null && last.Post is null && !last.Bantaq && last.Coda is null
            && live[^2].Coda is null)
        {
            var prev = live[^2];
            prev.Coda = last.Ons[0];
            prev.CodaShort = last.Ons.Count > 1; // a silent trailing subscript (doubled/type-3) → short inherent
            live = live.GetRange(0, live.Count - 1);
        }
        units.Clear();
        units.AddRange(live);
        for (var u = 1; u < units.Count; u++)
        {
            var cur = units[u];
            var prev = units[u - 1];
            if (cur.Ons.Count >= 2 && NASAL.Contains(cur.Ons[0]) && prev.Coda is null)
            {
                prev.Coda = cur.Ons[0];
                cur.Ons = cur.Ons.GetRange(1, cur.Ons.Count - 1);
            }
        }

        // ---- PASS 3: render with GOVERNANCE running-state ---------------------------------------------
        string? lastDom = null;
        var @out = "";
        for (var u = 0; u < units.Count; u++)
        {
            var unit = units[u];
            if (unit.Iv is not null)
            {
                @out += unit.Iv + (unit.Coda is not null ? DEF.Codas.GetValueOrDefault(unit.Coda) ?? "" : "");
                continue;
            }
            var onset = "";
            for (var k = 0; k < unit.Ons.Count; k++)
            {
                var letter = unit.Ons[k];
                var nextLetter = k + 1 < unit.Ons.Count ? unit.Ons[k + 1] : null;
                if (letter == "ហ" && nextLetter == "វ") { onset += "f"; k += 1; continue; }
                if (letter == "ដ" && nextLetter == "ឋ") { onset += "tt"; k += 1; continue; }
                onset += letter == "ប" && (unit.Bp || unit.Ons.Count > 1) && k == 0 ? "p" : DEF.Consonants[letter][0];
            }
            string gov;
            if (unit.Ser is not null)
            {
                gov = unit.Ser;
                lastDom = gov;
            }
            else
            {
                string? onsetDom = null;
                foreach (var letter in unit.Ons) if (!PASSIVE.Contains(letter)) onsetDom = DEF.Consonants[letter][1];
                if (onsetDom is not null) { gov = onsetDom; lastDom = gov; }
                else gov = lastDom ?? DEF.Consonants[unit.Ons[^1]][1];
            }
            var oIdx = gov == "a" ? 0 : 1;
            var codaIpa = unit.Coda is not null ? DEF.Codas.GetValueOrDefault(unit.Coda) ?? "" : "";
            string nucleus;
            if (unit.Post is not null)
            {
                nucleus = DEF.VowelCombos.TryGetValue(unit.Vs! + unit.Post, out var combo)
                    ? combo[oIdx]
                    : (unit.Vs is not null ? DEF.Vowels[unit.Vs][oIdx] : DEF.Inherent[oIdx])
                      + (unit.Post == NIKAHIT ? "m" : "h");
            }
            else if (unit.Vs is not null)
            {
                nucleus = DEF.Vowels[unit.Vs][oIdx];
                if (unit.Shorten) nucleus = SHORTEN.GetValueOrDefault(nucleus) ?? nucleus;
                if (u < units.Count - 1 && (unit.Vs == "ិ" || unit.Vs == "ី") && unit.Coda is null)
                    nucleus = unit.Vs == "ី" ? "iː" : gov == "a" ? "e" : "i";
                if (unit.Vs == "ី" && unit.Coda is not null) nucleus = "iː";
            }
            else if (u == units.Count - 1)
            {
                var @short = unit.CodaShort || unit.Shorten;
                nucleus = codaIpa == "" || !@short ? DEF.Inherent[oIdx] : (gov == "a" ? "ɑ" : "uə");
                if (unit.Samyok && unit.Coda == "រ") nucleus = "oə";
            }
            else
            {
                nucleus = gov == "a" ? "ɑ"
                    : unit.Coda is not null ? (unit.Coda == "ល" || unit.Coda == "ង" ? "uə" : "u")
                    : u > 0 ? "eə" : "ɔ";
            }
            // ⚠ THE CONDITION IS THE ASSIGNED CODA, NOT THE SPELLING — PASS 2 has already decided whether
            // ⟨ង⟩ is a coda or an onset, and only a coda absorbs the nikahit's [-m].
            if (nucleus.EndsWith("m", StringComparison.Ordinal) && unit.Coda == "ង") nucleus = nucleus[..^1];
            @out += onset + nucleus + codaIpa;
        }
        return @out.Normalize(NormalizationForm.FormC);
    }

    private static readonly JsRe TOKEN = JsRegex.Compile("([ក-៓ៜ-៝]+)|([\\d០-៩]+)|([។៕?!,.៖])", "gu");

    /**
     * Build the Khmer phonemizer. `segment` restores the word boundaries Khmer does not write (the
     * perceptron) and defaults ON; the async BiLSTM path passes false because it supplies its own.
     */
    public static ILanguage CreateKhmer(bool? segmentOpt = null)
    {
        var segment = segmentOpt ?? true;
        return new Engine(segment);
    }

    private sealed class Engine : ILanguage
    {
        private readonly bool _segment;
        internal Engine(bool segment) => _segment = segment;

        public string Text(string input)
        {
            // Normalization BEFORE tokenizing; boundary restoration AFTER normalization, because the
            // normalizer's own separator class already includes U+200B.
            var normalized = Normalize.NormalizeKhmer(input);
            return Clauses.AssembleClauses(
                _segment ? KhmerPerceptron.RestoreBoundaries(normalized) : normalized,
                TOKEN,
                (m, sink) =>
                {
                    if (m.Groups[1].Success && m.Groups[1].Value.Length > 0) sink.Emit(PhonemizeWord(m.Groups[1].Value));
                    else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
                    {
                        var ascii = string.Concat(Js.CodePoints(m.Groups[2].Value).Select(d =>
                            string.CompareOrdinal(d, "០") >= 0 && string.CompareOrdinal(d, "៩") <= 0
                                ? Js.NumberToString(Js.CodePointAt0(d) - 0x17e0)
                                : d));
                        foreach (var wd in Numbers.NumberToKhmerWords(Js.Number(ascii), ascii)) sink.Emit(PhonemizeWord(wd));
                    }
                    else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
                    {
                        var mk = DEF.ClausePunctuation.GetValueOrDefault(m.Groups[3].Value);
                        if (mk is not null && mk.Length > 0) sink.Pause(mk);
                    }
                });
        }
    }

    internal static void RegisterSelf() => Registry.Register("khmer", () => CreateKhmer());
}
