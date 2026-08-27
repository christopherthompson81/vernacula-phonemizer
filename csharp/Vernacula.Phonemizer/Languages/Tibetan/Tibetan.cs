/**
 * Tibetan (bo) phonemizer — a Lhasa syllable-stack RULE ENGINE, not a scan. Ported from
 * src/languages/tibetan/tibetan.ts, whose comments carry the sources (Tournadre; the JIPA "Central Tibetan
 * (Lhasa)" illustration) and the corpus evidence for every exception.
 *
 * This file owns the stack GRAMMAR: parse each syllable into prefix · superscript · root · subscript ·
 * vowel · suffix · post-suffix from the Unicode full (U+0F40–0F6C) vs subjoined (U+0F90–0FBC) distinction,
 * then read it — tone from tonogenesis, onset-cluster realization (ya-/ra-/la-btags), and suffix-driven
 * umlaut / length / nasalization / glottalization. The letter VALUES live in tibetan.jsonc.
 */
using Vernacula.Phonemizer.Core;

using TibetanNormalize = Vernacula.Phonemizer.Languages.Tibetan.Normalize;

namespace Vernacula.Phonemizer.Languages.Tibetan;

public static class TibetanPhonemizer
{
    private static readonly TibetanDef DEF = Manifest.MANIFEST;

    /** The manifest keys letter tables by the character; the parser scans codepoints. */
    private static Dictionary<int, string> ByCodepoint(IReadOnlyDictionary<string, string> table)
    {
        var d = new Dictionary<int, string>();
        foreach (var (ch, v) in table) d[char.ConvertToUtf32(ch, 0)] = v;
        return d;
    }

    private static readonly Dictionary<int, string> FULL = ByCodepoint(DEF.Letters);
    private static readonly Dictionary<int, string> VSIGN = ByCodepoint(DEF.VowelSigns);

    private static readonly HashSet<string> VOICELESS =
        ["k", "kh", "c", "ch", "t", "th", "p", "ph", "ts", "tsh", "sh", "s", "h", "T", "Th"];
    private static readonly HashSet<string> VOICED = ["g", "j", "d", "b", "dz", "zh", "z", "D"];
    private static readonly HashSet<string> SONORANT = ["ng", "ny", "n", "m", "w", "y", "r", "l", "N"];
    private static readonly HashSet<string> SUPERSCRIPT = ["r", "l", "s"];
    private static readonly HashSet<string> PREFIX = ["g", "d", "b", "m", "'"];
    private static readonly HashSet<string> SUFFIX = ["g", "ng", "d", "n", "b", "m", "'", "r", "l", "s"];

    /** Which root letters each of the 5 prefixes may legally precede (classical Tibetan spelling) — the
     *  disambiguator for a VOWEL-LESS stack: a leading g/d/b/m/' is a PREFIX only if it may precede the
     *  next letter, else it is the ROOT. */
    private static readonly Dictionary<string, HashSet<string>> PREFIX_ROOT = new()
    {
        ["g"] = ["c", "ny", "t", "d", "n", "ts", "zh", "z", "y", "sh", "s"],
        ["d"] = ["k", "g", "ng", "p", "b", "m"],
        ["b"] = ["k", "g", "c", "t", "d", "ts", "zh", "z", "sh", "s"],
        ["m"] = ["kh", "g", "ng", "ch", "j", "ny", "th", "d", "n", "tsh", "dz"],
        ["'"] = ["kh", "g", "ch", "j", "th", "d", "ph", "b", "tsh", "dz"],
    };

    private sealed class Unit
    {
        public string Full = "";
        public List<string> Subs = [];
    }

