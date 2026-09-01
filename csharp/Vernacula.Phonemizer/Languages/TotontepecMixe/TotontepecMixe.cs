/**
 * Totontepec Mixe (mto) phonemizer — a greedy scan over the modern SIL practical orthography + Crawford's
 * allophony as passes, canonical IPA. This file owns the passes: POST-NASAL VOICING, intervocalic
 * /d g/→[ð ɣ], ⟨n⟩→[ŋ] before a velar, ⟨ny⟩→[ɲ], the voiceless nasals beside /h/, the word-final ⟨v⟩
 * terminus, plus the underline/stress-mark stripping. The grapheme tables live in totontepecmixe.jsonc.
 * Ported from src/languages/totontepecmixe/totontepecmixe.ts — see that file for the Crawford provenance.
 */
using System.Text;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.TotontepecMixe;

/** One segment: its IPA and whether the SCAN classified it as a vowel. */
public sealed class Seg
{
    public string Ph = "";
    public bool Vowel;
}

public static class TotontepecMixePhonemizer
{
    private static readonly IReadOnlyDictionary<string, string> VOWEL = Manifest.DEF.Vowels;
    private static readonly IReadOnlyDictionary<string, string> CONS = Manifest.DEF.Consonants;
    private static readonly IReadOnlyDictionary<string, string> POSTNASAL_VOICE = Manifest.DEF.PostNasalVoice;
    private static readonly (string Key, string Ph)[] DIGRAPHS = Manifest.DIGRAPHS;
    private static readonly IReadOnlySet<string> NASAL = Manifest.NASAL;
    private static readonly IReadOnlySet<string> VELAR = Manifest.VELAR;

    /** The UNDERLINE diacritic (U+0331/U+0332) and the ACUTE/GRAVE stress marks (U+0301/U+0300), spelled as
     *  escapes because a combining mark in source is invisible. Order is the TS's. */
    private static readonly JsRe STRIP = JsRegex.Compile("[\\u0331\\u0332\\u0301\\u0300]", "gu");

    /** One Totontepec Mixe word → canonical IPA. */
    public static string PhonemizeWord(string word)
    {
        // Strip the UNDERLINE diacritic (a modern orthographic mark absent from Crawford; most likely
        // GLOTTALIZED/CREAKY phonation, but with no referee to place the creaky diacritic it is read as the
        // plain vowel, disclosed) AND the ACUTE/GRAVE stress marks (the orthography marks stress, which is
        // not emitted; stripped so the accented vowel is READ, not dropped), then re-compose.
        var t = Js.Normalize(
            STRIP.Replace(Js.ToLowerCase(Js.Normalize(word, NormalizationForm.FormD)), ""),
            NormalizationForm.FormC);
        var segs = new List<Seg>();
        var i = 0;
        while (i < t.Length)
        {
            var dg = FindDigraph(t, i);
            if (dg is not null) { segs.Add(new Seg { Ph = dg.Value.Ph, Vowel = false }); i += dg.Value.Key.Length; continue; }
            var c = t[i].ToString();
            if (VOWEL.TryGetValue(c, out var v))
            {
                // a doubled vowel → LENGTH (aa→aː). (The two graphemes may differ in the underline, already
                // stripped.)
                if (i + 1 < t.Length && t[i + 1].ToString() == c)
                { segs.Add(new Seg { Ph = v + "ː", Vowel = true }); i += 2; continue; }
                segs.Add(new Seg { Ph = v, Vowel = true }); i++; continue;
            }
            // ⚠ A letter with no rule here still denotes a sound; dropping it deletes what the writer typed.
            // Only reached when every grapheme (digraphs included) has declined, so the language's own
            // reading wins.
            {
                // ⚠ THE SEGMENT IS CLASSIFIED, NOT ASSUMED CONSONANTAL. `LatinPhone` returns real VOWEL
                // phones for letters that reach here — å→[oː], æ, and the circumflex/tilde series — and
                // marking those `Vowel = false` made them invisible to the intervocalic ⟨d g⟩ lenition and
                // the word-final ⟨v⟩ terminus, both of which ask whether the NEIGHBOUR is a vowel.
                // ⚠ The residual is the helper's own scope: `IsVowel` knows this language's inventory
                // (aeiouæɨʌʊ), so ⟨ø⟩ and ⟨œ⟩ are still consonantal. Widening it would be a claim about the
                // phonology no source here supports.
                var ph = CONS.TryGetValue(c, out var cp)
                    ? cp
                    : LatinPhones.LatinPhone(c, new PhoneOpts { Initial = i == 0, IncludeH = true });
                if (ph is not null) segs.Add(new Seg { Ph = ph, Vowel = IsVowel(ph) });
            }
            i++;
        }
        ConsonantPasses(segs);
        return string.Concat(segs.Select(x => x.Ph)).Normalize(NormalizationForm.FormC);
    }

    /** JS `DIGRAPHS.find(([k]) => t.startsWith(k, i))` — first match over the longest-first manifest list. */
    private static (string Key, string Ph)? FindDigraph(string t, int i)
    {
        foreach (var d in DIGRAPHS)
            if (t.AsSpan(i).StartsWith(d.Key, StringComparison.Ordinal)) return d;
        return null;
    }

    /** TS `isVowel` — this language's OWN vowel inventory, tested against the phone's FIRST character
     *  (so a length mark or a diacritic after it does not matter). */
    private static bool IsVowel(string ph) =>
        ph.Length > 0 && "aeiouæɨʌʊ".Contains(ph[0], StringComparison.Ordinal);

    private static bool Nas(string ph) => ph == "m" || ph == "n" || ph == "ɲ" || ph == "ŋ";

