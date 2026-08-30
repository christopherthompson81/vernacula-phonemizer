/**
 * Bavarian (bar) phonemizer — Boarisch, Upper German (Austro-Bavarian), Latin script, canonical IPA. A
 * greedy longest-match grapheme scan plus the rules the table cannot express: the falling diphthongs
 * ⟨ia ua oa⟩, the voiceless-lenis stops ⟨b d g⟩→[b̥ d̥ ɡ̥], r-vocalization, the ich/ach dorsal split,
 * initial ⟨st sp⟩, ⟨gn⟩ coalescence, geminate collapse.
 *
 * Ported from src/languages/bavarian/bavarian.ts — see that file for the referee, the orthographic
 * convention it reads, and what is folded.
 */
using System.Text;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Bavarian;

public static class BavarianPhonemizer
{
    private static BarDef DEF => Manifest.MANIFEST;
    private static IReadOnlyDictionary<string, string> DIGRAPHS => DEF.Digraphs;
    private static IReadOnlyDictionary<string, string> G => DEF.Graphemes;
    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => DEF.ClausePunctuation;

    // Longest-first, so ⟨sch⟩ beats ⟨s⟩+⟨ch⟩ and ⟨tsch⟩ beats ⟨t⟩+⟨sch⟩. JS's Array.prototype.sort is stable
    // and OrderByDescending is too; every remaining key is exactly two distinct characters, so at any one scan
    // position at most one of them can match and their relative order is immaterial.
    private static readonly string[] ORDER = DIGRAPHS.Keys.OrderByDescending(k => k.Length).ToArray();

    private static IReadOnlySet<string> VOWEL_PH => Ipa.IPA_VOWEL;

    /** A front vowel head triggers ⟨ch⟩→[ç]; anything else (a back vowel) → [x]. */
    private static readonly HashSet<string> FRONT_VOWEL = new(Js.CodePoints("eiyɛœøɐ"));

    /** One scan token: a grapheme's phones plus the two flags whose realization is resolved in code. */
    private sealed class Tok
    {
        public string Ph = "";
        public bool RVar;
        public bool ChVar;
    }

    /** A phone's base characters, dropping U+0300–036F and the length mark ◌ː, so a diphthong or long vowel
     *  is still recognised as vowel-{initial,final} and a lenis [b̥] as its base [b]. */
    private static List<string> CoreChars(string ph) =>
        Js.CodePoints(ph.Normalize(NormalizationForm.FormD))
            .Where(c =>
            {
                var x = Js.CodePointAt0(c);
                return !(x >= 0x300 && x <= 0x36f) && x != 0x2d0;
            })
            .ToList();

    private static bool StartsWithVowel(string ph)
    {
        var a = CoreChars(ph);
        return a.Count > 0 && VOWEL_PH.Contains(a[0]);
    }

    private static bool EndsWithVowel(string ph)
    {
        var a = CoreChars(ph);
        return a.Count > 0 && VOWEL_PH.Contains(a[^1]);
    }

    private static bool EndsWithFrontVowel(string ph)
    {
        var a = CoreChars(ph);
        return a.Count > 0 && FRONT_VOWEL.Contains(a[^1]);
    }

    /** Scan a lowercased word into phone tokens: longest-match digraphs, then single graphemes. */
    private static List<Tok> Scan(string word)
    {
        var w = Js.ToLowerCase(Js.Normalize(word, NormalizationForm.FormC));
        var toks = new List<Tok>();
        var i = 0;
        while (i < w.Length)
        {
            var matched = false;
            foreach (var key in ORDER)
            {
                // JS `w.startsWith(key, i)` is a UTF-16 code-unit comparison, which ordinal is.
                if (i + key.Length > w.Length || string.CompareOrdinal(w, i, key, 0, key.Length) != 0) continue;
                toks.Add(new Tok { Ph = DIGRAPHS[key], ChVar = key == "ch" });
                i += key.Length;
                matched = true;
                break;
            }
            if (matched) continue;
            var c = w[i].ToString();
            // ⚠ A letter with no rule here still denotes a sound; dropping it deletes what the writer typed.
            // Consulted AFTER every digraph and single-letter rule, so it cannot override this language.
            var ph = G.TryGetValue(c, out var g) ? g : LatinPhones.LatinPhone(c, new PhoneOpts { Initial = i == 0 });
            if (ph is not null) toks.Add(new Tok { Ph = ph, RVar = c == "r" });
            i += 1;
        }
        return toks;
    }

