/**
 * Native Pashto / پښتو (ps) phonemizer — Perso-Arabic (extended) abjad → canonical IPA.
 * Ported from src/languages/pashto/pashto.ts — see that file for the corpus evidence.
 */
using System.Text;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Pashto;

public sealed class PashtoPhonemizer : ILanguage
{
    private const string Dir = "languages/pashto";
    private static PashtoDef DEF => Manifest.DEF;
    private static IReadOnlyDictionary<string, string> C => DEF.Consonants;
    private static IReadOnlyDictionary<string, string> HARAKAT => DEF.Harakat;
    private static string INH => DEF.InherentVowel;
    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => DEF.ClausePunctuation;

    private const string ALIF = "ا", ALIF_MADDA = "آ", WAW = "و", YA = "ی", YA_AR = "ي",
        YA_E = "ې", YA_FEM = "ۍ", YA_HAMZA = "ئ", HE = "ه", HE_DO = "ھ";
    private static bool IsVowelCarrier(string c) =>
        c == ALIF || c == WAW || c == YA || c == YA_AR || c == YA_E || c == YA_FEM || c == YA_HAMZA;
    private static readonly JsRe ENDS_IN_VOWEL = JsRegex.Compile("[aeiouɑə]$", "u");
    private static bool EndsInVowel(string outp) => ENDS_IN_VOWEL.IsMatch(outp);

    /** A vowel-carrier letter standing after a consonant → its long/mid vowel. `final` is what separates
     *  ⟨ی⟩ (U+06CC, the -ay diphthong) from ⟨ي⟩ (U+064A, plain /i/) word-finally; Persian/Urdu do not make
     *  that distinction, so an editor porting from those engines will be tempted to drop the flag. */
    private static string LongVowel(string ch, bool final = false)
    {
        if (ch == ALIF || ch == ALIF_MADDA) return "ɑ";
        if (ch == WAW) return "o";
        if (ch == YA) return final ? "əi" : "i";
        if (ch == YA_AR) return "i";
        if (ch == YA_E) return "e";
        if (ch == YA_FEM || ch == YA_HAMZA) return "əi";
        return "";
    }

    /**
     * The Arabic ADVERBIAL ENDING ⟨ـاً⟩ — the tanwīn's alif is a SEAT, not a long vowel, so word-finally it
     * is dropped and the mark falls back onto its own consonant, where the harakat table reads it as /an/.
     * Word-final only: a medial ⟨اً⟩ is not this ending.
     */
    private static readonly JsRe TANWIN_ALIF = JsRegex.Compile("[اىیي]([ًٌٍ])$", "u");

    /**
     * ⚠ SHADDA BEFORE ITS VOWEL MARK — AND WITHOUT THIS, A GEMINATE THAT CARRIES A VOWEL IS NOT A GEMINATE.
     * The scan in `G2p` reads the marks after a consonant in a FIXED order, shadda then one haraka, but NFC
     * orders them the other way (vowel mark ccc 30, shadda ccc 33), so ⟨زَّ⟩ arrives as ⟨ز⟩+fatḥa+shadda and
     * the shadda test falls through. Re-ordering the pair is the whole fix, and is a no-op if already ordered.
     */
    private static readonly JsRe SHADDA_AFTER_VOWEL = JsRegex.Compile("([ً-ِٰٗ])ّ", "gu");