    /** Find the root unit index of a vowel-less (inherent-/a/) syllable from its consonant units. */
    private static int FindRootIdx(List<Unit> units)
    {
        // The root is the only STACKABLE slot: a unit carrying subjoined letters IS the root; prefixes and
        // suffixes are always bare single letters.
        var stacked = units.FindIndex(u => u.Subs.Count > 0);
        if (stacked >= 0) return stacked;
        var n = units.Count;
        if (n == 1) return 0;
        string F(int i) => units[i].Full;
        // prefix+root only if the 2nd letter cannot itself be a suffix
        if (n == 2) return PREFIX.Contains(F(0)) && !SUFFIX.Contains(F(1)) ? 1 : 0;
        // n ≥ 3: a leading prefix that LEGALLY precedes the next letter → prefix+root(+suffixes);
        // otherwise root+suffix+postsuffix.
        return PREFIX.Contains(F(0)) && PREFIX_ROOT[F(0)].Contains(F(1)) ? 1 : 0;
    }

    private static IReadOnlyDictionary<string, string> UNASP => DEF.Unaspirated;
    private static IReadOnlyDictionary<string, string> ASP => DEF.Aspirated;
    private static IReadOnlyDictionary<string, string> FRIC => DEF.Fricatives;
    private static IReadOnlyDictionary<string, string> SON => DEF.Sonorants;

    private sealed class Stack
    {
        public string? Prefix;
        public string? Superscript;
        public string Root = "";
        public string? Subscript;
        public bool SubH;   // subjoined ha (lha, hra…)
        public bool SubF;   // ⟨ཧྥ⟩ ha + subjoined PHA — the loanword digraph for /f/
        public string Vowel = "a";
        public string? Vowel2; // a second vowel from a hiatus ⟨'⟩+vowel — the diminutive འུ → diphthong
        public bool NasalMark;
        public string? Suffix;
        public string? Postsuffix;
    }

    private static readonly string[] SUBSCRIPT_SET = ["y", "r", "l", "w"];
    private static readonly string[] SUB_NON_ROOT = ["y", "r", "l", "w", "h"];

    /** Parse one Tibetan syllable (codepoints between tsheg) into its stack components. */
    private static Stack? ParseSyllable(List<int> cps)
    {
        var units = new List<Unit>();
        var vowel = "a";
        string? vowel2 = null;
        var nasalMark = false;
        var rootIdx = -1;      // the unit the vowel sign attaches to (= the root), if a vowel sign is present
        var pendingAchung = false; // a non-initial ⟨'⟩ that may carry a hiatus vowel (the diminutive འུ etc.)
        foreach (var c in cps)
        {
            if (c >= 0x0f40 && c <= 0x0f6c && FULL.TryGetValue(c, out var f))
            {
                if (c == 0x0f60 && units.Count >= 1) pendingAchung = true; // hold: ⟨'⟩ after a root
                else units.Add(new Unit { Full = f });
            }
            else if (c >= 0x0f90 && c <= 0x0fbc)
            {
                if (FULL.TryGetValue(c - 0x50, out var w) && units.Count > 0) units[^1].Subs.Add(w);
            }
            else if (VSIGN.TryGetValue(c, out var vs))
            {
                if (pendingAchung) vowel2 = vs; // ⟨'⟩+vowel → the syllable's second (diphthong) vowel
                else
                {
                    vowel = vs;
                    rootIdx = units.Count - 1; // the vowel sits on the root, the current last unit
                }
                pendingAchung = false;
            }
            else if (c == 0x0f7e || c == 0x0f83) nasalMark = true; // anusvara / candrabindu
            // else: tsheg / marks / halanta — ignore
        }
        if (pendingAchung) units.Add(new Unit { Full = "'" }); // a bare ⟨'⟩ is an ordinary suffix (དགའ)
        if (units.Count == 0) return null;
        // No vowel sign (inherent /a/): resolve the root from the stack SHAPE instead of the vowel position.
        if (rootIdx < 0) rootIdx = FindRootIdx(units);
        var prefix = rootIdx >= 1 ? units[rootIdx - 1].Full : null; // at most one prefix
        var rootUnit = units[rootIdx];
        var sufUnits = units.Skip(rootIdx + 1).ToList();
        var subs = rootUnit.Subs;
        var rootFromSub = subs.FirstOrDefault(x => !SUB_NON_ROOT.Contains(x));
        string? superscript = null;
        var root = rootUnit.Full;
        if (SUPERSCRIPT.Contains(rootUnit.Full) && rootFromSub is not null)
        {
            superscript = rootUnit.Full;
            root = rootFromSub;
        }
        var subH = subs.Contains("h");
        // ⟨ཧྥ⟩ = ROOT ha + SUBJOINED pha. Not a superscript (⟨h⟩ is not one) and not a subscript (⟨ph⟩ is
        // not one), so the parser dropped the subjoined letter and the stack read as a bare ⟨ཧ⟩.
        var subF = rootUnit.Full == "h" && subs.Contains("ph");
        var subscript = subs.FirstOrDefault(x => SUBSCRIPT_SET.Contains(x));
        return new Stack
        {
            Prefix = prefix, Superscript = superscript, Root = root, Subscript = subscript,
            SubH = subH, SubF = subF, Vowel = vowel, Vowel2 = vowel2, NasalMark = nasalMark,
            Suffix = sufUnits.Count > 0 ? sufUnits[0].Full : null,
            Postsuffix = sufUnits.Count > 1 ? sufUnits[1].Full : null,
        };
    }

