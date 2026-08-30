/**
 * Native Burmese / မြန်မာ (my) text phonemizer — canonical IPA.
 * Ported from src/languages/burmese/burmese.ts — see that file for the corpus evidence.
 */
using System.Text;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Burmese;

/** One syllable: the ONSET (voiceable) + the BODY (glide + rime + tone), plus `start` — the code-point index
 *  in the NFC word where the syllable begins (a legal word-boundary for segmentation). Split so the voicing
 *  lexicon can target the onset without re-parsing. */
public sealed class Syllable
{
    public string Onset = "";
    public string Body = "";
    public int Start;
}

public sealed class BurmesePhonemizer : ILanguage
{
    private const string Dir = "languages/burmese";
    private static BurmeseDef DEF => Manifest.DEF;
    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => DEF.ClausePunctuation;

    private const string VIRAMA = "်", // asat (kills the consonant → coda)
        STACKER = "္", // virama-stacker (U+1039): C1 ္ C2 conjunct — C1 is the coda, C2 the next onset
        ANUSVARA = "ံ",
        VISARGA = "း", // high-tone mark
        DOT_BELOW = "့", // creaky-tone mark
        MEDIAL_Y = "ျ", MEDIAL_R = "ြ", MEDIAL_W = "ွ", MEDIAL_H = "ှ",
        E_SIGN = "ေ", AA_SIGN = "ာ", AA_TALL = "ါ", II_SHORT = "ိ", II_LONG = "ီ",
        U_SHORT = "ု", U_LONG = "ူ";
    private static bool IsConsonant(string c) => DEF.Consonants.ContainsKey(c);

    /** The Burmese tone (Chao letter) for a syllable — ORTHOGRAPHIC, rule-derivable. */
    private static string ToneLetter(
        string vowel, List<string> signs, string coda, bool checkedSyl,
        bool asatOnVowel, bool hasVisarga, bool hasDot)
    {
        if (checkedSyl) return "";
        bool Has(string x) => signs.Contains(x);
        string cat;
        if (hasVisarga) cat = "high";
        else if (hasDot) cat = "creaky";
        else if (asatOnVowel) cat = "low"; // ော် (the asat-on-au low-tone marker)
        else if (coda != "open") cat = "low"; // all closed (nasal) syllables default low — the diphthong is low
        else if (vowel == "au" || vowel == "ai") cat = "high";
        else if (vowel == "inherent" || vowel == "wu") cat = "creaky";
        else if (Has(II_SHORT) && !Has(U_SHORT)) cat = "creaky"; // short ◌ိ (ို=o has both → falls through to low)
        else if (Has(U_SHORT) && !Has(II_SHORT)) cat = "creaky"; // short ◌ု
        else cat = "low"; // long ◌ီ/◌ူ, ◌ာ/ါ, ◌ေ, ◌ို
        return DEF.Tones.TryGetValue(cat, out var t) ? t : "";
    }

    private static readonly JsRe CODA_TAIL = JsRegex.Compile("[ɴʔ]$", "u");