    /** Pashto word → canonical IPA (consonant + written-vowel skeleton + default [ə]). */
    private static string G2p(string word)
    {
        var s = Js.CodePoints(SHADDA_AFTER_VOWEL.Replace(
            TANWIN_ALIF.Replace(word.Normalize(NormalizationForm.FormC), "$1"), "ّ$1"));
        var n = s.Count;
        var outp = "";
        var i = 0;
        string At(int k) => k >= 0 && k < n ? s[k] : "\u0000";
        bool Has(int k) => k >= 0 && k < n;

        if (n > 0 && s[0] == ALIF_MADDA)
        {
            outp += "ɑ";
            i = 1;
        }
        else if (n > 0 && s[0] == ALIF)
        {
            if (At(1) == WAW) { outp += "o"; i = 2; }
            else if (At(1) == YA || At(1) == YA_AR) { outp += "i"; i = 2; }
            else if (At(1) == YA_E) { outp += "e"; i = 2; }
            else { outp += "a"; i = 1; }
        }

        while (i < n)
        {
            var ch = s[i];
            if (ch == HE || ch == HE_DO)
            {
                if (i == n - 1 && outp.Length > 0 && !EndsInVowel(outp)) outp += "ə";
                else
                {
                    outp += "h";
                    if (Has(i + 1))
                    {
                        var nx = s[i + 1];
                        if (!IsVowelCarrier(nx) && !HARAKAT.ContainsKey(nx)
                            && nx != DEF.Sukun && !(nx == HE || nx == HE_DO) && C.ContainsKey(nx))
                            outp += INH;
                    }
                }
                i++;
                continue;
            }
            if (IsVowelCarrier(ch))
            {
                if ((ch == WAW || ch == YA || ch == YA_AR) && At(i + 1) == DEF.Sukun)
                {
                    outp += ch == WAW ? "w" : "j";
                    if (Has(i + 2))
                    {
                        var nx2 = s[i + 2];
                        if (C.ContainsKey(nx2) && !IsVowelCarrier(nx2) && nx2 != HE && nx2 != HE_DO
                            && At(i + 3) != DEF.Sukun)
                            outp += INH;
                    }
                    i += 2;
                    continue;
                }
                var glideable = ch == WAW || ch == YA || ch == YA_AR;
                var glideBeforeFinalHe = At(i + 1) == HE && i + 2 == n && glideable;
                var glideBeforeAlif = glideable && (At(i + 1) == ALIF || At(i + 1) == ALIF_MADDA);
                var offglideAfterVowel = EndsInVowel(outp) && ch != ALIF && ch != ALIF_MADDA;
                if (glideBeforeAlif || glideBeforeFinalHe || offglideAfterVowel)
                {
                    var pv = outp.Length > 0 ? outp[^1..] : null;
                    var homorganic =
                        (ch == WAW && (pv == "u" || pv == "ʊ")) || (ch != WAW && (pv == "i" || pv == "ɪ"));
                    var emittedGlide = false;
                    if (homorganic && !glideBeforeAlif) outp += "ː";
                    else if (i == n - 1 && EndsInVowel(outp)) outp += ch == WAW ? "ʊ" : "ɪ";
                    else { outp += ch == WAW ? "w" : "j"; emittedGlide = true; }
                    if (emittedGlide && Has(i + 1))
                    {
                        var nx = s[i + 1];
                        if (C.ContainsKey(nx) && !IsVowelCarrier(nx) && nx != HE && nx != HE_DO
                            && At(i + 2) != DEF.Sukun)
                            outp += INH;
                    }
                }
                else outp += LongVowel(ch, i == n - 1);
                i++;
                continue;
            }
            if (C.TryGetValue(ch, out var cph))
            {
                outp += cph;
                i++;
                if (At(i) == DEF.Shadda) { outp += "ː"; i++; }
                var hk = Has(i) && HARAKAT.TryGetValue(s[i], out var hv) ? hv : null;
                if (At(i) == DEF.Sukun) i++;
                else if (hk is not null) { outp += hk; i++; }
                else
                {
                    if (Has(i))
                    {
                        var next = s[i];
                        var finalHe = (next == HE || next == HE_DO) && i == n - 1;
                        if (!IsVowelCarrier(next) && !finalHe) outp += INH;
                    }
                }
                continue;
            }
            i++; // unknown / diacritic → skip
        }
        if (outp.Length > 0 && !ANY_VOWEL.IsMatch(outp))
        {
            var letters = s.Where(c => C.ContainsKey(c) || c == HE || c == HE_DO).ToList();
            if (letters.Count == 1) outp += INH;
        }
        return outp.Normalize(NormalizationForm.FormC);
    }

