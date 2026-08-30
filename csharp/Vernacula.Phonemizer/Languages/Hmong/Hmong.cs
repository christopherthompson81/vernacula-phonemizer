/**
 * Hmong (hmn) — White Hmong / Hmoob Dawb (Hmong Daw, mww), Hmong-Mien, tonal (~8M). This phonemizer
 * consumes the Romanized Popular Alphabet (RPA) — the community-standard phonemic Latin orthography — and
 * converts it to canonical IPA. RPA has NO coda consonants, so a word-final consonant letter is ALWAYS a
 * TONE marker (⟨b j v s g m d⟩; no final letter = the mid tone). The converter: strip the final tone letter
 * → tone, then [onset] (longest multigraph match) + rime → IPA + a Chao tone letter. ⟨tx x⟩ PALATALISE to
 * [t͡ɕ ɕ] before /i/; a vowel-initial syllable gets a glottal onset [ʔ]. A run that does not parse as RPA is
 * handed to the shared foreign reader rather than echoed raw.
 * Ported from src/languages/hmong/hmong.ts — see that file for the corpus evidence.
 */
using System.Text;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Hmong;

public static class HmongPhonemizer
{
    private static IReadOnlyDictionary<string, string> INITIALS => Manifest.MANIFEST.Initials;
    private static IReadOnlyDictionary<string, string> RIMES => Manifest.MANIFEST.Rimes;
    private static IReadOnlyDictionary<string, string> PALATAL => Manifest.MANIFEST.PalatalBeforeI;
    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => Manifest.MANIFEST.ClausePunctuation;

    /** One RPA syllable → IPA. Strip the final tone letter, then onset + rime; palatalise ⟨tx x⟩ before /i/;
     *  a vowel-initial syllable takes a glottal onset [ʔ]. Unknown material is returned as-is (the failure
     *  signal `Reads` and `ReadRun` key on). */
    public static string SyllableToIpa(string syl)
    {
        var w = Js.ToLowerCase(syl.Normalize(NormalizationForm.FormC));
        if (w.Length == 0) return "";
        // The tone = the final consonant LETTER (RPA has no codas); no such letter → tone 4 (mid).
        var last = w[^1].ToString();
        var lastIsTone = w.Length > 1 && Manifest.TONE_LETTERS.Contains(last);
        var base_ = lastIsTone ? w[..^1] : w;
        string tone = "4";
        if (lastIsTone && Manifest.MANIFEST.ToneLetter.TryGetValue(last, out var tl)) tone = tl;
        var chao = Manifest.MANIFEST.ToneChao.TryGetValue(tone, out var ch) ? ch : "";
        // Onset: longest multigraph match; none matched + vowel-initial → glottal [ʔ]; none + consonant → unknown.
        var ini = "";
        foreach (var k in Manifest.INITIAL_KEYS)
            if (base_.StartsWith(k, StringComparison.Ordinal)) { ini = k; break; }
        var rimeRpa = base_[ini.Length..];
        string? rime = null;
        foreach (var r in Manifest.RIME_KEYS)
            if (rimeRpa == r) { rime = r; break; }
        if (rime is null) return syl; // unknown rime → NOT RPA; `ReadRun` routes it
        var iniIpa = ini == "" ? "ʔ" : (INITIALS.TryGetValue(ini, out var ip) ? ip : "");
        if (rime[0] == 'i' && PALATAL.TryGetValue(ini, out var pal)) iniIpa = pal; // ⟨tx x⟩ → palatal before /i/
        return iniIpa + RIMES[rime] + chao;
    }

    /** Did the converter READ this string, or hand it back? The one test for "is this RPA" — `SyllableToIpa`
     *  returns its own input on an unknown rime, so identity IS the failure signal. */
    private static bool Reads(string syl) => syl.Length > 0 && SyllableToIpa(syl) != syl;