    /**
     * Scan a Burmese word into syllables (onset + body + start). Exposed for the voicing-lexicon builder +
     * segmenter.
     */
    public static List<Syllable> Syllabify(string word)
    {
        var s = Js.CodePoints(Js.Normalize(word, NormalizationForm.FormC));
        var n = s.Count;
        var syls = new List<Syllable>();
        var i = 0;
        string At(int k) => k >= 0 && k < n ? s[k] : "";

        while (i < n)
        {
            var ch = s[i];
            if (DEF.IndependentVowels.TryGetValue(ch, out var indep))
            {
                var start0 = i;
                i++;
                var cat = DEF.IndependentTone.TryGetValue(ch, out var it) ? it : "low";
                while (i < n && (s[i] == VISARGA || s[i] == DOT_BELOW))
                {
                    cat = s[i] == VISARGA ? "high" : "creaky";
                    i++;
                }
                syls.Add(new Syllable
                {
                    Onset = "",
                    Body = indep + (DEF.Tones.TryGetValue(cat, out var tn) ? tn : ""),
                    Start = start0,
                });
                continue;
            }
            if (!IsConsonant(ch))
            {
                i++; // punctuation handled by text(); stray sign → skip
                continue;
            }
            var start = i;
            var onset = DEF.Consonants[ch];
            i++;
            var glide = "";
            bool wMedial = false, hasPalatal = false, hasH = false;
            while (i < n && (s[i] == MEDIAL_Y || s[i] == MEDIAL_R || s[i] == MEDIAL_W || s[i] == MEDIAL_H))
            {
                if (s[i] == MEDIAL_Y || s[i] == MEDIAL_R) hasPalatal = true;
                else if (s[i] == MEDIAL_W) wMedial = true;
                else if (s[i] == MEDIAL_H) hasH = true;
                i++;
            }
            if (hasH && DEF.Voiceless.TryGetValue(onset, out var vl)) onset = vl;
            if (hasPalatal) onset = DEF.Palatal.TryGetValue(onset, out var pl) ? pl : onset + "j";
            var signs = new List<string>();
            while (i < n && DEF.VowelSigns.ContainsKey(s[i]))
            {
                signs.Add(s[i]);
                i++;
            }
            bool Has(string x) => signs.Contains(x);
            var vowel = "inherent";
            if (Has(II_SHORT) && Has(U_SHORT)) vowel = "o"; // ို
            else if (Has(E_SIGN) && (Has(AA_SIGN) || Has(AA_TALL))) vowel = "au"; // ော / ေါ (tall-aa variant U+102B)
            else if (signs.Count > 0) vowel = DEF.VowelSigns[signs[^1]];
            if (wMedial && vowel != "inherent") glide = "w";
            var coda = "open";
            var asatOnVowel = false;
            if (At(i) == ANUSVARA)
            {
                coda = "anu";
                i++;
            }
            else if (IsConsonant(At(i)) && (At(i + 1) == VIRAMA || (At(i + 1) == DOT_BELOW && At(i + 2) == VIRAMA)))
            {
                coda = DEF.CodaClass.TryGetValue(s[i], out var cc) ? cc : "t";
                i += At(i + 1) == VIRAMA ? 2 : 1; // leave the dot for the tone-mark scan below
            }
            else if (IsConsonant(At(i)) && At(i + 1) == STACKER)
            {
                coda = DEF.CodaClass.TryGetValue(s[i], out var cc2) ? cc2 : "t";
                i += 2; // consume C1 + the stacker, leaving C2 as the next onset
            }
            else if (At(i) == VIRAMA)
            {
                asatOnVowel = true;
                i++;
            }
            if (vowel == "inherent" && (wMedial || onset == "w"))
            {
                if (coda == "ng" || coda == "open") { if (wMedial) glide = "w"; } // keep the glide, plain rime
                else vowel = "wu"; // round: ʊɴ / ʊʔ
            }
            bool hasVisarga = false, hasDot = false;
            while (i < n && !IsConsonant(s[i]) && !DEF.IndependentVowels.ContainsKey(s[i])
                   && !(CLAUSE_MARK.TryGetValue(s[i], out var cm) && cm.Length > 0))
            {
                if (s[i] == VISARGA) hasVisarga = true;
                else if (s[i] == DOT_BELOW) hasDot = true;
                i++;
            }

            var minor = vowel == "inherent" && coda == "open" && i < n && IsConsonant(s[i]);
            if (minor)
            {
                syls.Add(new Syllable { Onset = onset, Body = glide + "ə", Start = start });
                continue;
            }
            var rime = Lookup(coda, vowel) ?? Lookup("open", vowel) ?? "a";
            var checkedSyl = rime.EndsWith("ʔ", StringComparison.Ordinal);
            var tone = ToneLetter(vowel, signs, coda, checkedSyl, asatOnVowel, hasVisarga, hasDot);
            var codaChar = CODA_TAIL.IsMatch(rime) ? rime[^1..] : "";
            var nucleus = codaChar.Length > 0 ? rime[..^codaChar.Length] : rime;
            syls.Add(new Syllable { Onset = onset, Body = glide + nucleus + tone + codaChar, Start = start });
        }
        return syls;
    }

    /** `DEF.rimeChart[coda]?.[vowel]` — a missing coda row or vowel column is `undefined`, not a throw. */
    private static string? Lookup(string coda, string vowel) =>
        DEF.RimeChart.TryGetValue(coda, out var row) && row.TryGetValue(vowel, out var v) ? v : null;

    private static IReadOnlyDictionary<string, string> VOICE => DEF.Voicing;
    // Lazy (registry.ts imports every language eagerly; the TSVs are only read on first Burmese use).
    private static Dictionary<string, string>? VOICING_LEXICON;
    private static readonly object GATE = new();
    private static Dictionary<string, string> VoicingLexicon()
    {
        lock (GATE) return VOICING_LEXICON ??= LoadTsv.LoadTsvMap(Dir, "voicing-lexicon.tsv", optional: true);
    }
    private static Dictionary<string, string>? DICTIONARY;
    private static Dictionary<string, string> Dictionary_()
    {
        lock (GATE) return DICTIONARY ??= LoadTsv.LoadTsvMap(Dir, "dictionary.tsv", optional: true);
    }

    /** RULE-only word → IPA (syllabify + orthographic tone + voicing sandhi), WITHOUT the pronunciation-lexicon
     *  override. Exposed for the dict miner, which must compare the gold against the RULES — otherwise it
     *  reads the dict it is rebuilding and drops every covered entry. */
    public static string PhonemizeWordRules(string word)
    {
        var nfc = Js.Normalize(word, NormalizationForm.FormC);
        var syls = Syllabify(nfc);
        if (VoicingLexicon().TryGetValue(nfc, out var flags) && flags.Length > 0)
        {
            for (var k = 0; k < syls.Count && k < flags.Length; k++)
            {
                if (flags[k] == '1' && VOICE.TryGetValue(syls[k].Onset, out var v) && v.Length > 0)
                    syls[k].Onset = v;
            }
        }
        return string.Concat(syls.Select(s => s.Onset + s.Body)).Normalize(NormalizationForm.FormC);
    }