    private static string Front(string x) => x switch { "a" => "ɛ", "o" => "ø", "u" => "y", _ => x };

    /**
     * Realize a parsed stack as Lhasa IPA (onset + vowel + tone + coda). `first` = word-initial syllable:
     * Lhasa word tone is contrastive only on syllable 1 (Tournadre) — non-initial syllables default HIGH.
     */
    private static string ReadStack(Stack s, bool first)
    {
        // A prefix or superscript (or simply being non-initial) gives a "headed" onset.
        var head = s.Prefix is not null || s.Superscript is not null || !first;
        var onset = "";
        bool high;

        // Onset + tone from the root's tonogenetic class.
        if (VOICELESS.Contains(s.Root))
        {
            high = true;
            onset = FRIC.TryGetValue(s.Root, out var fr) ? fr
                : s.Root.EndsWith('h') ? ASP[s.Root] : UNASP[s.Root];
        }
        else if (VOICED.Contains(s.Root))
        {
            high = false; // voiced obstruents → LOW
            onset = FRIC.TryGetValue(s.Root, out var fr2) ? fr2 : head ? UNASP[s.Root] : ASP[s.Root];
        }
        else if (SONORANT.Contains(s.Root))
        {
            high = head; // a sonorant is raised to HIGH by a prefix/superscript
            onset = SON[s.Root];
            if (s.Root == "l" && s.SubH) onset = "ɬ"; // lha
        }
        else
        {
            // vowel-initial root (' or a) — Lhasa gives a syllable-initial vowel a glottal onset
            high = s.Root == "a";
            onset = "ʔ";
        }
        if (!first) high = true; // non-initial syllables take the Lhasa word-tone template's default HIGH

        // Subscript modifications (place).
        if (s.Subscript == "y")
        {
            var asp = onset.Contains('ʰ');
            if (onset is "k" or "kʰ") onset = asp ? "kʲʰ" : "kʲ"; // palatalized velar (JIPA notation)
            else if (onset is "p" or "pʰ") onset = asp ? "t͡ɕʰ" : "t͡ɕ";
            else if (onset == "m") onset = "ɲ";
        }
        else if (s.Subscript == "r")
        {
            var asp = onset.Contains('ʰ');
            if (onset is "k" or "kʰ" or "t" or "tʰ" or "p" or "pʰ") onset = asp ? "ʈ͡ʂʰ" : "ʈ͡ʂ";
            else if (onset is "s" or "h") onset = "ʂ";
        }
        else if (s.Subscript == "l")
        {
            if (s.Root == "z")
                // zla-btags lexical exception: ⟨zl⟩ → [t] (ཟླ 'moon' → tawa), NOT [l]; keeps root-z LOW tone.
                onset = "t";
            else
            {
                onset = "l";
                high = true; // la-btags (bl/gl/rl…) → [l], always HIGH in Lhasa (Tournadre)
            }
        }
        if (s.SubH) high = true; // a subjoined ha devoices the onset (ɬ, ʂ) and raises the tone
        /**
         * ⟨ཧྥ⟩ (Wylie *hpha*) — THE LOANWORD DIGRAPH FOR /f/, a sound native Tibetan does not have. The
         * graphic CARRIER ⟨ཧ⟩ was being read and the actual consonant letter DELETED, so every one of these
         * words came out with an /h/ it does not have. Sourced from the corpus's own 31 distinct forms, all
         * 35 instances opening a Western loan with /f/ in exactly this position (ཧྥ་རན་སི *France*,
         * ཨ་ཧྥེ་རི་ཀ *Africa*). ⚠ If /f/ is ever disputed the fallback is /pʰ/ — the value of the subjoined
         * letter itself — and never /h/, which reads the carrier and throws the letter away. See the TS.
         */
        if (s.SubF) { onset = "f"; high = true; }
        // db- cluster: prefix ⟨d⟩ + root ⟨b⟩ is historically /w/ (HIGH) — དབང dbang→waŋ, དབུ dbu→ʔu.
        if (s.Prefix == "d" && s.Root == "b")
        {
            high = true;
            onset = s.Subscript == "y" ? "j" : s.Vowel is "u" or "o" ? "ʔ" : "w";
        }

        // Hiatus/diminutive diphthong (⟨'⟩+vowel): the two vowels form a diphthong (the pre-/u/ raising
        // e→i per the JIPA illustration); this CLOSES the syllable, so suffix effects do not apply.
        if (s.Vowel2 is not null)
        {
            var d = s.Vowel == "e" && s.Vowel2 == "u" ? "iu" : s.Vowel + s.Vowel2;
            return onset + d + (high ? "˥" : "˩");
        }

        // Vowel + suffix effects (umlaut / length / nasalization / glottalization).
        var v = s.Vowel;
        var coda = "";
        var lng = false;
        var nasal = s.NasalMark;
        switch (s.Suffix)
        {
            case "d": v = Front(v); coda = "ʔ"; break;
            case "s": v = Front(v); lng = true; break;
            case "l": v = Front(v); lng = true; break;
            case "n": v = Front(v); nasal = true; lng = true; break;
            case "m": coda = "m"; break;
            case "ng": coda = "ŋ"; break;
            case "g": coda = "ʔ"; break;
            case "b": coda = "p"; break;
            case "r": lng = true; break;
            case "'": lng = true; break;
        }
        var vowel = v + (nasal ? "̃" : "") + (lng ? "ː" : "");
        return onset + vowel + coda + (high ? "˥" : "˩");
    }

