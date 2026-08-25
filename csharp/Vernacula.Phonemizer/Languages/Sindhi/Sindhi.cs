/**
 * Native Sindhi (sd) text phonemizer — canonical IPA. Perso-Arabic (Sindhi) ABJAD → the consonant +
 * LONG-vowel skeleton (the implosives ٻɓ ڏɗ ڄʄ ڳɠ and the retroflex series included) via a rule g2p; the
 * usually-unwritten SHORT vowels default to [ə], restored on covered words by the shipped lexicon.
 * Ported from src/languages/sindhi/sindhi.ts — see that file for the corpus evidence.
 */
using System.Text;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Sindhi;

/** Resolve an OOV word to IPA — consulted BETWEEN the lexicon and the rule engine; null for "no opinion".
 *  Used only by the async neural path (SindhiNeural.cs), so the sync engine is unchanged. */
public delegate string? OovResolver(string word);

public sealed class SindhiPhonemizer : ILanguage
{
    private static SindhiDef DEF => Manifest.DEF;
    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => DEF.ClausePunctuation;

    private const string HE = "ھ";

    /** The scan marks its DEFAULT-inserted [ə] with a private-use sentinel so the nasal-assimilation pass
     *  consumes only that ə and never one the writer spelled with a harakat. Stripped at the end of
     *  PhonemizeCore, so it never escapes this module. */
    private const string DEFAULT_SCHWA = "\uE000";
    private const string NOON_GHUNNA = "ں"; // nasalization

    private static bool IsConsonant(string c) => DEF.Consonants.ContainsKey(c);
    private static bool IsVowelLetter(string c) => DEF.LongVowels.ContainsKey(c);

    /** JS `if (DEF.harakat[c])` — a missing key AND an empty string are both falsy. */
    private static string? Harakat(string c) =>
        DEF.Harakat.TryGetValue(c, out var v) && v.Length > 0 ? v : null;

    /** Scan a Sindhi (Perso-Arabic) word → IPA. Consonants + long vowels are recoverable; short vowels
     *  default to [ə]. `vocalized`: the word is FULLY harakat-marked, so the diacritics are authoritative
     *  and the default-[ə] insertion is OFF. */
    private static string Scan(string word, bool vocalized = false)
    {
        var s = Js.CodePoints(word);
        var outp = new List<string>();
        var prevNucleus = false; // was the last emitted unit a vowel nucleus?
        for (var i = 0; i < s.Count;)
        {
            var c = s[i];
            var h = Harakat(c);
            if (h is not null)
            {
                outp.Add(h);
                prevNucleus = true;
                i++;
                continue;
            }
            if (c == NOON_GHUNNA)
            {
                if (prevNucleus) outp[^1] += "̃";
                i++;
                continue;
            }
            // long-vowel / glide letters: a long vowel after a consonant, a glide word-initially or in hiatus
            if (IsVowelLetter(c))
            {
                if (outp.Count == 0)
                {
                    // A harakat FOLLOWING a bare alif is the carrier's own vowel — emit nothing here, or the
                    // two stack into a spurious əi/əu.
                    if (c == "ا" && Harakat(i + 1 < s.Count ? s[i + 1] : "") is not null)
                    {
                        prevNucleus = false;
                        i++;
                        continue;
                    }
                    outp.Add(c == "آ" ? "aː"
                        : c == "ا" ? "ə"
                        : DEF.Glides.TryGetValue(c, out var gl) ? gl : DEF.LongVowels[c]);
                    prevNucleus = !(c == "و" || c == "ي" || c == "ی" || c == "ے");
                }
                else if (prevNucleus)
                {
                    outp.Add(DEF.Glides.TryGetValue(c, out var gl2) ? gl2 : DEF.LongVowels[c]);
                    prevNucleus = false;
                }
                else
                {
                    outp.Add(DEF.LongVowels[c]);
                    prevNucleus = true;
                }
                i++;
                continue;
            }
            // ئ/ؤ are hamza SEATS: emit nothing, but break the glide so a following ي/و is a full vowel.
            if (c == "ئ" || c == "ؤ")
            {
                prevNucleus = false;
                i++;
                continue;
            }
            if (c == "ع") // usually SILENT / a vowel modifier in Sindhi, not a full [ʔ]
            {
                i++;
                continue;
            }
            if ((c == "ه" || c == "ہ" || c == "ح") && i == s.Count - 1) // word-final silent vowel-carrier
            {
                i++;
                continue;
            }
            if (IsConsonant(c))
            {
                if (i + 1 < s.Count && s[i + 1] == HE && DEF.AspirateWithHe.TryGetValue(c, out var asp))
                {
                    outp.Add(asp);
                    i += 2;
                }
                else
                {
                    outp.Add(DEF.Consonants[c]);
                    i++;
                }
                prevNucleus = false;
                // insert a default short [ə] when no vowel is written before the next consonant / word-end
                var nx = i < s.Count ? s[i] : "";
                if (!vocalized && (nx == "" || (IsConsonant(nx) && nx != HE)))
                {
                    outp.Add(DEFAULT_SCHWA);
                    prevNucleus = true;
                }
                continue;
            }
            i++; // unknown → skip
        }
        return string.Concat(outp);
    }

    private static readonly JsRe N_VELAR = JsRegex.Compile("n\uE000?(?=(?:kʰ|[kɡxɠ]))", "gu");
    private static readonly JsRe N_LABIAL = JsRegex.Compile("n\uE000?(?=[bpɓ])", "gu");
    private static readonly JsRe N_RETROFLEX = JsRegex.Compile("n\uE000?(?=[ʈɖɳɽ])", "gu");
    private static readonly JsRe N_PALATAL = JsRegex.Compile("n\uE000?(?=(?:d͡ʒ|t͡ʃ|ʄ))", "gu");
    private static readonly JsRe N_DENTAL = JsRegex.Compile("n\uE000(?=t̪|d̪)", "gu");
    private static readonly JsRe SENTINEL = JsRegex.Compile("\uE000", "gu");

