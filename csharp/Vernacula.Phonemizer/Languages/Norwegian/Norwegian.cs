/**
 * Native Norwegian Bokmål (nb) text phonemizer — canonical IPA. North Germanic, Latin, Urban East Norwegian.
 * A left-to-right rule g2p over the NST pronunciation lexicon: complementary vowel length, front-vowel
 * softening, retroflex r + coronal, silent word-final ⟨d⟩.
 * Ported from src/languages/norwegian/norwegian.ts — see that file for the phonological evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Norwegian;

/** A per-word OOV reading supplied by the async neural path; null for "no opinion". */
public delegate string? OovResolver(string word);

public sealed class NorwegianPhonemizer : ILanguage
{
    private static NorwegianManifest MANIFEST => Manifest.MANIFEST;

    private static IReadOnlyDictionary<string, string> LONG => MANIFEST.Vowels.Long;
    private static IReadOnlyDictionary<string, string> SHORT => MANIFEST.Vowels.Short;
    private static IReadOnlyDictionary<string, string> LBR => MANIFEST.Vowels.LongBeforeR;
    private static IReadOnlyDictionary<string, string> SBR => MANIFEST.Vowels.ShortBeforeR;
    private static IReadOnlyDictionary<string, string> DIG => MANIFEST.Digraphs;
    private static IReadOnlyDictionary<string, string> CONS => MANIFEST.Consonants;
    private static IReadOnlyDictionary<string, string> RETRO => MANIFEST.Retroflex;
    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => MANIFEST.ClausePunctuation;

    private const string VOWEL_LETTERS = "aeiouyæøåéèêëàâôü";
    private static bool IsV(string c) => c != "" && VOWEL_LETTERS.Contains(c, StringComparison.Ordinal);
    private static readonly string FRONT = MANIFEST.FrontVowels.ToLowerInvariant();
    private static bool IsFront(string c) => c != "" && FRONT.Contains(c, StringComparison.Ordinal);

    /** JS `w[i]` — the empty string where the TS reads `?? ""`, rather than a throw. */
    private static string At(string w, int i) => i >= 0 && i < w.Length ? w[i].ToString() : "";

    /** JS `w.slice(i, i + n)`, which clamps rather than throwing. */
    private static string Slice(string w, int i, int n) =>
        i >= w.Length ? "" : w.Substring(i, Math.Min(n, w.Length - i));

    /** Is the stressed vowel at index i LONG? Count coda consonant LETTERS to the next vowel/word-end. */
    private static bool StressedLong(string w, int i)
    {
        var j = i + 1;
        var count = 0;
        while (j < w.Length && !IsV(At(w, j)))
        {
            // ⚠ `"tnlsd".Contains("")` IS TRUE, in both languages, and the reading depends on it: past the
            // end of the word the TS reads `w[j + 1] ?? ""`, so a WORD-FINAL ⟨r⟩ takes the r+coronal arm.
            if (At(w, j) == "r" && "tnlsd".Contains(At(w, j + 1), StringComparison.Ordinal)) { count++; j += 2; }
            else if (At(w, j) == "x") { count += 2; j++; } // ⟨x⟩ = /ks/ closes the syllable
            else { count++; j++; }
        }
        return count <= 1;
    }

    /** Scan one Norwegian word → IPA (no stress mark). */
    private static List<string> ToSegments(string word)
    {
        var w = Js.ToLowerCase(word);
        var n = w.Length;
        var outp = new List<string>();
        var i = 0;
        var vowelOrd = 0;
        while (i < n)
        {
            var c = At(w, i);
            var nx = At(w, i + 1);
            var nx2 = At(w, i + 2);
            var two = Slice(w, i, 2);
            var three = Slice(w, i, 3);

            // -sjon / -tion suffix → ʃuːn, gated to i>0 (a stem precedes it)
            var four = Slice(w, i, 4);
            if (i > 0 && (four == "sjon" || four == "tion"))
            {
                outp.Add("ʃ");
                outp.Add("uː");
                outp.Add("n");
                vowelOrd++;
                i += 4;
                continue;
            }

            // vowel — complementary length picks quality; an UNSTRESSED ⟨e⟩ reduces to schwa
            if (IsV(c))
            {
                if (vowelOrd > 0 && c == "e") { outp.Add("ə"); vowelOrd++; i++; continue; }
                var lng = vowelOrd == 0 && StressedLong(w, i);
                var beforeR = nx == "r";
                string ph;
                if (lng) ph = beforeR && LBR.TryGetValue(c, out var lr) ? lr : LONG[c];
                else ph = beforeR && SBR.TryGetValue(c, out var sr) ? sr : SHORT[c];
                outp.Add(ph);
                vowelOrd++;
                i++;
                continue;
            }

            // word-initial silent digraphs: hj/gj/lj/dj → j
            if (i == 0 && nx == "j" && "hgld".Contains(c, StringComparison.Ordinal)) { outp.Add("j"); i += 2; continue; }

            // three-letter digraph (skj → ʃ)
            if (DIG.TryGetValue(three, out var d3)) { outp.Add(d3); i += 3; continue; }

            // sk before a front vowel in the stressed onset → ʃ
            if (two == "sk" && vowelOrd == 0 && IsFront(nx2)) { outp.Add("ʃ"); i += 2; continue; }

            // retroflex r + coronal → single retroflex (r absorbed)
            if (c == "r" && RETRO.TryGetValue(two, out var rf)) { outp.Add(rf); i += 2; continue; }

            // two-letter digraph (sj/kj/tj/hv/ng/gn/ck) — ⚠ ONE SEGMENT PER CODE POINT of the value
            if (DIG.TryGetValue(two, out var d2)) { foreach (var ch in Js.CodePoints(d2)) outp.Add(ch); i += 2; continue; }

            // front-vowel softening on a single k/g in the stressed onset
            if (vowelOrd == 0 && (c == "k" || c == "g") && IsFront(nx)) { outp.Add(c == "k" ? "ç" : "j"); i++; continue; }

            // silent word-final ⟨d⟩ after a vowel or l/n/r
            if (c == "d" && i == n - 1 && (IsV(At(w, i - 1)) || "lnr".Contains(At(w, i - 1), StringComparison.Ordinal)))
            {
                i++;
                continue;
            }

            // geminate consonant → single C + ː
            if (c == nx && !IsV(c))
            {
                if (c == "g") outp.Add("ɡː");
                else if (c == "k") outp.Add("kː");
                else if (CONS.TryGetValue(c, out var cg)) outp.Add(cg + "ː");
                else outp.Add(c);
                i += 2;
                continue;
            }

            if (CONS.TryGetValue(c, out var cs)) outp.Add(cs);
            i++; // unknown char → skip
        }
        return outp;
    }