    /**
     * Split a word into syllables. ⚠ ཿ U+0F7F RNAM BCAD IS A SYLLABLE TERMINATOR — it is the Sanskrit
     * VISARGA, and without it here `ཀཿཐོག` (the monastery Kaḥtog) parsed as ONE stack, ⟨ཀ⟩ was taken for a
     * prefix and DELETED, and the word read *tʰoʔ˥*: a whole syllable lost. ⚠ Its own VALUE is deliberately
     * left unread — Lhasa has no coda /h/ and neither referee holds one instance, so emitting a phone here
     * would be a guess where splitting is a fact. See the TS for the 7-instance resolution.
     */
    /** ⚠ A PLAIN CHAR SPLIT, not a JsRe one, and that is exact rather than a shortcut: the TS class
     *  `/[་༌ཿ]/u` holds three literal BMP characters with no ranges, classes or case folding, so there is no
     *  regex semantics for a translated pattern to preserve. */
    private static readonly char[] SYLL_SPLIT = ['་', '༌', 'ཿ'];

    /** Phonemize one Tibetan word (one or more tsheg-separated syllables). */
    public static string PhonemizeWord(string word)
    {
        var w = word.Normalize(System.Text.NormalizationForm.FormC);
        var outp = new List<string>();
        foreach (var syl in w.Split(SYLL_SPLIT))
        {
            if (syl.Length == 0) continue;
            var cps = Js.CodePoints(syl).Select(ch => char.ConvertToUtf32(ch, 0)).ToList();
            var st = ParseSyllable(cps);
            if (st is not null) outp.Add(ReadStack(st, outp.Count == 0));
        }
        return string.Concat(outp);
    }

