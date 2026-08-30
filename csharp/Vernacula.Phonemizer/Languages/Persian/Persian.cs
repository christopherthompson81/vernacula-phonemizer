/**
 * Native Persian / Farsi (fa) phonemizer — Perso-Arabic abjad → canonical IPA.
 * Ported from src/languages/persian/persian.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Persian;

public sealed class PersianDef
{
    public IReadOnlyDictionary<string, string> Consonants { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Harakat { get; init; } = new Dictionary<string, string>();
    public string Sukun { get; init; } = "";
    public string Shadda { get; init; } = "";
    public string InherentVowel { get; init; } = "";
    public FaNumbersDef Numbers { get; init; } = new();
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
}

public static class PersianPhonemizer
{
    public static readonly PersianDef DEF = LoadManifest.Load<PersianDef>("languages/persian", "persian.jsonc");
    private static IReadOnlyDictionary<string, string> C => DEF.Consonants;
    private static IReadOnlyDictionary<string, string> HARAKAT => DEF.Harakat;
    private static string INH => DEF.InherentVowel;
    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => DEF.ClausePunctuation;
    private const string ALIF = "ا";
    private const string ALIF_MADDA = "آ";
    private const string WAW = "و";
    private const string YA = "ی";
    private const string YA_AR = "ي";
    private const string HE = "ه";

    private static bool IsV(string c) => c == ALIF || c == WAW || c == YA || c == YA_AR;

    /**
     * WRITTEN-VOWEL GUARD. The deletion heuristics below exist to undo the DEFAULT [a] this g2p inserts where
     * the abjad wrote nothing, so an [a] the text actually WROTE with a fatha is tagged with this mark, and
     * the tag is removed once both heuristics have run.
     * ⚠ IT MUST BE A COMBINING MARK, not a spacing sentinel: Core/Schwa.cs decides by the units on BOTH sides
     * of a candidate, and a spacing guard becomes a unit of its own and breaks one side or the other. U+0332
     * is absorbed into the vowel's unit, is not an IPA symbol this engine emits, and composes with nothing
     * under NFC.
     * ⚠ ESCAPED, not literal: a bare combining mark in source is invisible and does not survive every
     * editor/heredoc round-trip.
     */
    private const string WRITTEN = "\u0332";
    private static readonly JsRe ENDS_VOWEL = JsRegex.Compile($"[aeiouɒ]{WRITTEN}?ː?$", "u");
    private static bool EndsInVowel(string @out) => ENDS_VOWEL.IsMatch(@out);

    /** A written harakat's IPA, with the deletion guard attached when it is the same segment as the DEFAULT vowel
     *  (only that one is a deletion target, so only that one needs tagging). */
    private static string? HarakatIpa(string ch)
    {
        var hk = ch != "" ? HARAKAT.GetValueOrDefault(ch) : null;
        return hk == INH ? hk + WRITTEN : hk;
    }

    /** A long-vowel letter standing after a consonant → its long vowel. */
    private static string? LongVowel(string ch)
    {
        if (ch == ALIF || ch == ALIF_MADDA) return "aː";
        if (ch == WAW) return "uː";
        if (ch == YA || ch == YA_AR) return "iː";
        return null;
    }

    /** Persian word → canonical IPA (consonant + long-vowel skeleton + default short vowel). */
    private static string G2p(string word)
    {
        var s = Js.CodePoints(Js.Normalize(word, System.Text.NormalizationForm.FormC));
        var n = s.Count;
        var @out = "";
        var i = 0;
        string At(int k) => k >= 0 && k < n ? s[k] : "";

        if (At(0) == ALIF_MADDA) { @out += "ʔaː"; i = 1; }
        else if (At(0) == ALIF)
        {
            if (At(1) == WAW) { @out += "ʔuː"; i = 2; }
            else if (At(1) == YA || At(1) == YA_AR) { @out += "ʔiː"; i = 2; }
            else { @out += "ʔ" + INH; i = 1; }
        }

        while (i < n)
        {
            var ch = s[i];
            if (ch == HE)
            {
                if (i == n - 1 && @out != "" && !EndsInVowel(@out)) @out += "e";
                else @out += "h";
                i++;
                var hk0 = HarakatIpa(At(i));
                if (hk0 is not null) { @out += hk0; i++; }
                continue;
            }
            if (IsV(ch))
            {
                @out += EndsInVowel(@out)
                    ? (ch == WAW ? "v" : "j")
                    : (LongVowel(ch) ?? "");
                i++;
                continue;
            }
            if (C.TryGetValue(ch, out var ph))
            {
                i++;
                if (ph == "x" && At(i) == WAW && At(i + 1) == ALIF)
                {
                    @out += "xʷaː";
                    i += 2;
                    continue;
                }
                @out += ph;
                if (At(i) == DEF.Shadda) { @out += "ː"; i++; }
                var hk = HarakatIpa(At(i));
                if (At(i) == DEF.Sukun) i++;
                else if (hk is not null) { @out += hk; i++; }
                else
                {
                    var glideNext = (At(i) == YA || At(i) == WAW) && LongVowel(At(i + 1)) is not null;
                    var lv = glideNext ? null : LongVowel(At(i));
                    if (lv is not null) { @out += lv; i++; }
                    else if (glideNext) { @out += At(i) == WAW ? "v" : "j"; i++; }
                    else if (i < n && !(At(i) == HE && i == n - 1))
                        @out += INH; // the abjad's omitted SHORT vowel: default [a]
                }
                continue;
            }
            i++; // unknown / diacritic → skip
        }
        return @out.Normalize(System.Text.NormalizationForm.FormC);
    }

    private static readonly JsRe VOWEL_G = JsRegex.Compile("[aeiouɒ]", "g");
    private static readonly JsRe FINAL_CLUSTER =
        JsRegex.Compile($"([aeiouɒ]ː?[^aeiouɒː ]*)a(?![ː{WRITTEN}])(?=[^aeiouɒː ]+$)", "gu");
    private static readonly JsRe WRITTEN_G = JsRegex.Compile(WRITTEN, "gu");

    // COVERAGE layer: a mined skeleton is vocalized here before g2p, so the g2p reads the real e/o/u rather
    // than a default schwa. Loaded LAZILY — the registry constructs every rider eagerly, and the ~3k-line TSV
    // should only be read on first Persian use.
    private static Dictionary<string, string>? LEXICON;
    public static IReadOnlyDictionary<string, string> HarakatLex() =>
        LEXICON ??= HarakatLexicon.LoadHarakatLexicon("languages/persian");

    /**
     * Lexicon-FREE core: g2p + default-short-vowel deletion + final stress. Used by the number path and the
     * mining tool, which must NOT consult the content lexicon (number words and mining candidates collide
     * with homographs).
     */
    public static string PhonemizeWordCore(string word)
    {
        var ipa = G2p(word);
        if (string.IsNullOrEmpty(ipa)) return "";
        ipa = Schwa.DeleteMedialSchwa(ipa, "a");
        // …then the SAME rule again for a WRITTEN fatha: the guard mark makes it a distinct unit text, which
        // the pass above cannot see. Deliberate, so the medial behaviour stays bit-identical and only the
        // word-final cluster rule below treats a written vowel differently.
        ipa = Schwa.DeleteMedialSchwa(ipa, "a" + WRITTEN);
        // Persian ALLOWS word-final consonant clusters, so a default [a] before a coda run is spurious and is
        // deleted when a vowel precedes (unlike Urdu, which retains it). The `(?![ː WRITTEN])` guard is what
        // keeps this off a fatha the text actually wrote (هَشت loses it, سیصَد keeps it).
        ipa = FINAL_CLUSTER.Replace(ipa, "$1");
        ipa = WRITTEN_G.Replace(ipa, ""); // guard removed once both deletion heuristics have run
        var vowels = VOWEL_G.Matches(ipa);
        if (vowels.Count > 0)
        {
            var last = vowels[^1].Index;
            ipa = ipa[..last] + "ˈ" + ipa[last..];
        }
        return ipa.Normalize(System.Text.NormalizationForm.FormC);
    }

    /** One Persian word → canonical IPA (coverage-lexicon restore + the lexicon-free core). */
    public static string PhonemizeWord(string word) =>
        PhonemizeWordCore(HarakatLexicon.RestoreHarakat(word, HarakatLex()));

    private static readonly IReadOnlyDictionary<string, string> EASTERN_DIGITS = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["۰"] = "0", ["۱"] = "1", ["۲"] = "2", ["۳"] = "3", ["۴"] = "4",
        ["۵"] = "5", ["۶"] = "6", ["۷"] = "7", ["۸"] = "8", ["۹"] = "9",
    };
    private static readonly string DIGIT_CLASS = "0-9" + string.Concat(EASTERN_DIGITS.Keys);
    private const string PERSO_ARABIC_WORD = "ء-ٟٮ-ۓە-ۿ";

    private static string ToAscii(string d) =>
        string.Concat(Js.CodePoints(d).Select(c => EASTERN_DIGITS.GetValueOrDefault(c, c)));

    private static string Number(string digits)
    {
        var nn = Js.Number(ToAscii(digits));
        // ⚠ Above 2^53 the float has already lost the low digits, so the compositor must not be asked for a
        // quantity — but returning the raw digit string leaks ASCII into the IPA. Read it out digit-at-a-time
        // through this engine's own number words instead.
        if (!(double.IsInteger(nn) && Math.Abs(nn) <= 9007199254740991d))
            return Core.Numbers.SpellDigits(ToAscii(digits), DEF.Numbers, Numbers.EncliticWord(PhonemizeWordCore, DEF.Numbers));
        return Core.Numbers.RenderNumber(nn, DEF.Numbers, Numbers.EncliticWord(PhonemizeWordCore, DEF.Numbers), Numbers.PersianNumberWords);
    }

    private static readonly JsRe TOKEN = JsRegex.Compile(
        $"([{PERSO_ARABIC_WORD}]+)|({HostWord.LATIN_RUN})|([{DIGIT_CLASS}]+)|([۔؟،؛.?!,;:])", "gu");

    // Persian text frequently uses ARABIC-script letter variants (ي، ك، ى، ة) where Farsi has ی/ک/ه. ⚠ NFC
    // does NOT unify them — they are distinct base letters, not canonical-equivalent — so the lexicon and the
    // neural models, both keyed on Farsi orthography, garble the word unless they are folded here.
    private static readonly IReadOnlyDictionary<string, string> FA_ORTHO = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["ي"] = "ی", ["ك"] = "ک", ["ى"] = "ی", ["ة"] = "ه",
    };
    private static readonly JsRe FA_ORTHO_RE = JsRegex.Compile("[يكىة]", "gu");

    public static string NormalizePersianOrthography(string text) =>
        // NFC first, so decomposed input (NFD آ = bare alef + combining madda) composes to the single code
        // point the tagger vocab and the آ→aː rule key on; then fold the Arabic variants.
        FA_ORTHO_RE.Replace(Js.Normalize(text, System.Text.NormalizationForm.FormC), c => FA_ORTHO.GetValueOrDefault(c.Value, c.Value));

    /**
     * TEXT NORMALIZATION — the pre-tokenizer pass. Public because the NEURAL entry points do their own
     * tokenization and must see the same rewritten text as the sync path. Idempotent, so the neural path
     * re-entering the sync path for a digit run costs nothing.
     */
    public static readonly Func<string, string> NormalizePersianText = Normalize.MakePersianNormalizer(DEF.Numbers);

    private sealed class Engine : ILanguage
    {
        private readonly Func<string, string>? _foreign;
        internal Engine(Func<string, string>? foreign = null) => _foreign = foreign;

        public string Text(string input) =>
            Clauses.AssembleClauses(NormalizePersianText(NormalizePersianOrthography(input)), TOKEN, (m, sink) =>
            {
                if (m.Groups[1].Success && m.Groups[1].Value.Length > 0) sink.Emit(PhonemizeWord(m.Groups[1].Value));
                else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0) sink.Emit(_foreign is not null ? _foreign(m.Groups[2].Value) : "");
                else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0) sink.Emit(Number(m.Groups[3].Value));
                else if (m.Groups[4].Success && m.Groups[4].Value.Length > 0)
                {
                    var mk = CLAUSE_MARK.GetValueOrDefault(m.Groups[4].Value);
                    if (mk is not null) sink.Pause(mk);
                }
            });
    }

    /** Build the Persian phonemizer. `foreign` handles embedded Latin runs. */
    public static ILanguage CreatePersian(Func<string, string>? foreign = null) => new Engine(foreign);

    internal static void RegisterSelf()
    {
        Registry.Register("persian", () => CreatePersian(Registry.ReadAsEnglish));
        RiderNeural.RegisterRider("fa", HarakatLex);
    }
}
