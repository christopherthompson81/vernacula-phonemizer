/**
 * Tajik / тоҷикӣ (tg) phonemizer — canonical IPA. A variety of Persian (Iranian, SW) in the
 * CYRILLIC alphabet, which writes all its vowels → a near-phonemic left-to-right scan with NO short-vowel
 * restoration (the wall that keeps Perso-Arabic `fa` short of full coverage). The letter→IPA tables are DATA (tajik.jsonc);
 * the code here is the scan (word-initial / post-vowel е→je, iotated ё/ю/я, the six-vowel system, the special
 * Cyrillic letters ғ қ ҳ ҷ ӣ ӯ ъ), Persian FINAL stress, a cardinal-number compositor, and the tokenizer.
 * Validated against wikipron tgk_cyrl (broad + narrow, human) + epitran tgk-Cyrl.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Tajik;

public static class TajikPhonemizer
{
    private static TajikManifest DEF => Manifest.MANIFEST;
    private static IReadOnlyDictionary<string, string> VOWEL => DEF.Vowels;
    private static IReadOnlyDictionary<string, string> GLIDE => DEF.Glides;
    private static IReadOnlyDictionary<string, string> CONS => DEF.Consonants;
    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => DEF.ClausePunctuation;
    private static readonly IReadOnlySet<string> VOWEL_LETTERS =
        new HashSet<string>(Manifest.MANIFEST.Vowels.Keys, StringComparer.Ordinal);

    private sealed class Seg
    {
        public required string Ph { get; init; }
        public required bool Nucleus { get; init; }
    }

    private static readonly JsRe GLIDE_NUCLEUS = JsRegex.Compile("[aɔuiɵe]", "u");

    /** Tajik word → IPA segment list (nucleus flags drive final stress). */
    private static List<Seg> ToSegments(string word)
    {
        var chars = Js.CodePoints(word.ToLowerInvariant());
        var segs = new List<Seg>();
        var prevWasVowel = false; // for е→je after a vowel / word-initially
        for (var i = 0; i < chars.Count; i++)
        {
            var c = chars[i];
            if (VOWEL_LETTERS.Contains(c))
            {
                // е (and э) → [je] word-initially or after another vowel (hiatus); → [e] after a consonant.
                if ((c == "е" || c == "э") && (i == 0 || prevWasVowel))
                {
                    segs.Add(new Seg { Ph = "j", Nucleus = false });
                }
                // Hiatus glide: и/ӣ after another vowel takes a [j] onset (Саид→sajid, Душанбеи→duʃanbeji).
                else if ((c == "и" || c == "ӣ") && prevWasVowel)
                {
                    segs.Add(new Seg { Ph = "j", Nucleus = false });
                }
                segs.Add(new Seg { Ph = VOWEL[c], Nucleus = true });
                prevWasVowel = true;
                continue;
            }
            if (GLIDE.TryGetValue(c, out var gph))
            {
                var ph = gph;
                if (c == "й")
                {
                    segs.Add(new Seg { Ph = "j", Nucleus = false });
                    prevWasVowel = false;
                }
                else
                {
                    // ё/ю/я → j + vowel; the vowel is the nucleus.
                    foreach (var p in Js.CodePoints(ph))
                        segs.Add(new Seg { Ph = p, Nucleus = GLIDE_NUCLEUS.IsMatch(p) });
                    prevWasVowel = true;
                }
                continue;
            }
            if (CONS.TryGetValue(c, out var cons))
            {
                if (cons != "") segs.Add(new Seg { Ph = cons, Nucleus = false });
                prevWasVowel = false;
            }
            // unknown char (stray latin/punct inside a token) → skip
        }
        return segs;
    }

    /** One Tajik word → canonical IPA with a single primary-stress mark (Persian final stress). */
    public static string PhonemizeWord(string word)
    {
        var segs = ToSegments(word);
        if (segs.Count == 0) return "";
        var nucIdx = segs.Select((s, i) => s.Nucleus ? i : -1).Where(i => i >= 0).ToList();
        if (nucIdx.Count == 0) return string.Concat(segs.Select(s => s.Ph)); // consonant-only (abbreviation)
        var stressIdx = nucIdx[^1]; // FINAL stress
        var @out = "";
        for (var i = 0; i < segs.Count; i++)
        {
            if (i == stressIdx) @out += "ˈ";
            @out += segs[i].Ph;
        }
        return @out;
    }

    // ── Cardinal numbers — Persian composition with the connector у (va) ─────────────────────────────────────────
    private static TajikNumbersDef N => DEF.Numbers;
    /**
     * Compose the Tajik SPELLING of a non-negative integer, then phonemize it (space-separated where appropriate).
     *
     * ⚠ THE SCALE LADDER USED TO STOP AT `миллион`, AND THE FAILURE WAS SILENT. The million branch called
     * `three(n / 1e6)`, which for n ≥ 10⁹ has a hundreds digit of 10 or more and indexed `units[10]` —
     * `undefined`. String concatenation turned that into the literal `"undefinedсад"`, and `toSegments` skips
     * characters it does not know, so `1000000000` came out *сад миллион* ("one hundred million") and
     * `1234567890` *саду сию чор миллион…* — a 10× error emitted with no marker any gate could see. The ladder
     * now runs to триллион and `three` refuses a group it cannot spell instead of fabricating one.
     */
    public static string NumberWords(double n)
    {
        if (!double.IsFinite(n) || n < 0) return "";
        if (n == 0) return N.Units[0];
        var parts = new List<string>();
        List<string> Three(double x)
        {
            var p = new List<string>();
            var h = Math.Floor(x / 100);
            var rem = x % 100;
            if (h > 9) return p; // never reachable once the ladder covers the magnitude — a guard, not a branch
            if (h > 0) p.Add(h == 1 ? N.Hundred : N.Units[(int)h] + N.Hundred); // сад / дусад / сесад …
            if (rem >= 10 && rem < 20) p.Add(N.Teens[(int)rem - 10]);
            else
            {
                var t = Math.Floor(rem / 10);
                var u = rem % 10;
                if (t > 0) p.Add(N.Tens[Js.NumberToString(t * 10)]);
                if (u > 0) p.Add(N.Units[(int)u]);
            }
            return p;
        }
        // Largest magnitude first. `1` before ҳазор is dropped (ҳазор, not *як ҳазор*) — the corpus's own form,
        // e.g. `ҳазору сад`; the larger scale words keep their multiplier (як миллион).
        var SCALES = new (double Value, string Word, bool DropOne)[]
        {
            (1_000_000_000_000d, N.Trillion, false),
            (1_000_000_000d, N.Milliard, false),
            (1_000_000d, N.Million, false),
            (1000d, N.Thousand, true),
        };
        var left = n;
        foreach (var (value, word, dropOne) in SCALES)
        {
            var q = Math.Floor(left / value);
            if (q > 0)
            {
                if (!(dropOne && q == 1)) parts.AddRange(Three(q));
                parts.Add(word);
                left %= value;
            }
        }
        if (left > 0) parts.AddRange(Three(left));
        if (parts.Count == 0) return "";
        // The Persian connector -у (va) glues to the END of the preceding word (бисту як, сесаду чилу панҷ), EXCEPT
        // before a magnitude word, which just follows its multiplier with a space (ду ҳазор, not ду-у ҳазор).
        var MAG = new HashSet<string>(new[] { N.Thousand, N.Million, N.Milliard, N.Trillion }, StringComparer.Ordinal);
        var @out = parts[0];
        for (var i = 1; i < parts.Count; i++)
        {
            @out += (MAG.Contains(parts[i]) ? " " : "у ") + parts[i];
        }
        return @out; // space-separated tokens; "бисту" is one token, phonemized bistu
    }

    private static readonly JsRe TOKEN = JsRegex.Compile("([Ѐ-ӿ]+)|(\\d+)|([.!?…,;:])", "gu");

    private sealed class Engine : ILanguage
    {
        public string Text(string input) =>
            // NORMALIZE FIRST, THEN INITIALISMS. The order is load-bearing in both directions: normalize's
            // abbreviation, unit and rate steps must see `МВт`, `км` and `с.` before an all-caps pass could
            // spell them out letter by letter, and the initialism pass must run before the tokenizer so a
            // vowel-less caps run has already become words. The shared symbol tier is called from INSIDE
            // normalize.ts (its step 9) rather than wrapped around it — see the comment there.
            Clauses.AssembleClauses(Normalize.NormalizeTajikInitialisms(Normalize.NormalizeTajik(input)), TOKEN, (m, sink) =>
            {
                if (m.Groups[1].Success && m.Groups[1].Value.Length > 0) sink.Emit(PhonemizeWord(m.Groups[1].Value));
                else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
                {
                    foreach (var w in NumberWords(Js.Number(m.Groups[2].Value)).Split(' ')) sink.Emit(PhonemizeWord(w));
                }
                else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
                {
                    var mk = CLAUSE_MARK.GetValueOrDefault(m.Groups[3].Value);
                    if (mk is not null) sink.Pause(mk);
                }
            });
    }

    /** Build the Tajik phonemizer (Cyrillic near-phonemic g2p; Persian final stress; cardinal numbers). */
    public static ILanguage CreateTajik() => new Engine();

    internal static void RegisterSelf() => Registry.Register("tajik", CreateTajik);
}
