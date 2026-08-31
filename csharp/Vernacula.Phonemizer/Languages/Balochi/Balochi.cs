/**
 * Native Balochi / بلوچی (bal) text phonemizer — canonical IPA. Northwestern Iranian, SOUTHERN Balochi,
 * CROSS-SCRIPT: the defective Balochi ARABIC abjad (whose g2p recovers only a consonant + long-vowel
 * skeleton) and a PHONEMIC ROMAN orthography (full IPA), routed by script detection and bridged by the
 * cross-script lexicon — a word looked up by EITHER spelling returns the full-voweled IPA the abjad
 * loses; OOV falls back to the per-script g2p. Cardinals use the Iranian-core / lakh-crore-magnitude
 * compositor with the enclitic connective -u.
 * Ported from src/languages/balochi/balochi.ts — see that file for the corpus evidence.
 */
using System.Text;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Balochi;

public sealed class BalochiPhonemizer : ILanguage
{
    private static readonly IReadOnlyDictionary<string, string> CONS = Manifest.DEF.Consonants;
    private static readonly IReadOnlyDictionary<string, string> VOW = Manifest.DEF.Vowels;
    private static readonly IReadOnlyDictionary<string, string> CLAUSE_MARK = Manifest.DEF.ClausePunctuation;
    private static readonly HashSet<string> VOWEL_LETTERS = new(Manifest.DEF.VowelLetters, StringComparer.Ordinal);
    private static readonly IReadOnlyDictionary<string, string> HARAKAT = Manifest.DEF.Harakat;
    private static readonly string SUKUN = Manifest.DEF.Sukun;
    private static readonly string SHADDA = Manifest.DEF.Shadda;
    private static readonly HashSet<string> R_VOWEL = new(Manifest.DEF.Roman.VowelLetters, StringComparer.Ordinal);
    private static readonly IReadOnlyDictionary<string, string> R_LONG = Manifest.DEF.Roman.Long;
    private static readonly IReadOnlyDictionary<string, string> R_SHORT = Manifest.DEF.Roman.Short;
    private static readonly IReadOnlyDictionary<string, string> R_CONS = Manifest.DEF.Roman.Consonants;
    private static readonly IReadOnlyDictionary<string, string> RETRO = Manifest.DEF.Roman.Retroflex;
    private static readonly IReadOnlyDictionary<string, string> POSTALV = Manifest.DEF.Roman.Postalveolar;

    private const string MACRON = "\u0304";
    private const string HACEK = "\u030C";
    private const string DOTBELOW = "\u0323";

    private static readonly JsRe ZWNJ_TATWEEL = JsRegex.Compile("[\u200C\u0640]", "gu");
    private static readonly JsRe SHADDA_AFTER_VOWEL = JsRegex.Compile("([\u064E\u064F\u0650])\u0651", "gu");
    /** ⚠ Must carry the NFC precomposes ṇṣḷ of every dot-below letter the retroflex table reaches —
     *  the normalizer composes s+̣→ṣ and the like before the tokenizer runs, and a precomposed form
     *  missing here routes to the Arabic g2p, which deletes it. See the TS note on HAS_LATIN. */
    private static readonly JsRe HAS_LATIN = JsRegex.Compile("[a-zāēīōūšžčǰṭḍṛġṇṣḷ]", "iu");

    /** The Roman half's own inventory. The nativiser is scoped to this half — see the TS note on what
     *  applying it to the Arabic half deleted. Carries the same ṇṣḷ precomposes as HAS_LATIN, or the
     *  nativiser would fold ṣ to bare s and strip the dot the retroflex read depends on. */
    private const string NATIVE_CLASS = @"[a-zāēīōūšžčǰṭḍṛġṇṣḷ\u030C]";
    public static readonly Func<string, string> Nat = HostWord.MakeNativiser(NATIVE_CLASS, "iu");

    private static Dictionary<string, string>? _lexAr;
    private static Dictionary<string, string>? _lexRo;

