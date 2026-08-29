/**
 * Standard Albanian (sq) phonemizer — Shqip (Tosk-based standard), Latin script, canonical IPA.
 *
 * Fairly phonemic: a longest-match scan over the digraph system (⟨dh th sh zh xh⟩→[ð θ ʃ ʒ d͡ʒ],
 * the palatals ⟨gj⟩→[ɟ] / ⟨q⟩→[c], ⟨nj⟩→[ɲ], ⟨ll⟩→[ɫ], ⟨rr⟩→[r]) then single graphemes — the
 * 7-vowel system (⟨e⟩→[ɛ], ⟨y⟩→[y], ⟨ë⟩→[ə]), ⟨c⟩→[t͡s], ⟨ç⟩→[t͡ʃ], ⟨x⟩→[d͡z], ⟨r⟩→[ɾ] (tap).
 * Penultimate stress (unwritten, the Albanian default).
 * Ported from src/languages/albanian/albanian.ts — see that file and albanian.jsonc for the corpus
 * evidence.
 */
using System.Text;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Albanian;

public static class AlbanianPhonemizer
{
    private static IReadOnlyDictionary<string, string> DIGRAPHS => Manifest.MANIFEST.Digraphs;
    private static IReadOnlyDictionary<string, string> G => Manifest.MANIFEST.Graphemes;
    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => Manifest.MANIFEST.ClausePunctuation;
    private static readonly IReadOnlySet<string> VOWEL = Ipa.IPA_VOWEL;
    private static readonly HashSet<string> SIBILANT = new(Manifest.MANIFEST.Sibilants, StringComparer.Ordinal);
    private static readonly HashSet<string> NASAL = new(Manifest.MANIFEST.Nasals, StringComparer.Ordinal);

    /** Sonority class (higher = more sonorous): vowel 6, glide 5, liquid 4, nasal 3, fricative 2, affricate 1, stop 0. */
    private static int Sonority(string seg)
    {
        if (VOWEL.Contains(seg)) return 6;
        if (seg == "j" || seg == "w") return 5;
        if (seg is "l" or "ɫ" or "r" or "ɾ") return 4;
        if (NASAL.Contains(seg)) return 3;
        if (seg.Contains("͡")) return 1; // affricate (t͡s d͡z t͡ʃ d͡ʒ)
        if (seg is "f" or "v" or "s" or "z" or "ʃ" or "ʒ" or "θ" or "ð" or "h") return 2;
        return 0; // stop (p b t d k ɡ c ɟ q)
    }

    /** Phonemize one Albanian word → canonical IPA: longest-match scan + penultimate stress. */
    public static string PhonemizeWord(string word)
    {
        var w = Js.ToLowerCase(word.Normalize(NormalizationForm.FormC));
        var segs = new List<string>();
        var i = 0;
        while (i < w.Length)
        {
            var matched = false;
            foreach (var key in Manifest.DIGRAPH_KEYS)
            {
                if (i + key.Length <= w.Length && string.CompareOrdinal(w, i, key, 0, key.Length) == 0)
                {
                    segs.Add(DIGRAPHS[key]);
                    i += key.Length;
                    matched = true;
                    break;
                }
            }
            if (matched) continue;
            // ⚠ A letter with no rule here still denotes a sound; dropping it deletes what the writer typed.
            // Consulted AFTER every digraph and single-letter rule, so it cannot override this language.
            var c = w[i].ToString();
            var ph = G.TryGetValue(c, out var g)
                ? g
                : LatinPhones.LatinPhone(c, new PhoneOpts { Initial = i == 0 });
            if (ph is not null) segs.Add(ph);
            i += 1;
        }
        // Penultimate stress (the Albanian default; unwritten): ˈ before the MAXIMAL valid onset of the
        // second-to-last vowel's syllable (or the sole vowel of a monosyllable). Back up over the onset
        // cluster by the sonority sequencing principle (rising toward the vowel) + Albanian's sibilant-
        // initial (st, sht, str) and nasal-initial (mp, nd, mpr) onsets, but NOT the invalid ⟨tl dl⟩.
        var vidx = new List<int>();
        for (var k = 0; k < segs.Count; k++)
            if (VOWEL.Contains(segs[k])) vidx.Add(k);
        if (vidx.Count > 0)
        {
            var nucleus = vidx.Count >= 2 ? vidx[vidx.Count - 2] : vidx[0];
            var at = nucleus;
            while (at > 0 && !VOWEL.Contains(segs[at - 1]))
            {
                var p = segs[at - 1];
                var l = segs[at];
                var rising = Sonority(p) < Sonority(l) && !((p == "t" || p == "d") && (l == "l" || l == "ɫ"));
                var sibilant = SIBILANT.Contains(p) && Sonority(l) <= 2; // s/ʃ/z/ʒ + stop/affricate/fricative
                var nasal = NASAL.Contains(p) && Sonority(l) <= 1; // m/n + stop/affricate (mp, nd, mpr)
                if (!(rising || sibilant || nasal)) break;
                at--;
            }
            segs.Insert(at, "ˈ");
        }
        return string.Concat(segs).Normalize(NormalizationForm.FormC);
    }

    // A word (Albanian Latin letters incl. ç ë) / number / punctuation token.
    private static readonly JsRe TOKEN = JsRegex.Compile($"({HostWord.LATIN_RUN})|(\\d+)|([.!?…,;:])", "giu");

    /**
     * This language's OWN inventory — the TOKEN word class as it stood before the widening above, lifted
     * verbatim, so nothing about the orthography is invented here. A token this REJECTS carries a letter
     * the language does not use, i.e. a foreign name. See core/hostWord.ts: this is the INVENTORY
     * question, and it is no longer also deciding where the script boundary falls.
     */
    private const string NATIVE_CLASS = "[a-zçëA-ZÇË]";
    private static readonly Func<string, string> Nat = HostWord.MakeNativiser(NATIVE_CLASS, "iu");

    private sealed class Engine : ILanguage
    {
        public string Text(string input)
        {
            return Clauses.AssembleClauses(Normalize.NormalizeAlbanian(input), TOKEN, (m, sink) =>
            {
                if (m.Groups[1].Success && m.Groups[1].Value.Length > 0)
                {
                    sink.Emit(PhonemizeWord(Nat(m.Groups[1].Value)));
                }
                // Numbers: compose the Albanian numeral phrase, then phonemize each word through the same g2p.
                else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
                {
                    foreach (var wd in Numbers.NumberToWords(Js.Number(m.Groups[2].Value), m.Groups[2].Value).Split(' '))
                        sink.Emit(PhonemizeWord(wd));
                }
                else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
                {
                    if (CLAUSE_MARK.TryGetValue(m.Groups[3].Value, out var mk) && mk.Length > 0) sink.Pause(mk);
                }
            });
        }
    }

    /** Build the Albanian phonemizer (direct digraph-rich g2p + penultimate stress). */
    public static ILanguage CreateAlbanian() => new Engine();

    internal static void RegisterSelf() => Registry.Register("albanian", () => CreateAlbanian());
}
