/**
 * Bavarian (bar) phonemizer — Boarisch, Upper German (Austro-Bavarian), Latin script, canonical IPA.
 * Ported from src/languages/bavarian/bavarian.ts — see that file for the referee, the orthographic
 * convention (bar.wikipedia's de-facto German-derived one: ⟨å⟩ for the dark [ɔ], ⟨ä ö ü⟩, ⟨ß⟩), and for
 * what is folded (vowel LENGTH and the fine dialect qualities; the referee is a NARROW transcription with
 * ~1.29 dialect variants per headword, credited any).
 *
 * A greedy longest-match grapheme scan plus the rules the table cannot express: the FALLING diphthongs
 * ⟨ia ua oa⟩, the voiceless-LENIS stops ⟨b d g⟩→[b̥ d̥ ɡ̥], r-vocalization, the ich/ach dorsal split,
 * initial ⟨st sp⟩, ⟨gn⟩ coalescence, geminate collapse.
 */
using System.Text;
using System.Text.RegularExpressions;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Bavarian;

public static class BavarianPhonemizer
{
    private static BarDef DEF => Manifest.MANIFEST;
    private static IReadOnlyDictionary<string, string> DIGRAPHS => DEF.Digraphs;
    private static IReadOnlyDictionary<string, string> G => DEF.Graphemes;
    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => DEF.ClausePunctuation;

    // Multi-letter graphemes scanned longest-first so ⟨sch⟩ beats ⟨s⟩+⟨ch⟩, ⟨tsch⟩ beats ⟨t⟩+⟨sch⟩, etc.
    // JS `Object.keys(...).sort((a, b) => b.length - a.length)` is a STABLE sort over the manifest's own key
    // order; LINQ's OrderByDescending is stable too. (Every remaining key here is exactly two characters and
    // they are all distinct, so at any one scan position at most one of them can match anyway.)
    private static readonly string[] ORDER = DIGRAPHS.Keys.OrderByDescending(k => k.Length).ToArray();

    /** IPA vowel heads (for r-vocalization + the ch front/back test). */
    private static IReadOnlySet<string> VOWEL_PH => Ipa.IPA_VOWEL;

    /** A FRONT vowel head triggers the ⟨ch⟩→[ç] realization; anything else (a back vowel) → [x]. */
    private static readonly HashSet<string> FRONT_VOWEL = new(Js.CodePoints("eiyɛœøɐ"));

    /** One scan token: the IPA phones for a grapheme + a flag marking a single ⟨r⟩ (may vocalize to
     *  [ɐ̯]/[ɐ] in a coda) and a single ⟨ch⟩ (front/back realization, resolved in code). */
    private sealed class Tok
    {
        public string Ph = "";
        public bool RVar;
        public bool ChVar;
    }

    // The base characters of a phone, dropping combining diacritics (U+0300–036F incl. the ◌̯ offglide + the
    // ◌̥ lenis under-ring + the ◌͡ tie) and the length mark ◌ː — so a diphthong (iɐ̯) / long vowel (aː) is
    // still recognised as vowel-{initial,final} and a lenis [b̥] as its base [b].
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