    /** The cross-script lexicon (arabic <TAB> roman <TAB> ipa), keyed by BOTH spellings → full-voweled IPA.
     *  ⚠ #1068: each arabic key is also aliased to its NATIVISED spelling — the alef-madda ⟨آ⟩ folds to
     *  bare ⟨ا⟩, so the headword the dictionary writes could never be matched from Text(). */
    public static (Dictionary<string, string> Ar, Dictionary<string, string> Ro) Lexicon()
    {
        if (_lexAr is null)
        {
            // LoadTsvMap gives arabic → "roman\tipa"; split into the two views.
            var raw = LoadTsv.LoadTsvMap<string>("languages/balochi", "balochi-lexicon.tsv", (v, _) => v,
                fold: k => Nat(k));
            var ar = new Dictionary<string, string>(StringComparer.Ordinal);
            var ro = new Dictionary<string, string>(StringComparer.Ordinal);
            foreach (var (key, rest) in raw)
            {
                var tab = rest.IndexOf('\t');
                if (tab < 0) continue;
                var roman = rest[..tab];
                var ipa = rest[(tab + 1)..];
                ar[key] = ipa;
                ro[roman.Normalize(NormalizationForm.FormC)] = ipa;
            }
            _lexAr = ar;
            _lexRo = ro;
        }
        return (_lexAr, _lexRo!);
    }

    /** One Balochi word in the Arabic script → skeleton IPA (و→uː, ی→iː defaulted).
     *  ⚠ SHADDA BEFORE ITS VOWEL MARK: the canonical Unicode order is the other way round, so ⟨لُّ⟩
     *  arrives as base+damma+shadda and the pair is rewritten before the scan.
     *  ⚠ A HARAKA ON THE WORD-INITIAL ALIF REPLACES IT: that alif is a SEAT with no sound of its own. */
    public static string PhonemizeArabic(string word)
    {
        var w = Js.CodePoints(
            SHADDA_AFTER_VOWEL.Replace(ZWNJ_TATWEEL.Replace(word, ""), m => "\u0651" + m.Groups[1].Value));
        var toks = new List<string>();
        for (var i = 0; i < w.Count; i++)
        {
            var c = w[i];
            var prev = i > 0 ? w[i - 1] : "";
            var nxt = i + 1 < w.Count ? w[i + 1] : "";
            if (HARAKAT.TryGetValue(c, out var hk))
            {
                // ⟨ـُو⟩ → uː and ⟨ـِی⟩ → iː: the mark disambiguates the mater, which is then consumed.
                if (hk == "u" && nxt == "و") { toks.Add("uː"); i++; }
                else if (hk == "i" && (nxt == "ی" || nxt == "ى")) { toks.Add("iː"); i++; }
                else toks.Add(hk);
                continue;
            }
            // The shadda geminates the consonant it now precedes. Guarded against a doubled length mark.
            if (c == SHADDA)
            {
                if (toks.Count > 0 && !toks[^1].EndsWith("ː", StringComparison.Ordinal)) toks[^1] += "ː";
                continue;
            }
            if (c == SUKUN) continue; // explicit "no vowel here"
            if (CONS.TryGetValue(c, out var cons)) { toks.Add(cons); continue; }
            if (VOW.TryGetValue(c, out var vow))
            {
                if (i == 0 && (c == "ا" || c == "آ") && HARAKAT.ContainsKey(nxt)) continue;
                toks.Add(vow);
                continue;
            }
            if (c == "ع" || c == "ئ" || c == "ء") continue;
            if (c == "ں") { toks.Add("\u0303"); continue; } // nasalization
            var glide = i == 0 || VOWEL_LETTERS.Contains(prev) || VOWEL_LETTERS.Contains(nxt);
            if (c == "و") toks.Add(glide ? "w" : "uː");
            else if (c == "ی" || c == "ى") toks.Add(glide ? "j" : "iː");
        }
        return string.Concat(toks);
    }