    // ── Numbers (tibetan.jsonc): units, decades and their connectives, the magnitude ladder, and དང ──────
    private static TibetanNumbers NUM => DEF.Numbers;

    /** Compose an integer into Tibetan number words (tsheg-joined), or null to fall back to digits. */
    private static string? NumToTibetan(long n)
    {
        if (n == 0) return NUM.Zero;                                     // klad kor
        if (n < 10) return NUM.Units[(int)n];
        if (n < 20) return n == 10 ? NUM.Ten : NUM.Ten + "་" + NUM.Units[(int)n - 10]; // 11–19 = bcu + unit
        if (n < 100)
        {
            var t = (int)(n / 10);
            var u = (int)(n % 10);
            return u == 0 ? NUM.Decades[t] : NUM.Connectives[t] + "་" + NUM.Units[u];
        }
        // Magnitudes, largest first. ⚠ A multiplier of 1 is left UNSPOKEN (བརྒྱ = "a hundred") and the
        // remainder is joined with དང dang.
        foreach (var (v, w) in Manifest.MAGNITUDES)
        {
            if (n < v) continue;
            var q = n / v;
            var head = (q == 1 ? "" : NumToTibetan(q) + "་") + w;
            var r = n % v;
            return r == 0 ? head : head + "་" + NUM.And + "་" + NumToTibetan(r);
        }
        return null;
    }

    /** JS `Number.isSafeInteger`. */
    private static bool IsSafeInteger(double n) => double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d;

    /**
     * A numeral run → Tibetan number words → IPA. Beyond the named 10⁹ ladder (or a non-safe integer) the
     * digits are read one by one as NUMBER WORDS rather than leaked as digits.
     * ⚠ Over the TOKEN, not a re-stringified double — the double is what cannot be trusted up here.
     */
    private static string Number(string digits)
    {
        var n = Js.Number(digits);
        var words = IsSafeInteger(n) ? NumToTibetan((long)n) : null;
        if (words is not null) return PhonemizeWord(words);
        return string.Join(" ", digits.Where(c => c is >= '0' and <= '9')
            .Select(d => PhonemizeWord(d == '0' ? NUM.Zero : NUM.Units[d - '0'])));
    }

    // A Tibetan numeral run, then a word (Tibetan letters/signs + intra-word tsheg), then clause
    // punctuation (shad ། and Latin .?! break clauses).
    private static readonly JsRe TOKEN =
        JsRegex.Compile(@"([༠-༩\d]+)|([ༀ-࿿]+)|([.!?])|([།༎ ,;:])", "gu");

    private sealed class TibetanEngine : ILanguage
    {
        public string Text(string input) =>
            // Tibetan digits (U+0F20–0F29) fold to ASCII up front, so a Tibetan-numeral run composes exactly
            // like a Western one. ⚠ The token class STILL admits ༠-༩ so an unfolded digit could never fall
            // into the WORD alternative and vanish inside ParseSyllable.
            //
            // Normalize runs AFTER that fold and before the tokenizer: everything it emits is TEXT, so
            // nothing bypasses the g2p.
            Clauses.AssembleClauses(TibetanNormalize.NormalizeTibetan(Unicode.FoldNativeDigits(input)), TOKEN, (m, sink) =>
            {
                if (m.Groups[1].Success && m.Groups[1].Value.Length > 0) sink.Emit(Number(m.Groups[1].Value));
                else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0) sink.Emit(PhonemizeWord(m.Groups[2].Value));
                else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0) sink.Pause(m.Groups[3].Value);
                else if (m.Groups[4].Success && m.Groups[4].Value.Length > 0) sink.Pause(",");
            });
    }

    /** Build the Tibetan phonemizer (Lhasa syllable-stack rule engine). */
    public static ILanguage CreateTibetan() => new TibetanEngine();

    internal static void RegisterSelf() => Registry.Register("tibetan", () => CreateTibetan());
}