    private static readonly JsRe ANY_VOWEL = JsRegex.Compile("[aeiouɑɐɒɔəɛɪʊʌeo]", "u");
    private static readonly JsRe VOWEL_G = JsRegex.Compile("[aeiouɑə]", "g");
    private static readonly JsRe LONG_VOWELS = JsRegex.Compile("[ɑoue]|i(?!̯)", "gu");
    private static readonly JsRe NASAL_BEFORE_VELAR = JsRegex.Compile("n(?=[kɡq])", "gu");

    // COVERAGE layer: mined undiacritized skeletons are vocalized before g2p. Loaded LAZILY on purpose —
    // the registry constructs every language eagerly, so an eager load would read this TSV on every startup.
    private static Dictionary<string, string>? LEXICON;
    private static readonly object GATE = new();
    public static IReadOnlyDictionary<string, string> HarakatLexicon()
    {
        lock (GATE) return LEXICON ??= Core.HarakatLexicon.LoadHarakatLexicon(Dir);
    }

    /** Lexicon-FREE core: skeleton g2p + default-schwa deletion + stress. Used by the number path and the
     *  mining tool, which must NOT consult the content lexicon (number words and mining candidates collide
     *  with content homographs). */
    public static string PhonemizeWordCore(string word)
    {
        var ipa = G2p(word);
        if (ipa == "") return "";
        ipa = Schwa.DeleteMedialSchwa(ipa, "ə");
        // ن → [ŋ] before a velar, AFTER schwa deletion — the epenthetic ə has to be gone before the nasal is
        // adjacent to the velar for the assimilation to see it.
        ipa = NASAL_BEFORE_VELAR.Replace(ipa, "ŋ");
        var longs = LONG_VOWELS.Matches(ipa);
        var marks = longs.Count > 0 ? longs : VOWEL_G.Matches(ipa);
        if (marks.Count > 0)
        {
            var at = marks[^1].Index;
            ipa = ipa[..at] + "ˈ" + ipa[at..];
        }
        return ipa.Normalize(NormalizationForm.FormC);
    }

    /** One Pashto word → canonical IPA (coverage-lexicon restore + the lexicon-free core). */
    public static string PhonemizeWord(string word) =>
        PhonemizeWordCore(Core.HarakatLexicon.RestoreHarakat(word, HarakatLexicon()));