    /** The dorsal fricative split — the German ich/ach allophony. */
    private static void ResolveCh(List<Tok> toks)
    {
        for (var i = 0; i < toks.Count; i++)
        {
            if (!toks[i].ChVar) continue;
            var backContext = i > 0 && EndsWithVowel(toks[i - 1].Ph) && !EndsWithFrontVowel(toks[i - 1].Ph);
            toks[i].Ph = backContext ? "x" : "ç";
        }
    }

    /** A coda ⟨r⟩ vocalizes to [ɐ̯] and the ending ⟨-er⟩ to [ɐ]; a prevocalic onset ⟨r⟩ stays [r]. */
    private static void VocalizeR(List<Tok> toks)
    {
        var last = toks.Count - 1;
        var firstVowelIdx = toks.FindIndex(t => StartsWithVowel(t.Ph));
        for (var i = 0; i <= last; i++)
        {
            var t = toks[i];
            if (!t.RVar) continue;
            var nextVowel = i < last && StartsWithVowel(toks[i + 1].Ph);
            if (nextVowel) continue; // prevocalic onset → keep [r]
            // An unstressed ⟨-er⟩ collapses to one [ɐ]; a stressed one keeps vowel + offglide (Bersch).
            var prevIsE = i > 0 && toks[i - 1].Ph == "e";
            if (prevIsE && (i == last || i - 1 != firstVowelIdx)) { toks[i - 1].Ph = "ɐ"; t.Ph = ""; }
            else t.Ph = "ɐ̯";
        }
    }

    /** Word-final ⟨gn⟩ coalesces to [ŋ] (Regn→reŋ). */
    private static void CoalesceGN(List<Tok> toks)
    {
        var last = toks.Count - 1;
        if (last > 0 && toks[last].Ph == "n" && toks[last - 1].Ph == "ɡ̥")
        {
            toks[last - 1].Ph = "";
            toks[last].Ph = "ŋ";
        }
    }

    /** Initial ⟨st sp⟩ → [ʃd̥ ʃb̥] — the German rule over Bavarian's already-lenited stops. */
    private static void InitialSCluster(List<Tok> toks)
    {
        if (toks.Count >= 2 && toks[0].Ph == "s" && (toks[1].Ph == "d̥" || toks[1].Ph == "b̥")) toks[0].Ph = "ʃ";
    }

    /** Post-vocalic ⟨h⟩ is a silent length marker; it keeps its [h] only as a syllable onset. */
    private static void SilentH(List<Tok> toks)
    {
        for (var i = 1; i < toks.Count; i++)
            if (toks[i].Ph == "h" && EndsWithVowel(toks[i - 1].Ph)) toks[i].Ph = "";
    }

    /** ⟨k⟩ lenites to [ɡ̥] everywhere but a word-initial PREVOCALIC onset (Klass→ɡ̥lɑs, Kaas→kaːs). */
    private static void LenitK(List<Tok> toks)
    {
        for (var i = 0; i < toks.Count; i++)
        {
            if (toks[i].Ph != "k") continue;
            var initialBeforeLiquid =
                i == 0 && i + 1 < toks.Count && (toks[i + 1].Ph == "l" || toks[i + 1].Ph == "r");
            if (i > 0 || initialBeforeLiquid) toks[i].Ph = "ɡ̥";
        }
    }