    /** The Crawford allophony passes. */
    private static void ConsonantPasses(List<Seg> segs)
    {
        for (var i = 0; i < segs.Count; i++)
        {
            var s = segs[i];
            if (s.Vowel) continue;
            var prev = i - 1 >= 0 ? segs[i - 1] : null;
            var next = i + 1 < segs.Count ? segs[i + 1] : null;
            // ⟨ny⟩ → [ɲ] (the palatal nasal; the ⟨y⟩=[j] is absorbed).
            if (s.Ph == "n" && next is not null && next.Ph == "j") { s.Ph = "ɲ"; next.Ph = ""; continue; }
            // ⟨n⟩ → [ŋ] before a velar stop.
            if (s.Ph == "n" && next is not null && VELAR.Contains(next.Ph)) { s.Ph = "ŋ"; continue; }
            // POST-NASAL VOICING: /p t ts k/ → [b d d͡z ɡ] after a nasal. ⚠ JS `prev.ph[0]` is undefined on an
            // emptied segment, which never equals "ŋ" — so an emptied prev falls through to the whole (empty)
            // string and misses, exactly as here.
            if (prev is not null
                && NASAL.Contains(prev.Ph.Length > 0 && prev.Ph[0] == 'ŋ' ? "n" : prev.Ph)
                && POSTNASAL_VOICE.TryGetValue(s.Ph, out var voiced))
            {
                s.Ph = voiced;
                continue;
            }
            // INTERVOCALIC ⟨d g⟩ → the fricatives [ð ɣ] (voiced stops only after a nasal, handled above).
            if ((s.Ph == "d" || s.Ph == "ɡ") && prev is not null && prev.Vowel && next is not null && next.Vowel)
                s.Ph = s.Ph == "d" ? "ð" : "ɣ";
            // A NASAL adjacent to /h/ → a VOICELESS nasal [m̥ n̥ ɲ̥ ŋ̥] (Crawford §1.121); the /h/ is absorbed.
            // Both orders: ⟨mh⟩ (nasal + h) and ⟨hn⟩ (h + nasal).
            if (Nas(s.Ph) && next is not null && next.Ph == "h") { s.Ph += "̥"; next.Ph = ""; continue; }
            if (s.Ph == "h" && next is not null && Nas(next.Ph)) { next.Ph += "̥"; s.Ph = ""; continue; }
        }
        // WORD-FINAL ⟨v⟩ → [f] as a terminus (Crawford §1.121 v-c): after a short vowel → [f] (cív→[t͡síf]);
        // after /a/ → [w] (sáv→[sáw]); after a LONG vowel/diphthong → [v] stays.
        var last = segs.Count > 0 ? segs[^1] : null;
        var pen = segs.Count > 1 ? segs[^2] : null;
        if (last is not null && last.Ph == "v" && pen is not null && pen.Vowel)
            last.Ph = pen.Ph == "a" ? "w" : pen.Ph.Contains('ː') ? "v" : "f";
    }

    // Modern Totontepec Mixe letters (incl. ä ë ö ü, the underline, and the ʼ/ꞌ glottal). Word / number /
    // punctuation. The `extra` characters are the four apostrophe shapes and the hyphen.
    private static readonly JsRe TOKEN = JsRegex.Compile(
        $"({HostWord.HostWordRun(new[] { "Latin" }, "ʼ'’`-")})|(\\d+)|([.?!,;:…])", "giu");

    /**
     * This language's OWN inventory. ⚠ TWO DIFFERENT QUESTIONS, KEPT APART: the TOKEN class above decides
     * where the SCRIPT boundary falls (routing), while this one decides whether the g2p has rules for these
     * letters. A token this class REJECTS carries a letter the language does not use — i.e. a foreign name.
     *
     * ⚠ SPELLED WITH ESCAPES FOR THE INVISIBLE PART. The TS source reads `…ÄËÖǛ-ͯ…`, but that ⟨Ǜ⟩ is not a
     * precomposed letter — it is ⟨Ü⟩ U+00DC followed by U+0300, so what follows is the RANGE U+0300–U+036F
     * (the combining marks). Written out here so nobody "fixes" it into a single character.
     */
    private const string NATIVE_CLASS = "[a-zäëöüáéíóúÄËÖÜ\\u0300-\\u036f\\u02bc\\ua78c'\\u2019`-]";
    private static readonly Func<string, string> Nat = HostWord.MakeNativiser(NATIVE_CLASS, "iu");

    private sealed class Engine : ILanguage
    {
        public string Text(string input) =>
            Clauses.AssembleClauses(
                Normalize.NormalizeTotontepecMixe(Rewriter.Renormalize(input, NormalizationForm.FormC)),
                TOKEN, (m, sink) =>
                {
                    if (m.Groups[1].Success && m.Groups[1].Value.Length > 0)
                        sink.Emit(PhonemizeWord(Nat(m.Groups[1].Value)));
                    else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
                    {
                        foreach (var wd in Numbers.NumberToWords(Js.Number(m.Groups[2].Value), m.Groups[2].Value).Split(' '))
                            sink.Emit(PhonemizeWord(wd));
                    }
                    else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
                        sink.Pause(m.Groups[3].Value is "." or "!" or "?" ? m.Groups[3].Value : ",");
                });
    }

    /** Build the Totontepec Mixe phonemizer (Crawford-grounded consonants + allophony; reconstructed vowels). */
    public static ILanguage CreateTotontepecMixe() => new Engine();

    internal static void RegisterSelf() => Registry.Register("totontepecmixe", CreateTotontepecMixe);
}