    private static readonly IReadOnlyDictionary<string, string> EASTERN_DIGITS = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["۰"] = "0", ["۱"] = "1", ["۲"] = "2", ["۳"] = "3", ["۴"] = "4",
        ["۵"] = "5", ["۶"] = "6", ["۷"] = "7", ["۸"] = "8", ["۹"] = "9",
    };
    private static readonly string DIGIT_CLASS = "0-9" + string.Concat(EASTERN_DIGITS.Keys);
    private const string PERSO_ARABIC_WORD = "ء-ٟٮ-ۿ";
    private static string ToAscii(string d) =>
        string.Concat(Js.CodePoints(d).Select(c => EASTERN_DIGITS.TryGetValue(c, out var v) ? v : c));
    private static PashtoNumbersDef NUM => DEF.Numbers;

    /** Non-negative integer → Pashto numeral spelling (decimal; ⟨و⟩ joins the magnitude groups). */
    public static string NumberToText(double nn)
    {
        if (nn < 0) return "";
        if (nn < 10) return NUM.Units[(int)nn];
        if (nn < 20) return NUM.Teens[(int)nn - 10]; // irregular fused forms — NOT unit+لس
        if (nn < 100)
        {
            double t = Math.Floor(nn / 10) * 10, u = nn % 10;
            if (u == 0) return NUM.Tens[Js.NumberToString(t)];
            return NUM.Compound.TryGetValue(Js.NumberToString(nn), out var fused)
                ? fused
                : $"{NUM.Units[(int)u]} {NUM.Tens[Js.NumberToString(t)]}"; // units-first, no connector
        }
        if (nn < 1000)
        {
            double h = Math.Floor(nn / 100), r = nn % 100;
            return $"{(h > 1 ? NUM.Units[(int)h] + " " : "")}{NUM.Hundred}{(r != 0 ? $" {NUM.And} {NumberToText(r)}" : "")}";
        }
        foreach (var (value, scale) in MAGNITUDES)
        {
            if (nn >= value)
            {
                double q = Math.Floor(nn / value), r = nn % value;
                return $"{(q > 1 ? NumberToText(q) + " " : "")}{scale}{(r != 0 ? $" {NUM.And} {NumberToText(r)}" : "")}";
            }
        }
        return Js.NumberToString(nn);
    }

    /** Magnitude words, largest first (the descending scan `numberToText` walks). */
    private static (double Value, string Scale)[] MAGNITUDES => new[]
    {
        (1_000_000_000d, NUM.Billion), (1_000_000d, NUM.Million), (1000d, NUM.Thousand),
    };

    private static string Number(string digits)
    {
        var nn = Js.Number(ToAscii(digits));
        if (!(double.IsInteger(nn) && Math.Abs(nn) <= 9007199254740991d) || nn < 0 || nn >= 1e12)
            return string.Join(" ", ToAscii(digits)
                .Where(c => c >= '0' && c <= '9')
                .Select(c => NumberToText(Js.Number(c.ToString())))
                .Select(PhonemizeWordCore));
        return string.Join(" ", NumberToText(nn).Split(' ').Select(PhonemizeWordCore)); // numbers bypass the content lexicon
    }

    // The foreign arm is `LATIN_RUN` — all of Latin plus marks, deliberately not `[A-Za-z]+`, which ends the
    // token at a diacritic and leaves that letter to be read as an English letter name.
    private static readonly JsRe TOKEN = JsRegex.Compile(
        $"([{PERSO_ARABIC_WORD}]+)|({HostWord.LATIN_RUN})|([{DIGIT_CLASS}]+)|([۔؟،؛.?!,;:])", "gu");

    /** ⚠ THE NORMALIZER IS A FACTORY AND TAKES `NumberToText`, WHICH IS NOT DECORATION. Pashto's ordinal is a
     *  gender/case suffix written after the digits, and a suffix cannot agree with a digit run, so that rule
     *  must spell the operand itself. Injecting the speller keeps the dependency one-way: the engine calls the
     *  normalizer, never the reverse. */
    private static readonly Func<string, string> NormalizePashto = Normalize.MakePashtoNormalizer(NumberToText);

    private readonly Func<string, string>? foreign;
    public PashtoPhonemizer(Func<string, string>? foreign = null) { this.foreign = foreign; }

    public string Text(string input)
    {
        // NORMALIZATION runs first and must see the text BEFORE tokenization: most of what it repairs (a
        // grouping `،`, a decimal `.`, a clock `:`) is a character TOKEN would otherwise hand to
        // `clausePunctuation` as a pause. Everything it emits is then read by the ordinary paths below.
        return Clauses.AssembleClauses(NormalizePashto(input), TOKEN, (m, sink) =>
        {
            if (m.Groups[1].Success && m.Groups[1].Value.Length > 0) sink.Emit(PhonemizeWord(m.Groups[1].Value));
            else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
                sink.Emit(foreign is not null ? foreign(m.Groups[2].Value) : "");
            else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0) sink.Emit(Number(m.Groups[3].Value));
            else if (m.Groups[4].Success && m.Groups[4].Value.Length > 0)
            {
                if (CLAUSE_MARK.TryGetValue(m.Groups[4].Value, out var mk) && mk.Length > 0) sink.Pause(mk);
            }
        });
    }

    /** Build the Pashto phonemizer. `foreign` handles embedded Latin runs. */
    public static ILanguage CreatePashto(Func<string, string>? foreign = null) => new PashtoPhonemizer(foreign);

    internal static void RegisterSelf() =>
        Registry.Register("pashto", () => CreatePashto(latin => Registry.ReadAsEnglish(latin)));
}