    /**
     * One segmented Burmese WORD → canonical IPA: the authoritative lexicon override, else the rule engine.
     */
    private static string PhonemizeSubword(string word)
    {
        // JS `lex ? lex : rules(word)` — a blank/empty dict value is FALSY and falls through to the rules.
        var lex = Dictionary_().TryGetValue(Js.Normalize(word, NormalizationForm.FormC), out var l) ? l : null;
        return !string.IsNullOrEmpty(lex) ? lex : PhonemizeWordRules(word);
    }

    private static (HashSet<string> Set, int MaxLen)? SEG;
    private static (HashSet<string> Set, int MaxLen) SegWords()
    {
        lock (GATE) return SEG ??= Segment.LoadSegWords(Dir);
    }

    /** Segment a spaceless Burmese run into words. */
    public static List<string> SegmentWord(string token)
    {
        var (set, maxLen) = SegWords();
        var cs = Js.CodePoints(Js.Normalize(token, NormalizationForm.FormC));
        if (set.Count == 0 || cs.Count == 0) return new List<string> { token };
        var sylls = Syllabify(string.Concat(cs)); // whole-run pass, reused for both the boundaries and the safety check
        var bound = new HashSet<int> { cs.Count };
        foreach (var syl in sylls) bound.Add(syl.Start);
        var parts = Segment.SegmentByDag(cs, set, maxLen, bound);
        if (parts.Count <= 1 || parts.All(w => set.Contains(w))) return parts; // single word, or a full dictionary cover
        // ⚠ THE U+0001 JOIN SEPARATOR IS LOAD-BEARING: what is compared is the syllable SEQUENCE, not the
        // concatenated text, so two boundary placements spelling the same string must not compare equal.
        var whole = string.Join("\u0001", sylls.Select(s => s.Body));
        var split = string.Join("\u0001", parts.SelectMany(p => Syllabify(p).Select(s => s.Body)));
        return whole == split ? parts : new List<string> { token }; // split changes a syllable body (lost minor-ə) → keep whole
    }

    /**
     * One Burmese TOKEN → IPA: segment the spaceless run into words, phonemize each (voicing per word),
     * space-join.
     */
    public static string PhonemizeWord(string token) =>
        string.Join(" ", SegmentWord(token).Select(PhonemizeSubword).Where(w => w != ""));

    private const string MY_DIGITS = "\u1040-\u1049";
    // ⚠ THE LETTER CLASS HAS A HOLE AT U+104A–U+104B ON PURPOSE. Those are Burmese's own phrase and sentence
    // marks and they sit inside the Myanmar block, so a class written as one unbroken range swallows them and
    // the clause branch below can never be reached.
    private static readonly JsRe TOKEN = JsRegex.Compile(
        $"([\u1000-\u103F\u104C-\u109F\ua9e0-\ua9f9]+)|([0-9{MY_DIGITS}]+)|([။၊.?!,])", "gu");

    public string Text(string rawInput)
    {
        var input = Normalize.NormalizeBurmese(rawInput);
        var (sink, finish) = Clauses.ClauseSink();
        // This engine scans with its own loop, so it reports to the trace explicitly (#1150).
        Core.Trace.EnterEngine(input);
        var cursor = 0;
        foreach (var m in TOKEN.Matches(input))
        {
            if (m.Index > cursor) Clauses.EmitUnclaimed(input[cursor..m.Index], sink, cursor);
            cursor = m.Index + m.Length;
            Core.Trace.BeginToken(m.Index, cursor, m.Value);
            if (m.Groups[1].Success && m.Groups[1].Value.Length > 0) sink.Emit(PhonemizeWord(m.Groups[1].Value));
            else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
            {
                var ascii = string.Concat(Js.CodePoints(m.Groups[2].Value).Select(c =>
                {
                    var cp = Js.CodePointAt0(c);
                    return cp >= 0x1040 && cp <= 0x1049 ? Js.NumberToString(cp - 0x1040) : c;
                }));
                var n = Js.Number(ascii);
                if (double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d && n >= 0)
                    sink.Emit(PhonemizeWord(Numbers.NumberToWords(n)));
                else
                    foreach (var wd in Numbers.SpellDigits(ascii).Split(' ')) sink.Emit(PhonemizeWord(wd));
            }
            else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
            {
                if (CLAUSE_MARK.TryGetValue(m.Groups[3].Value, out var mk) && mk.Length > 0) sink.Pause(mk);
            }
            Core.Trace.EndToken();
        }
        if (cursor < input.Length) Clauses.EmitUnclaimed(input[cursor..], sink, cursor);
        return finish();
    }

    /** Build the Burmese phonemizer. */
    public static ILanguage CreateBurmese() => new BurmesePhonemizer();

    internal static void RegisterSelf() => Registry.Register("burmese", CreateBurmese);
}