    /** Scan a lowercased Bavarian word into phone tokens (longest-match digraphs, then single graphemes).
     *  ⟨ch⟩ is kept as a marked token so its front/back realization can be resolved against the PRECEDING
     *  vowel in code. */
    private static List<Tok> Scan(string word)
    {
        var w = Js.ToLowerCase(word.Normalize(NormalizationForm.FormC));
        var toks = new List<Tok>();
        var i = 0;
        while (i < w.Length)
        {
            var matched = false;
            foreach (var key in ORDER)
            {
                // JS `w.startsWith(key, i)` — a UTF-16 code-unit comparison, which ordinal is.
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

    /** The DORSAL FRICATIVE split: ⟨ch⟩ → [ç] after a front vowel or word-initially/after a consonant, but
     *  [x] after a back vowel (the German ich/ach allophony; ⟨sch⟩ is [ʃ], handled by the digraph). */
    private static void ResolveCh(List<Tok> toks)
    {
        for (var i = 0; i < toks.Count; i++)
        {
            if (!toks[i].ChVar) continue;
            var backContext = i > 0 && EndsWithVowel(toks[i - 1].Ph) && !EndsWithFrontVowel(toks[i - 1].Ph);
            toks[i].Ph = backContext ? "x" : "ç";
        }
    }

    /** R-VOCALIZATION: a syllable-CODA ⟨r⟩ vocalizes to the offglide [ɐ̯]; the very common ending ⟨-er⟩ → the
     *  syllabic vowel [ɐ]. A prevocalic onset ⟨r⟩ (rot, Boarisch) stays the trill/tap [r]. */
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
            // An UNSTRESSED ⟨-er⟩ collapses to a single [ɐ] — word-final (Dreier→…ɐ) or when the ⟨e⟩ is not
            // the first (stressed) vowel (Glumpert→…bɐt). A STRESSED ⟨er⟩ keeps vowel + offglide (Bersch).
            var prevIsE = i > 0 && toks[i - 1].Ph == "e";
            if (prevIsE && (i == last || i - 1 != firstVowelIdx)) { toks[i - 1].Ph = "ɐ"; t.Ph = ""; }
            else t.Ph = "ɐ̯";
        }
    }

    /** Word-final ⟨gn⟩ [ɡ̥n] COALESCES to the velar nasal [ŋ] (Regn→reːŋ, Fliagn→fliɐ̯ŋ) — a regular Bavarian
     *  coda process (the preceding vowel lengthens, folded). */
    private static void CoalesceGN(List<Tok> toks)
    {
        var last = toks.Count - 1;
        if (last > 0 && toks[last].Ph == "n" && toks[last - 1].Ph == "ɡ̥")
        {
            toks[last - 1].Ph = "";
            toks[last].Ph = "ŋ";
        }
    }

    /** Initial ⟨st sp⟩ → [ʃt ʃp] (the German rule). The stop itself is the Bavarian LENIS [d̥]/[b̥] (⟨t p⟩
     *  lenite, see the manifest), so the cluster surfaces as [ʃd̥]/[ʃb̥]. */
    private static void InitialSCluster(List<Tok> toks)
    {
        if (toks.Count >= 2 && toks[0].Ph == "s" && (toks[1].Ph == "d̥" || toks[1].Ph == "b̥")) toks[0].Ph = "ʃ";
    }

    /** POST-VOCALIC ⟨h⟩ is SILENT — a German vowel-length/hiatus marker, not the fricative [h] (Fruah→fruɐ̯,
     *  Gfüh→ɡ̥fy). ⟨h⟩ keeps its [h] only as a syllable ONSET. */
    private static void SilentH(List<Tok> toks)
    {
        for (var i = 1; i < toks.Count; i++)
            if (toks[i].Ph == "h" && EndsWithVowel(toks[i - 1].Ph)) toks[i].Ph = "";
    }

    /** ⟨k⟩ LENITES to [ɡ̥] everywhere EXCEPT a word-initial prevocalic onset — i.e. non-initially and
     *  word-initially before a LIQUID (Klass→ɡ̥lɑs). Only word-initial prevocalic ⟨k⟩ keeps fortis [k]. */
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

    /** Word-final unstressed ⟨-a⟩ [ɑ] REDUCES to [ɐ] (Bana→b̥ɑːnɐ) — the Bavarian counterpart of the German
     *  final-schwa. Only a single final ⟨a⟩ after a consonant. */
    private static void ReduceFinalA(List<Tok> toks)
    {
        var last = toks.Count - 1;
        if (last > 0 && toks[last].Ph == "ɑ" && !EndsWithVowel(toks[last - 1].Ph)) toks[last].Ph = "ɐ";
    }

    /** ⟨n⟩ → [ŋ] before a velar [k]/[ɡ̥] (⟨ng⟩ is already [ŋ]; this catches ⟨nk⟩ Bånk→b̥ɔŋɡ̥). */
    private static void VelarNasal(List<Tok> toks)
    {
        for (var i = 0; i < toks.Count - 1; i++)
            if (toks[i].Ph == "n" && (toks[i + 1].Ph == "k" || toks[i + 1].Ph == "ɡ̥")) toks[i].Ph = "ŋ";
    }

    /** Geminate collapse: a doubled consonant letter surfaces as a single phone (Bappn→bɑbm) — Bavarian has
     *  no phonemic coda length contrast in this orthography. */
    private static void Degeminate(List<Tok> toks)
    {
        for (var i = toks.Count - 1; i > 0; i--)
        {
            var p = toks[i].Ph;
            if (p != "" && p == toks[i - 1].Ph && !StartsWithVowel(p)) toks.RemoveAt(i);
        }
    }

    /** Phonemize a single Bavarian word to canonical IPA (segmental; fine vowel qualities + length folded). */
    public static string PhonemizeWord(string word)
    {
        var toks = Scan(word);
        ResolveCh(toks);
        SilentH(toks);
        InitialSCluster(toks);
        // Degeminate + CoalesceGN run BEFORE LenitK: gemination must collapse while both stops are still
        // identical, and ⟨gn⟩-coalescence must see only a GENUINE ⟨g⟩→[ɡ̥] — not a ⟨k⟩ that LenitK turned
        // into [ɡ̥] (else Dackn→d̥ɑŋ).
        Degeminate(toks);
        CoalesceGN(toks);
        LenitK(toks);
        VelarNasal(toks);
        VocalizeR(toks);
        ReduceFinalA(toks);
        return string.Concat(toks.Select(t => t.Ph));
    }

    // A word (Bavarian Latin letters incl. å ä ö ü é ß + accents) / number / punctuation token. ⟨ß⟩ is part
    // of the de-facto Bavarian-Wikipedia orthography this engine reads (dreißg), so it must not split a word.
    private static readonly JsRe TOKEN = JsRegex.Compile(
        $"({HostWord.HostWordRun(new[] { "Latin" }, "'-")})|(\\d+)|([.!?…,;:])", "gu");

    /**
     * This language's OWN inventory. ⚠ TWO DIFFERENT QUESTIONS, KEPT APART: the TOKEN class above decides
     * where the SCRIPT boundary falls (routing), while this one decides whether the g2p has rules for these
     * letters. A token this class REJECTS carries a letter the language does not use — i.e. a foreign name.
     */
    private const string NATIVE_CLASS = "[a-zåäöüéèáàâßA-ZÅÄÖÜÉÈÁÀÂ'-]";
    private static readonly Func<string, string> Nat = HostWord.MakeNativiser(NATIVE_CLASS, "u");

    private sealed class Engine : ILanguage
    {
        public string Text(string input)
        {
            // NORMALIZATION FIRST — see Normalize.cs. It rewrites `&nbsp;`, the grouping dot, the ordinal
            // `N.`, the abbreviations, the clock, the degree signs and the symbol tier into words, so
            // everything reaching TOKEN below is already something this g2p can speak.
            return Clauses.AssembleClauses(Normalize.NormalizeBavarian(input), TOKEN, (m, sink) =>
            {
                if (m.Groups[1].Success && m.Groups[1].Value.Length > 0)
                    sink.Emit(PhonemizeWord(Nat(m.Groups[1].Value)));
                // Numbers: the units-first compositor (Numbers.cs) → each word back through the same g2p.
                // ⚠ THE TOKEN STRING IS PASSED AS `raw` (#1080) — the digit-at-a-time fallback cannot
                // recover the digits from the double it exists to bypass. A bare `\d+` arm, so the token IS
                // the digit string.
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

    /** Build the Bavarian phonemizer (grapheme g2p + falling diphthongs + German-style rules). */
    public static ILanguage CreateBavarian() => new Engine();

    internal static void RegisterSelf() => Registry.Register("bavarian", () => CreateBavarian());
}