    /**
     * A SOLID-WRITTEN RPA POLYSYLLABLE → its syllables, or null if the run is not one. Every syllable must
     * carry a tone letter — the ONLY boundary signal RPA gives — which is a PRECISION GATE rather than a rule
     * of RPA: it is what stops a bare-syllable-legality segmenter from reading English residue as Hmong.
     * Fewest syllables first, longest-match on ties. See the TS for the measured trade.
     */
    private static List<string>? SplitRpaSyllables(string run)
    {
        var w = Js.ToLowerCase(run.Normalize(NormalizationForm.FormC));
        int n = w.Length;
        // `cuts[i]` = fewest syllables covering w[i..n); Infinity if unreachable.
        var cuts = new double[n + 1];
        Array.Fill(cuts, double.PositiveInfinity);
        cuts[n] = 0;
        for (int i = n - 1; i >= 0; i--)
        {
            for (int k = i + 2; k <= n; k++)
            {
                if (!Manifest.TONE_LETTERS.Contains(w[k - 1].ToString())) continue;
                if (double.IsInfinity(cuts[k])) continue;
                if (!Reads(w[i..k])) continue;
                cuts[i] = Math.Min(cuts[i], 1 + cuts[k]);
            }
        }
        if (double.IsInfinity(cuts[0]) || cuts[0] < 2) return null; // not RPA, or a single syllable (already read)
        var outp = new List<string>();
        for (int i = 0; i < n; )
        {
            // Longest arc that still achieves the minimum — maximal munch, deterministic.
            int best = -1;
            for (int k = n; k >= i + 2; k--)
            {
                if (!Manifest.TONE_LETTERS.Contains(w[k - 1].ToString()) || double.IsInfinity(cuts[k])) continue;
                if (cuts[k] + 1 != cuts[i] || !Reads(w[i..k])) continue;
                best = k;
                break;
            }
            if (best < 0) return null; // unreachable given cuts[0] < Infinity, but never guess a syllable
            outp.Add(w[i..best]);
            i = best;
        }
        return outp;
    }

    /**
     * ONE LATIN RUN → the sink, in three steps: read it as ONE RPA syllable; else as a solid-written RPA
     * POLYSYLLABLE; else hand it to the shared FOREIGN reader. `original` (not the nativised form) is what
     * the foreign reader gets — it wants the spelling as typed.
     */
    private static void ReadRun(string word, string original, ClauseSink sink)
    {
        var one = SyllableToIpa(word);
        if (one != word) { sink.Emit(one); return; } // ordinary single RPA syllable — the common case
        var parts = SplitRpaSyllables(word);
        if (parts is not null) { foreach (var p in parts) sink.Emit(SyllableToIpa(p)); return; }
        Clauses.EmitUnclaimed(original, sink);
    }

    private sealed class Engine : ILanguage
    {
        public string Text(string input)
        {
            return Clauses.AssembleClauses(Normalize.NormalizeHmong(input), TOKEN, (m, sink) =>
            {
                if (m.Groups[1].Success && m.Groups[1].Value.Length > 0)
                    ReadRun(Nat(m.Groups[1].Value), m.Groups[1].Value, sink);
                else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
                {
                    var tok = m.Groups[2].Value;
                    foreach (var wd in Numbers.NumberToHmongWords(Js.Number(tok), tok))
                        sink.Emit(SyllableToIpa(wd));
                }
                else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
                {
                    if (CLAUSE_MARK.TryGetValue(m.Groups[3].Value, out var mk) && mk.Length > 0) sink.Pause(mk);
                }
            });
        }
    }

    /** RPA syllables are space/hyphen-separated Latin letter-runs. The fullwidth clause marks are spelled as
     *  escapes (a literal typed into a shell would not survive). */
    private static readonly JsRe TOKEN = JsRegex.Compile(
        $"({HostWord.LATIN_RUN})|(\\d+)|([\\u3002\\uff0c\\u3001\\uff1f\\uff01\\uff1b\\uff1a.,?!;:])", "gu");

    /** This language's OWN inventory — a different question from TOKEN's script boundary above. */
    private const string NATIVE_CLASS = "[a-zA-Z]";
    private static readonly Func<string, string> Nat = HostWord.MakeNativiser(NATIVE_CLASS, "u");

    /** Bare RPA word → IPA (tests / referee eval). */
    public static string PhonemizeWord(string word) => SyllableToIpa(word);

    /** Build the Hmong (White Hmong / RPA) phonemizer — RPA → IPA (segmental + citation tone). */
    public static ILanguage CreateHmong() => new Engine();

    internal static void RegisterSelf() => Registry.Register("hmong", () => CreateHmong());
}