    /** Rule g2p: the consonant + long-vowel skeleton with default-[ə] short vowels, then homorganic nasal
     *  assimilation — each rule also CONSUMING the default [ə] the abjad scan inserted inside the cluster. */
    private static string PhonemizeCore(string word, bool vocalized = false)
    {
        var s = Scan(word, vocalized);
        s = N_VELAR.Replace(s, "ŋ");
        s = N_LABIAL.Replace(s, "m");
        s = N_RETROFLEX.Replace(s, "ɳ");
        s = N_PALATAL.Replace(s, "ɲ");
        s = N_DENTAL.Replace(s, "n");
        s = SENTINEL.Replace(s, "ə");
        return s.Normalize(NormalizationForm.FormC);
    }

    /** SHORT-VOWEL restoration lexicon (sindhi-lexicon.tsv): bare word → voweled IPA, mined from kaikki. */
    private static IReadOnlyDictionary<string, string>? LEX;
    private static IReadOnlyDictionary<string, string> Lexicon() =>
        LEX ??= LoadTsv.LoadTsvMap("languages/sindhi", "sindhi-lexicon.tsv", optional: true);

    /** One Sindhi word → canonical IPA, SHIPPED path (rule g2p + the kaikki short-vowel restoration lexicon).
     *  Lexicon entries are stored UNSTRESSED, so weight stress is applied at lookup. */
    public static string PhonemizeWord(string word) =>
        Stress(Lexicon().TryGetValue(word, out var hit) ? hit : PhonemizeCore(word));

    /** One Sindhi word → canonical IPA, RULE-ONLY (no lexicon) — the non-circular signal for the referee eval. */
    public static string PhonemizeWordRules(string word) => Stress(PhonemizeCore(word));

    /** Quantity-sensitive word stress — the shared Indo-Aryan weight rule already used by hi/ur/pa. */
    private static string Stress(string ipa) =>
        WeightStress.ApplyWeightStress(ipa).Normalize(NormalizationForm.FormC);

    private const string SD_WORD = "ء-ٟٮ-ۿ";

    /** A digit run → Sindhi number words → IPA through this engine's own g2p. Indic lakh/crore grouping. */
    private static string Number(string digits)
    {
        var n = Js.Number(digits);
        // ⚠ Above 2^53 the float has lost the low digits, so composing a quantity is refused; the reading
        // falls back to a digit string rather than vanishing.
        if (!(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d))
            return Core.Numbers.SpellDigits(digits, DEF.Numbers, w => PhonemizeWordWith(w));
        return Core.Numbers.RenderNumber(n, DEF.Numbers, w => PhonemizeWordWith(w));
    }

    private static readonly JsRe TOKEN =
        JsRegex.Compile($"([{SD_WORD}]+)|({HostWord.LATIN_RUN})|(\\d+)|([۔؟،؛.?,])", "gu");

    private readonly Func<string, string>? _foreign;
    private SindhiPhonemizer(Func<string, string>? foreign = null) => _foreign = foreign;

    public string Text(string rawInput) => Text(rawInput, null);

    public string Text(string rawInput, OovResolver? oovOverride)
    {
        // everything the g2p cannot read is rewritten to Sindhi words FIRST — see Normalize.cs.
        return Clauses.AssembleClauses(Normalize.NormalizeSindhi(rawInput), TOKEN, (m, sink) =>
        {
            if (m.Groups[1].Success && m.Groups[1].Value.Length > 0)
                sink.Emit(PhonemizeWordWith(m.Groups[1].Value, oovOverride));
            // A LATIN run goes to the foreign phonemizer; a DIGIT run does NOT.
            else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
                sink.Emit(_foreign is not null ? _foreign(m.Groups[2].Value) : "");
            else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
                sink.Emit(Number(m.Groups[3].Value));
            else if (m.Groups[4].Success && m.Groups[4].Value.Length > 0)
            {
                var mk = CLAUSE_MARK.GetValueOrDefault(m.Groups[4].Value);
                if (!string.IsNullOrEmpty(mk)) sink.Pause(mk);
            }
        });
    }

    /** Lexicon → oovOverride → rules. The lexicon still wins any word it covers. */
    private static string PhonemizeWordWith(string word, OovResolver? oov = null)
    {
        if (Lexicon().TryGetValue(word, out var hit) && hit.Length > 0) return Stress(hit);
        var o = oov?.Invoke(word);
        return !string.IsNullOrEmpty(o) ? Stress(o) : Stress(PhonemizeCore(word));
    }

    /** True when the shipped lexicon covers `word` — the neural path uses this to skip covered words.
     *  Deliberately the SAME lookup the engine performs (no normalisation). */
    public static bool SindhiLexiconHas(string word) => Lexicon().ContainsKey(word);

    /** Build the Sindhi phonemizer. `foreign` reads embedded Latin words and digit runs. */
    public static SindhiPhonemizer CreateSindhi(Func<string, string>? foreign = null) => new(foreign);

    /** Build the Sindhi engine with a per-call `oovOverride` hook (the async neural path). */
    public static SindhiPhonemizer CreateSindhiEngine() => new();

    internal static void RegisterSelf() => Registry.Register("sindhi", () => CreateSindhi(Registry.ReadAsEnglish));
}