    private static readonly JsRe NUCLEUS = JsRegex.Compile("[ɑaeɛiɪoɔuʉʊyʏøœæ]", "u");

    /** One Norwegian word → canonical IPA by RULE: first-syllable stress over the segmental scan. */
    public static string PhonemizeWordRules(string word)
    {
        var segs = ToSegments(word);
        var firstV = segs.FindIndex(p => NUCLEUS.IsMatch(p));
        if (firstV < 0) return string.Concat(segs);
        var onset = firstV;
        while (onset > 0 && !NUCLEUS.IsMatch(segs[onset - 1])) onset--;
        return string.Concat(segs.Take(onset)) + "ˈ" + string.Concat(segs.Skip(onset));
    }

    private static IReadOnlyDictionary<string, string>? LEX;

    /** The NST pronunciation lexicon (lowercased word → canonical IPA). */
    public static IReadOnlyDictionary<string, string> Lexicon() =>
        // ⚠ #1068: `fold` aliases each key to its NATIVISED spelling, because Text() folds before it looks
        // up. Dropping it here would load a DIFFERENT lexicon from the TypeScript's — 14 keys, `señor`,
        // `malmö`, `göring` among them. See the LoadTsvMap docstring for the precedence rule.
        LEX ??= LoadTsv.LoadTsvMap<string>("languages/norwegian", "nb-lexicon.tsv", (v, _) => v,
            optional: true, fold: k => Nat(k));

    public static bool NorwegianLexiconHas(string word) => Lexicon().ContainsKey(word);

    /** TIER 1 lexicon (NST) → TIER 2 oovOverride (neural tagger, async path) → TIER 3 rule fallback. */
    public static string PhonemizeWord(string word, OovResolver? oovOverride = null)
    {
        if (Lexicon().TryGetValue(Js.ToLowerCase(word), out var hit)) return hit;
        return oovOverride?.Invoke(word) ?? PhonemizeWordRules(word);
    }

    private const string NATIVE_CLASS = "[A-Za-zÆØÅæøåÉéÈèÊêËëÀàÂâÔôÜü]";
    private static readonly Func<string, string> NatFn = HostWord.MakeNativiser(NATIVE_CLASS, "u");
    public static string Nat(string w) => NatFn(w);

    private const string NB_LETTER = "(?!\\p{Nd})[\\p{Script=Latin}]";
    private static readonly string NB_WORD = $"{NB_LETTER}(?:{NB_LETTER}|\\p{{M}}|['’](?={NB_LETTER}))*";
    private static readonly JsRe TOKEN = JsRegex.Compile($"({NB_WORD})|(\\d+)|([.?!,;:…—])", "gu");

    private static bool IsSafeInteger(double n) => double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d;

    private static string Number(string digits)
    {
        var nn = Js.Number(digits);
        // ⚠ Above 2^53 the float has lost the low digits; read the numeral out digit-at-a-time instead.
        if (!IsSafeInteger(nn)) return Numbers.SpellDigits(digits, MANIFEST.Numbers, w => PhonemizeWord(w));
        return Numbers.RenderNumber(nn, MANIFEST.Numbers, w => PhonemizeWord(w), Numbers.westernNumberWords);
    }

    public string Text(string input) => Text(input, null);

    /** `oovOverride` (neural path only) resolves OOV words between the lexicon and the rule engine. */
    public string Text(string rawInput, OovResolver? oovOverride)
    {
        return Clauses.AssembleClauses(Normalize.NormalizeNorwegian(rawInput), TOKEN, (m, sink) =>
        {
            if (m.Groups[1].Success && m.Groups[1].Value.Length > 0)
                sink.Emit(PhonemizeWord(Nat(m.Groups[1].Value), oovOverride));
            else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
                sink.Emit(Number(m.Groups[2].Value));
            else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
            {
                if (CLAUSE_MARK.TryGetValue(m.Groups[3].Value, out var mk) && mk.Length > 0) sink.Pause(mk);
            }
        });
    }

    /** Build the Norwegian Bokmål phonemizer. */
    public static NorwegianPhonemizer CreateNorwegian() => new();

    internal static void RegisterSelf() => Registry.Register("norwegian", () => CreateNorwegian());
}
