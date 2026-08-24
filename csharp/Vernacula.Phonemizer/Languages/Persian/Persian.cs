/**
 * Native Persian / Farsi (fa) phonemizer — Perso-Arabic abjad → canonical IPA. Logical order = phonetic order,
 * so RTL is a non-issue (as for Arabic/Urdu). Handles: consonant letters, long vowels written with ا/آ/و/ی,
 * a WORD-INITIAL glottal stop ʔ before a vowel (آب→ʔaːb), the خوا→[xʷaː] labialization, word-final ه → [e]
 * (خانه→xaːne), shadda gemination, short vowels from harakat WHEN present — and, for the usual undiacritized
 * text, a DEFAULT short vowel [a] (the crude stand-in for the deferred short-vowel-restoration subsystem).
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
     * WRITTEN-VOWEL GUARD. The two deletion heuristics below (medial schwa, and the final-cluster rule) exist to undo
     * the DEFAULT [a] this g2p inserts where the abjad wrote nothing. They must not touch an [a] the text actually
     * WROTE with a fatha — but the IPA string carries no such distinction, so a harakat-derived [a] is tagged and the
     * tag is removed once both heuristics have run. Without it the number table itself was damaged: سیصَد (300) came
     * out [sˈiːsd], and likewise پانصَد, نُهصَد and the rest of the fused hundreds — the hundreds digit of every year.
     *
     * IT MUST BE A COMBINING MARK, not a spacing sentinel. core/schwa.ts segments the IPA into units and decides by
     * the units on BOTH sides of a candidate (V·C·a·C·V); a spacing guard becomes a unit of its own and breaks one
     * side or the other — placed after the vowel it blocked the deletion in the preceding syllable (هَشتاد →
     * [haʃataːd]), placed before it blocked the one in the following syllable (پانصَد → [paːnasˈad]). A combining
     * mark is absorbed into the vowel's own unit, so the written vowel still counts as a vowel for its neighbours
     * while its unit text ("a"+mark) no longer equals the schwa the rule deletes. U+0332 is used because it is not
     * an IPA symbol this engine emits and composes with nothing under NFC.
     */
    private const string WRITTEN = "\u0332"; // ⚠ ESCAPED, not literal: a bare combining mark in source is invisible and does not survive every editor/heredoc round-trip. The TS writes it the same way.
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
        var s = Js.CodePoints(word.Normalize(System.Text.NormalizationForm.FormC));
        var n = s.Count;
        var @out = "";
        var i = 0;
        string At(int k) => k >= 0 && k < n ? s[k] : "";

        // Word-initial vowel carrier: آ→ʔaː; ا+و→ʔuː, ا+ی→ʔiː; bare ا → ʔ + default short vowel.
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
            // Word-final ه after a consonant → the [e] vowel (خانه→xaːne); elsewhere it is [h].
            if (ch == HE)
            {
                if (i == n - 1 && @out != "" && !EndsInVowel(@out)) @out += "e";
                else @out += "h";
                i++;
                // ⟨ه⟩ is the only consonant whose branch returns BEFORE the shared harakat consumption below, so a
                // short vowel written after it was silently discarded. That corrupted the DIACRITIZED number table
                // itself — هِزار read [hzˈaːɾ], هَفت [hfˈat], هَشتاد [hʃatˈaːd], i.e. every year from 1000 up.
                // Undiacritized running text is unaffected (nothing to consume) and no lexicon entry writes a
                // harakat after ⟨ه⟩ (0 of 4,132 in lexicon.tsv), so this only ever adds the vowel that was written.
                var hk0 = HarakatIpa(At(i));
                if (hk0 is not null) { @out += hk0; i++; }
                continue;
            }
            // Standalone glide/vowel letters: after a vowel → glide (v/j); after a consonant → long vowel.
            if (IsV(ch))
            {
                @out += EndsInVowel(@out)
                    ? (ch == WAW ? "v" : "j")
                    : (LongVowel(ch) ?? "");
                i++;
                continue;
            }
            // Consonant.
            if (C.TryGetValue(ch, out var ph))
            {
                i++;
                // خوا → [xʷaː]: خ + و (silent, labializes) + ا.
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
                    // ی/و before another vowel letter is a glide; a bare long-vowel letter is the nucleus.
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

    // COVERAGE layer: an undiacritized skeleton whose short vowels we've mined is looked up here and vocalized before
    // g2p, so the g2p reads the real e/o/u instead of a default schwa (see core/harakatLexicon.ts). Loaded LAZILY
    // (registry.ts imports every rider eagerly; the ~3k-line TSV is only read on first Persian use).
    private static Dictionary<string, string>? LEXICON;
    public static IReadOnlyDictionary<string, string> HarakatLex() =>
        LEXICON ??= HarakatLexicon.LoadHarakatLexicon("languages/persian");

    /** Lexicon-FREE core: g2p + default-short-vowel deletion + final stress. Used by the number path and the mining
     *  tool, which must NOT consult the content lexicon (number words / mining candidates collide with homographs). */
    public static string PhonemizeWordCore(string word)
    {
        var ipa = G2p(word);
        if (string.IsNullOrEmpty(ipa)) return "";
        // Persian, like Urdu, drops the over-inserted default vowel in a medial C·a·C cluster (the shared Ohala
        // rule on /a/). The correct e/o quality needs the deferred restoration layer; the STRUCTURE is right.
        ipa = Schwa.DeleteMedialSchwa(ipa, "a");
        // …then the SAME rule again for a WRITTEN fatha. The guard mark makes the written vowel a distinct unit text,
        // so the pass above cannot see it; this pass restores exactly the previous medial behaviour for it. The guard
        // is therefore scoped to the final-cluster rule below — the only one that was demonstrably wrong about it.
        // Deliberate: 5 mined lexicon entries of the shape C-a-ی-ه (تکَیه, گِرَیه, کُلَیه) write a fatha that the medial
        // rule then deletes, and the wikipron referee agrees with the DELETION (takje, not takaje). Whether that
        // fatha should have been mined at all is a lexicon question, not one for this pass to answer, so the medial
        // behaviour is left bit-identical and only the word-final case changes.
        ipa = Schwa.DeleteMedialSchwa(ipa, "a" + WRITTEN);
        // Persian ALLOWS word-final consonant CLUSTERS (mard, duːst) — so a default [a] before a run of coda
        // consonants at word end is spurious; delete it when a vowel precedes (unlike Urdu, which retains it).
        // The `(?![ː WRITTEN])` guard is what keeps it off a fatha the text actually wrote: هَشت [haʃat]→[haʃt] is the
        // inserted vowel and must go, سیصَد [siːsad] is written and must stay (it used to come out [siːsd]).
        ipa = FINAL_CLUSTER.Replace(ipa, "$1");
        ipa = WRITTEN_G.Replace(ipa, ""); // guard removed once both deletion heuristics have run
        // Persian stress is (mostly) word-FINAL: mark the last vowel nucleus.
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
        // ⚠ ABOVE 2^53 THE RAW ASCII DIGITS USED TO LEAK STRAIGHT INTO THE IPA. `isSafeInteger` is right to
        // refuse to COMPOSE — the float has already lost the low digits, so the numeral would be confidently
        // wrong — but the refusal returned the digit string, which no g2p in this fleet reads. Read it out
        // digit-at-a-time through this engine's own number words instead; see core/numbers.ts `spellDigits`
        // for the full account and the cost (above 2^53 the reading is a digit string, not a quantity).
        if (!(double.IsInteger(nn) && Math.Abs(nn) <= 9007199254740991d))
            return Core.Numbers.SpellDigits(ToAscii(digits), DEF.Numbers, Numbers.EncliticWord(PhonemizeWordCore, DEF.Numbers));
        // The DECIMAL IRANIAN compositor (persian/numbers.ts), not the default Indic lakh/crore one — Persian's
        // hundreds are irregular fused words and every group is linked by the enclitic ⟨و⟩ /o/, which `encliticWord`
        // appends to the already-phonemized head word. Numbers bypass the content lexicon (homograph collisions).
        return Core.Numbers.RenderNumber(nn, DEF.Numbers, Numbers.EncliticWord(PhonemizeWordCore, DEF.Numbers), Numbers.PersianNumberWords);
    }

    // The foreign arm is `LATIN_RUN`, ALL of Latin plus marks — not `[A-Za-z]+`, which ended the token at a
    // diacritic and left that letter to be read as an English letter name (`Cañitas` → *ka ˈɛn ˈitas*). This
    // engine ROUTES a foreign word to the injected reader, so widening the class is the whole fix.
    private static readonly JsRe TOKEN = JsRegex.Compile(
        $"([{PERSO_ARABIC_WORD}]+)|({HostWord.LATIN_RUN})|([{DIGIT_CLASS}]+)|([۔؟،؛.?!,;:])", "gu");

    // Real-world Persian text frequently uses ARABIC-script letter variants — Arabic yeh ي (U+064A), Arabic kaf ك
    // (U+0643), alef maksura ى (U+0649), teh marbuta ة (U+0629) — instead of their Farsi forms (ی U+06CC, ک U+06A9).
    // NFC does NOT unify them (distinct base letters, not canonical-equivalent), so the harakat lexicon and the neural
    // tagger — both keyed on Farsi orthography — treat Arabic yeh as unknown and GARBLE the word (کسي→kˈasv vs Farsi
    // کسی→kasˈiː). Fold them to Farsi at every fa text entry. Surfaced by the independent GE2PE referee (1207 Arabic
    // yehs in its test set).
    private static readonly IReadOnlyDictionary<string, string> FA_ORTHO = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["ي"] = "ی", ["ك"] = "ک", ["ى"] = "ی", ["ة"] = "ه",
    };
    private static readonly JsRe FA_ORTHO_RE = JsRegex.Compile("[يكىة]", "gu");

    public static string NormalizePersianOrthography(string text) =>
        // NFC first so decomposed input (e.g. NFD آ = bare alef + combining madda U+0653) composes to the single
        // codepoint the tagger vocab + the آ→aː rule key on — the sync g2p already NFC-normalizes, the neural path must
        // too. Then fold the Arabic-script letter variants to their Farsi forms.
        FA_ORTHO_RE.Replace(text.Normalize(System.Text.NormalizationForm.FormC), c => FA_ORTHO.GetValueOrDefault(c.Value, c.Value));

    /**
     * TEXT NORMALIZATION — the pre-tokenizer pass (normalize.ts). Exported because the NEURAL entry points in
     * persianNeural.ts do their own tokenization and must see the same rewritten text as the sync path; both call it
     * immediately after `normalizePersianOrthography`. It is idempotent, so the neural path re-entering the sync path
     * for a digit run costs nothing.
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
        // The third Perso-Arabic rider's coverage lexicon (ur and pa are already registered).
        RiderNeural.RegisterRider("fa", HarakatLex);
    }
}