    /** A single word-final ⟨-a⟩ after a consonant reduces to [ɐ] — the Bavarian final-schwa. */
    private static void ReduceFinalA(List<Tok> toks)
    {
        var last = toks.Count - 1;
        if (last > 0 && toks[last].Ph == "ɑ" && !EndsWithVowel(toks[last - 1].Ph)) toks[last].Ph = "ɐ";
    }

    /** ⟨n⟩ → [ŋ] before a velar — this catches ⟨nk⟩ (Bånk→b̥ɔŋɡ̥); ⟨ng⟩ is already [ŋ]. */
    private static void VelarNasal(List<Tok> toks)
    {
        for (var i = 0; i < toks.Count - 1; i++)
            if (toks[i].Ph == "n" && (toks[i + 1].Ph == "k" || toks[i + 1].Ph == "ɡ̥")) toks[i].Ph = "ŋ";
    }

    /** A doubled consonant letter surfaces as a single phone — no coda length contrast in this orthography. */
    private static void Degeminate(List<Tok> toks)
    {
        for (var i = toks.Count - 1; i > 0; i--)
        {
            var p = toks[i].Ph;
            if (p != "" && p == toks[i - 1].Ph && !StartsWithVowel(p)) toks.RemoveAt(i);
        }
    }

    /** Phonemize a single Bavarian word to canonical IPA. */
    public static string PhonemizeWord(string word)
    {
        var toks = Scan(word);
        ResolveCh(toks);
        SilentH(toks);
        InitialSCluster(toks);
        // ⚠ Degeminate and CoalesceGN run BEFORE LenitK: gemination must collapse while both stops are still
        // identical, and ⟨gn⟩-coalescence must see only a GENUINE ⟨g⟩→[ɡ̥] and not a ⟨k⟩ LenitK turned into
        // one (else Dackn→d̥ɑŋ).
        Degeminate(toks);
        CoalesceGN(toks);
        LenitK(toks);
        VelarNasal(toks);
        VocalizeR(toks);
        ReduceFinalA(toks);
        return string.Concat(toks.Select(t => t.Ph));
    }

    // A word / number / punctuation token.
    private static readonly JsRe TOKEN = JsRegex.Compile(
        $"({HostWord.HostWordRun(new[] { "Latin" }, "'-")})|(\\d+)|([.!?…,;:])", "gu");

    /** This language's OWN inventory — a different question from TOKEN's script boundary above. */
    private const string NATIVE_CLASS = "[a-zåäöüéèáàâßA-ZÅÄÖÜÉÈÁÀÂ'-]";
    private static readonly Func<string, string> Nat = HostWord.MakeNativiser(NATIVE_CLASS, "u");

    private sealed class Engine : ILanguage
    {
        public string Text(string input)
        {
            // Normalization first, so everything reaching TOKEN is something this g2p can speak.
            return Clauses.AssembleClauses(Normalize.NormalizeBavarian(input), TOKEN, (m, sink) =>
            {
                if (m.Groups[1].Success && m.Groups[1].Value.Length > 0)
                    sink.Emit(PhonemizeWord(Nat(m.Groups[1].Value)));
                // ⚠ THE TOKEN STRING IS PASSED AS `raw` (#1080): the digit-at-a-time fallback cannot recover
                // the digits from the double it exists to bypass. A bare `\d+` arm, so the token IS the digits.
                else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
                {
                    var tok = m.Groups[2].Value;
                    foreach (var wd in Numbers.NumberToWords(Js.Number(tok), tok).Split(' '))
                        sink.Emit(PhonemizeWord(wd));
                }
                else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
                {
                    if (CLAUSE_MARK.TryGetValue(m.Groups[3].Value, out var mk)) sink.Pause(mk);
                }
            });
        }
    }

    /** Build the Bavarian phonemizer. */
    public static ILanguage CreateBavarian() => new Engine();

    internal static void RegisterSelf() => Registry.Register("bavarian", () => CreateBavarian());
}