    /** One Balochi word in the Roman orthography → full IPA. Macron→long vowel, háček→postalveolar,
     *  dot-below→retroflex (NFD unifies precomposed and combining forms). */
    public static string PhonemizeRoman(string word)
    {
        var a = Js.CodePoints(Js.Normalize(Js.ToLowerCase(word), NormalizationForm.FormD));
        var outp = new List<string>();
        for (var i = 0; i < a.Count; i++)
        {
            var ch = a[i];
            if (ch == MACRON || ch == HACEK || ch == DOTBELOW) continue;
            var nxt = i + 1 < a.Count ? a[i + 1] : "";
            var mac = nxt == MACRON;
            var hac = nxt == HACEK;
            var dot = nxt == DOTBELOW;
            if (R_VOWEL.Contains(ch))
            {
                outp.Add(mac
                    ? (R_LONG.TryGetValue(ch, out var l) ? l : "")
                    : (R_SHORT.TryGetValue(ch, out var s) ? s : ""));
            }
            else if (R_CONS.TryGetValue(ch, out var baseCons))
            {
                var c = hac ? (POSTALV.TryGetValue(ch, out var p) ? p : baseCons) : baseCons;
                if (dot) c = RETRO.TryGetValue(c, out var r1) ? r1 : (RETRO.TryGetValue(ch, out var r2) ? r2 : c);
                outp.Add(c);
            }
        }
        return string.Concat(outp);
    }

    /** One Balochi word → canonical IPA. Script auto-detected; the cross-script lexicon (full vowels) is
     *  tried first, then the per-script g2p (Roman = full vowels; Arabic = consonant + long-vowel
     *  skeleton). ⚠ THE NATIVISER IS APPLIED TO THE ROMAN HALF ONLY — see the TS note. */
    public static string PhonemizeWord(string word)
    {
        var (ar, ro) = Lexicon();
        if (HAS_LATIN.IsMatch(word))
        {
            word = Nat(word);
            // ⚠ `Js.Normalize`, NOT `string.Normalize` (#1199, reached via #1227): .NET throws on an
            // UNPAIRED surrogate where JS composes around it. Line 70's call above is on LEXICON keys,
            // which cannot carry one; this one is on the caller's WORD, which can.
            var key = Js.Normalize(Js.ToLowerCase(word), NormalizationForm.FormC);
            return ro.TryGetValue(key, out var hit) ? hit : PhonemizeRoman(word);
        }
        return ar.TryGetValue(word, out var hit2) ? hit2 : PhonemizeArabic(word);
    }

    /** A run of ASCII digits → the spoken Balochi cardinal in canonical IPA.
     *  ⚠ Above 2^53 the float has lost the low digits, so composing is refused and the reading is a
     *  digit string. The enclitic wrapper is kept for the fallback too: it only fires on the connective
     *  marker the composer appends, so a lone digit never picks one up. */
    private static string Number(string digits)
    {
        var n = Js.Number(digits);
        if (!(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d))
            return Core.Numbers.SpellDigits(digits, Manifest.DEF.Numbers, Numbers.EncliticWord(PhonemizeWord, Manifest.DEF.Numbers));
        return Core.Numbers.RenderNumber(n, Manifest.DEF.Numbers, Numbers.EncliticWord(PhonemizeWord, Manifest.DEF.Numbers),
            Numbers.BalochiNumberWords);
    }

    private static readonly JsRe TOKEN = JsRegex.Compile(
        $"([\u0620-\u06FF\u0750-\u077F\u200C]+|{HostWord.LATIN_RUN})|(\\d+)|([\u060C\u061B\u061F\u06D4\u066C.!?…,:])",
        "giu");

    private static readonly Func<string, string> NORMALIZE =
        Normalize.MakeBalochiNormalizer(w => Lexicon().Ar.ContainsKey(w));

    private readonly Func<string, string>? _foreign;
    private BalochiPhonemizer(Func<string, string>? foreign = null) => _foreign = foreign;

    public string Text(string rawInput) =>
        Clauses.AssembleClauses(NORMALIZE(rawInput), TOKEN, (m, sink) =>
        {
            if (m.Groups[1].Success && m.Groups[1].Value.Length > 0)
                sink.Emit(PhonemizeWord(m.Groups[1].Value));
            else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
                sink.Emit(Number(m.Groups[2].Value));
            else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
            {
                var mk = CLAUSE_MARK.GetValueOrDefault(m.Groups[3].Value);
                if (!string.IsNullOrEmpty(mk)) sink.Pause(mk);
            }
        });

    /** Build the Balochi (Southern) phonemizer — cross-script (Arabic + Roman), lexicon-composed. */
    public static BalochiPhonemizer CreateBalochi(Func<string, string>? foreign = null) => new(foreign);

    internal static void RegisterSelf() =>
        Registry.Register("balochi", () => CreateBalochi(Registry.ReadAsEnglish));
}
