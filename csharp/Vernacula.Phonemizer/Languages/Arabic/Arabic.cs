/**
 * Arabic (ar) phonemizer — canonical IPA (Modern Standard Arabic, broad phonemic). Diacritized g2p (g2p.ts)
 * plus quantity-sensitive stress.
 *
 * ⚠ TWO ENTRY POINTS, AND THEY EXPECT DIFFERENT INPUT. The SYNCHRONOUS path assumes VOWELLED text: bare
 * Arabic reaching it is read off its consonant skeleton. `phonemizeArabic` is the async path, which runs the
 * neural diacritizer (ONNX, optional dependency) to restore the short vowels first — that is the one to use
 * for real-world text.
 */
using System.Text.RegularExpressions;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Arabic;

public static class Arabic
{
    private static readonly JsRe LONG_RE = JsRegex.Compile("ː", "");
    private static readonly JsRe SHORT_TANWIN_RE = JsRegex.Compile("[aiu]n$", "");

    private static bool IsLongNucleus(string ph) =>
        LONG_RE.IsMatch(ph) || ph == "aj" || ph == "aw" || SHORT_TANWIN_RE.IsMatch(ph);

    /**
     * MSA quantity-sensitive stress. Syllabify (each vowel = a nucleus; a consonant between two vowels is the
     * next onset, so a syllable is closed only when ≥2 consonants follow / a trailing consonant at word end).
     * Stress: final if superheavy (CVVC/CVCC); else the last non-final heavy syllable within the last three;
     * else the first syllable.
     */
    private static int StressedNucleus(List<Seg> segs)
    {
        var nuclei = segs.Select((s, i) => s.Vowel ? i : -1).Where(i => i >= 0).ToList();
        if (nuclei.Count <= 1) return nuclei.Count == 1 ? nuclei[0] : -1;

        var heavy = new bool[nuclei.Count];
        var superheavy = new bool[nuclei.Count];
        var longV = new bool[nuclei.Count];
        for (var k = 0; k < nuclei.Count; k++)
        {
            var vi = nuclei[k];
            var @long = IsLongNucleus(segs[vi].Ph);
            var end = k == nuclei.Count - 1 ? segs.Count : nuclei[k + 1];
            var consAfter = 0;
            for (var j = vi + 1; j < end; j++)
                if (!segs[j].Vowel) consAfter += Geminated(segs, j) ? 2 : 1;
            var coda = k == nuclei.Count - 1 ? consAfter >= 1 : consAfter >= 2;
            longV[k] = @long;
            heavy[k] = @long || coda;
            superheavy[k] = (@long && coda) || consAfter >= 2;
        }

        var last = nuclei.Count - 1;
        if (superheavy[last]) return nuclei[last]; // ultima superheavy (CVːC/CVCC) → ultima
        if (heavy[last]) return nuclei[last - 1]; // ultima heavy (CVV/CVC) → penult
        if (heavy[last - 1]) return nuclei[last - 1]; // ultima light, penult heavy → penult
        var ap = last - 2; // all-light ultima+penult → antepenult, UNLESS the
        if (ap >= 0 && heavy[ap] && !longV[ap]) return nuclei[last - 1]; // antepenult is heavy by CODA only (madrasa → penult)
        return nuclei[Math.Max(0, ap)]; // else antepenult (light, or heavy by long vowel: ṭaːlib)
    }

    /** Is the consonant seg at index j a geminate (rendered Cː) — it fills both coda and following onset. */
    private static bool Geminated(List<Seg> segs, int j) => segs[j].Ph.EndsWith("ː", StringComparison.Ordinal);

    // Arabic VARIETIES share this engine (scanner + diacritizer + numbers) and differ only by data: ordered IPA
    // rewrites applied to the MSA g2p output ("restore MSA → transform to the variety"). Registered under distinct ISO
    // codes (arz Egyptian, apc Levantine, …), NOT a runtime flag — like hi/gu/ur sharing one abugida engine. Consonant
    // shifts + diphthong monophthongization are deterministic; short-vowel restructuring is a per-variety lexical tail.
    public sealed class VarietyDef
    {
        public string Variety { get; init; } = "";
        public string Iso { get; init; } = "";
        public IReadOnlyList<string[]> ConsonantShifts { get; init; } = Array.Empty<string[]>();
        public IReadOnlyDictionary<string, string> DiphthongShifts { get; init; } = new Dictionary<string, string>();
        public string? ArticleVowel { get; init; } // raise the definite-article nucleus (arz "i" → il-); omitted = keep MSA [a]
        public ArabicNumberData? Numbers { get; init; } // per-variety numeral tables (arz 80 is tamaniːn, not MSA θamaːnuːn)
    }

    private sealed class VarietyRules
    {
        public required IReadOnlyList<string[]> ConsonantShifts { get; init; } // literal string rewrites (consonants are unambiguous)
        public required List<(JsRe Re, string To)> DiphthongShifts { get; init; } // guarded: aj/aw only when NOT an onset of the next syllable
        public string? ArticleVowel { get; init; } // per-variety definite-article vowel (applied to the tagged article seg, pre-join)
        public ArabicNumberData? Numbers { get; init; } // per-variety numerals; absent → the MSA compositor tables
    }

    /** A diphthong [aj]/[aw] monophthongizes only when its glide is a CODA — i.e. NOT followed by (an optional stress
     *  mark and) a vowel. This distinguishes the diphthong بيت bajt→beːt from the hiatus طويل tˤawiːl (a·w·iː, glide
     *  onsets the next syllable) which must stay. Vowel onsets: a i u (MSA) + e o (dialect eː/oː) + æ (imāla). */
    private static VarietyRules CompileVariety(VarietyDef d)
    {
        return new VarietyRules
        {
            ConsonantShifts = d.ConsonantShifts,
            DiphthongShifts = d.DiphthongShifts
                .Select(kv => (JsRegex.Compile(kv.Key + "(?!ˈ?[aiueoæ])", "gu"), kv.Value))
                .ToList(),
            ArticleVowel = d.ArticleVowel,
            Numbers = d.Numbers,
        };
    }

    private static VarietyRules LoadVariety(string file) =>
        CompileVariety(LoadManifest.Load<VarietyDef>("languages/arabic", file));

    private static readonly Dictionary<string, VarietyRules> VARIETIES = new(StringComparer.Ordinal)
    {
        ["egyptian"] = LoadVariety("egyptian.jsonc"),
        ["levantine"] = LoadVariety("levantine.jsonc"),
        ["sudanese"] = LoadVariety("sudanese.jsonc"),
        ["iraqi"] = LoadVariety("iraqi.jsonc"),
        ["gulf"] = LoadVariety("gulf.jsonc"),
        ["moroccan"] = LoadVariety("moroccan.jsonc"),
        ["libyan"] = LoadVariety("libyan.jsonc"),
        ["southlevantine"] = LoadVariety("southlevantine.jsonc"),
        ["hijazi"] = LoadVariety("hijazi.jsonc"),
    };

    private static readonly JsRe DOUBLE_LENGTH = JsRegex.Compile("ːː", "gu");

    /** Phonemize a single diacritized Arabic word to canonical IPA (with a stress mark). `variety` (e.g. "egyptian")
     *  applies its dialectal shifts on top of the MSA output; undefined/"msa" = Modern Standard Arabic. */
    public static string PhonemizeWord(string word, string? variety = null)
    {
        var segs = G2p.ToSegments(word);
        if (segs.Count == 0) return "";
        var stress = StressedNucleus(segs);
        var vdef = variety is not null ? VARIETIES.GetValueOrDefault(variety) : null;
        var @out = "";
        for (var i = 0; i < segs.Count; i++)
        {
            if (i == stress) @out += "ˈ";
            // a variety may raise the definite-article nucleus (arz [a]→[i], il-); the tag survives the seg build
            @out += vdef?.ArticleVowel is not null && segs[i].Article ? vdef.ArticleVowel : segs[i].Ph;
        }
        if (vdef is not null)
        {
            foreach (var shift in vdef.ConsonantShifts) @out = @out.Replace(shift[0], shift[1], StringComparison.Ordinal);
            foreach (var (re, to) in vdef.DiphthongShifts) @out = re.Replace(@out, to);
            // A diphthong shift over a GEMINATE glide (كُوَيِّس ay+ː → eː + ː) leaves a double length; IPA length is
            // binary, so collapse ːː → ː (kuwayyis → kuweːis, أَيَّة ayya → ʔeːa).
            @out = DOUBLE_LENGTH.Replace(@out, "ː");
        }
        return @out;
    }

    // Clause / phrase punctuation (Arabic + ASCII) → canonical inline pause marks (authored data in arabic.jsonc).
    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => Manifest.MANIFEST.ClausePunctuation;
    // A word (Arabic letters + harakat) / number (Arabic-Indic or ASCII digits) / punctuation token.
    // The number class accepts GROUPING and DECIMAL separators. Without them "1,000" tokenized as 1 | , | 000
    // and the separator became a clause PAUSE ("واحد , صفر"); "1.5" likewise. Arabic-Indic digits are folded to
    // ASCII by normalizeArabic before this runs, so only the ASCII forms need matching here.
    // ⚠ THE PERSO-ARABIC EXTENSION LETTERS ARE PART OF THE WORD CLASS, and leaving them out did not merely lose
    // their sound — it BROKE THE WORD. A character no arm of this pattern matches is not a token, so
    // `assembleClauses` walks past it and emits the two halves either side as separate words: ary `السوپر` came out
    // `ˈasw r`, `لݣلونضات` as `l lwndˤˈaːt`, and arz `فین` as `fˈe nˈuːn` — the orphaned ⟨ن⟩ read as its LETTER
    // NAME. Their phoneme values are in arabic.jsonc; this is only the tokenizer half of the same fix. Listed by
    // codepoint rather than as a range because the block between them holds Arabic-Indic digits (٠-٩, ۰-۹) and the
    // Arabic percent/decimal signs, which have their own arms above and in normalizeArabic.
    private const string EXTENDED = "\\u067E\\u0686\\u0698\\u06A4\\u06AD\\u06AF\\u0763"; // پ چ ژ ڤ ڭ گ ݣ
    private static readonly JsRe TOKEN = JsRegex.Compile(
        $"([ء-يٰٱً-ْـ{EXTENDED}]+)|(\\d+(?:,\\d{{3}})*(?:\\.\\d+)?)|([۔.!؟?،,؛;:…])",
        "gu");

    private static readonly JsRe ARABIC_INDIC = JsRegex.Compile("[٠-٩]", "g");

    /** Arabic-Indic digits ٠..٩ → ASCII. */
    private static string ToAscii(string d) =>
        ARABIC_INDIC.Replace(d, c => Js.NumberToString(c.Value[0] - 0x0660));

    // Egyptian short-vowel LEXICON (arz): word (undiacritized) → canonical Egyptian IPA, mined from kaikki (Wiktionary
    // Egyptian Arabic, CC BY-SA) — the dialect vowel data the MSA diacritizer cannot supply (Egyptian restructures the
    // short vowels: مصر MSA miṣr → BP maṣr, أنا anā → ana). Because kaikki and the wikipron-arz referee share the
    // Wiktionary tradition, the eval scores the RULE path (useLexicon:false) → this lexicon is a SHIPPED refinement.
    private static Dictionary<string, string>? egyptianLex;
    private static Dictionary<string, string> EgyptianLexicon() =>
        egyptianLex ??= LoadTsv.LoadTsvMap<string>("languages/arabic", "egyptian-lexicon.tsv",
            (v, _) => IpaOnly(v), optional: true);

    private static readonly JsRe HARAKAT = JsRegex.Compile("[ً-ْٰـ]", "gu"); // short-vowel diacritics + dagger-alif + tatweel → bare lexicon key

    // The lexicon is MINED from kaikki, and the extraction once emitted a Wiktionary entry's phonemic and
    // phonetic transcriptions glued together — كتب → "katab/[kˈatab" — which reached the output verbatim as a
    // "phoneme". The data is repaired; this guard keeps a re-mine from reintroducing it.
    //
    // It REPAIRS rather than drops. Dropping would be wrong here specifically: this lexicon exists to supply
    // EGYPTIAN short vowels, and without a hit the word falls back to the abjad rule path or the MSA neural
    // diacritizer — which restores MSA vowels that are wrong for Egyptian (مصر MSA miṣr vs Egyptian maṣr).
    // So a dropped row does not degrade to "unrefined", it degrades to "incorrect vowels". Recovering an
    // alternant keeps the vocalization.
    //
    // Selection mirrors the one used to repair the data: of the alternants, prefer the single stressed one
    // (the file header states entries carry "stress on the nucleus"), else the first. Only a value still
    // holding a delimiter after that is unusable and dropped.
    private static readonly JsRe VARIANT_SPLIT = JsRegex.Compile("\\/~\\/|\\/\\/|\\/\\[", "u");
    private static readonly JsRe NOT_IPA = JsRegex.Compile("[/[\\]~()|\\\\]", "u");

    /** Exported for tests: the load-time repair rule for a mined lexicon value (see the note above). */
    public static string? IpaOnly(string value)
    {
        if (!NOT_IPA.IsMatch(value)) return value;
        var parts = SplitKeepNonEmpty(value);
        var stressed = parts.Where(p => p.Contains('ˈ')).ToList();
        var pick = stressed.Count == 1 ? stressed[0] : (parts.Count > 0 ? parts[0] : null);
        return pick is not null && !NOT_IPA.IsMatch(pick) ? pick : null;
    }

    /** TS `value.split(VARIANT_SPLIT).filter(Boolean)`. */
    private static List<string> SplitKeepNonEmpty(string value)
    {
        var parts = new List<string>();
        var cursor = 0;
        foreach (var m in VARIANT_SPLIT.Re.Matches(value).Cast<Match>())
        {
            parts.Add(value[cursor..m.Index]);
            cursor = m.Index + m.Length;
        }
        parts.Add(value[cursor..]);
        return parts.Where(p => p.Length > 0).ToList();
    }

    // symbol normalization — % is the only symbol in the Arabic FLEURS text. في المئة (the standard
    // written form, matching FLEURS' MSA-leaning register) reads cleanly through the diacritizer as
    // fi ilmiʔa; the Egyptian colloquial المية spelling vocalized worse. Shared path — only arz has corpus %.
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        // ⚠ THE AMPERSAND WAS A MISSING CELL, NOT A SOURCING PROBLEM — the tier's own `ampersand` note says so,
        // and this language is one of the fourteen that still had no word declared, so `&` was DROPPED outright.
        // وَ is ×71 TOKEN in this language's own corpus, i.e. among its commonest words; there was nothing to source.
        //
        // A Latin-script printing LIGATURE rather than anything native, so what it takes is a reading and not a
        // translation: for a language written in Latin script that is its own conjunction, and for one that is not,
        // the symbol only ever arrives inside a Latin run. Either way the tier substitutes the conjunction, SPACED —
        // see the tier, where the spacing exists because `B&B` is two initialisms.
        Ampersand = "وَ",
        // Every emitted word carries HARAKAT: the engine reads undiacritized Arabic as a consonant skeleton,
        // so "في المئة" came out [fj almʔ] where "فِي الْمِئَة" gives [fˈiː almˈiʔa].
        Percent = new[] { "فِي الْمِئَة" },
        // Absent entirely before: a currency sign was DROPPED ($50 read as just "خمسون").
        Currency = new Dictionary<string, IReadOnlyList<string>>
        {
            ["$"] = new[] { "دُولَار" }, ["€"] = new[] { "يُورُو" }, ["£"] = new[] { "جُنَيْه" }, ["¥"] = new[] { "يِن" },
        },
        Units = new Dictionary<string, IReadOnlyList<string>>
        {
            ["km"] = new[] { "كِيلُومِتْر" }, ["cm"] = new[] { "سِنْتِيمِتْر" }, ["mm"] = new[] { "مِلِّيمِتْر" },
            ["kg"] = new[] { "كِيلُوجِرَام" }, ["m"] = new[] { "مِتْر" }, ["g"] = new[] { "جِرَام" },
            ["km/h"] = new[] { "كِيلُومِتْر فِي السَّاعَة" },
        },
        // `كيلومتر مربع` ×8 — the adjective FOLLOWS its noun, as Arabic adjectives do. Vocalised to match the
        // rest of this table; the corpus writes it bare, and the diacritizer would have to guess otherwise.
        // No cubed word: `متر مكعب` is zero in this corpus, so `m³` keeps the documented unit-plus-`³` fallback
        // rather than a plausible invention.
        // `متراً مكعّباً` — the corpus's cubic-metre sentence, adjective FOLLOWING as Arabic adjectives do, same
        // side as مربع above. (An earlier pass probed the bare `متر مكعب` and read ×0; the corpus writes it with
        // case endings, which a token probe for the bare form cannot match — the sentence is the evidence.)
        ExponentWords = new ExponentWordsDef
        {
            Squared = new[] { "مُرَبَّع" }, Cubed = new[] { "مُكَعَّب" }, Position = "after",
        },
    });

    private static readonly JsRe GROUPING_COMMA = JsRegex.Compile(",", "gu");

    private sealed class ArabicPhonemizer : ILanguage
    {
        private readonly string? _variety;
        private readonly bool _useLexicon;

        public ArabicPhonemizer(string? variety = null, bool useLexicon = false)
        {
            _variety = variety;
            _useLexicon = useLexicon;
        }

        public string Text(string input)
        {
            // Arabic-specific rewrites (٪/٫/٬ folding, units, clock, signs) then the shared tier.
            input = SYMBOLS(Normalize.NormalizeArabic(input));
            // The Egyptian lexicon keys on the BARE word; the input here is diacritized (post neural-diacritizer), so
            // strip the harakat to look it up, and only for the egyptian variety with the lexicon enabled (shipped).
            var lex = _variety == "egyptian" && _useLexicon ? EgyptianLexicon() : null;
            return Clauses.AssembleClauses(input, TOKEN, (m, sink) =>
            {
                if (m.Groups[1].Success && m.Groups[1].Value.Length > 0)
                    sink.Emit(
                        (lex is not null ? lex.GetValueOrDefault(HARAKAT.Replace(m.Groups[1].Value, "")) : null)
                            ?? PhonemizeWord(m.Groups[1].Value, _variety));
                else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
                {
                    var nums = _variety is not null ? VARIETIES.GetValueOrDefault(_variety)?.Numbers : null;
                    var split = GROUPING_COMMA.Replace(ToAscii(m.Groups[2].Value), "").Split('.');
                    var intPart = split[0];
                    var frac = split.Length > 1 ? split[1] : null;
                    var parts = new List<string> { Numbers.NumberToIpa(Js.Number(intPart), nums) };
                    if (frac is not null)
                    {
                        // A decimal is read "فاصلة" then the fractional digits one by one.
                        parts.Add(PhonemizeWord("فَاصِلَة", _variety));
                        foreach (var d in frac) parts.Add(Numbers.NumberToIpa(Js.Number(d.ToString()), nums));
                    }
                    sink.Emit(string.Join(" ", parts));
                }
                else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
                {
                    var mk = CLAUSE_MARK.GetValueOrDefault(m.Groups[3].Value);
                    if (mk is not null) sink.Pause(mk);
                }
            });
        }
    }

    /** Build the Arabic phonemizer for `variety` (undefined/"msa" = Modern Standard Arabic; "egyptian" = arz, …).
     *  `useLexicon` enables the Egyptian short-vowel lexicon (shipped; off for the non-circular referee eval).
     *  Expects diacritized input; the neural diacritizer pre-pass (phonemizeArabic) restores short vowels for bare text. */
    public static ILanguage CreateArabic(string? variety = null, bool useLexicon = false) =>
        new ArabicPhonemizer(variety, useLexicon);

    // Per-variety diacritizer cache: egyptian gets the Egyptian student model (diacritizer-egy), everything else the
    // MSA model. Keyed so each variety's ONNX session is created once and reused.
    private static readonly Dictionary<string, Task<Diacritizer.IArabicDiacritizer?>> diacritizers = new(StringComparer.Ordinal);
    private static readonly Dictionary<string, ILanguage> phonemizers = new(StringComparer.Ordinal);
    // Tashkeela-derived PAUSAL restoration lexicon (undiacritized → vocalized) — the supplement that repairs words the
    // neural diacritizer leaves as skeletons. Optional: absent → the restore pass falls back to epenthesis only.
    private static Dictionary<string, string>? restoreLexicon;
    private static Dictionary<string, string> RestoreLex() =>
        restoreLexicon ??= LoadTsv.LoadTsvMap("languages/arabic", "diacritization.tsv", optional: true);

    /**
     * Phonemize BARE (undiacritized) Arabic. Runs the neural diacritizer pre-pass (ONNX, async) to restore short
     * vowels, then the synchronous g2p. Requires the optional `onnxruntime-node` dependency and the diacritizer
     * model beside this module; if the model is absent it falls back to phonemizing the input as-is (which is
     * correct only for already-diacritized text). Diacritized input can use the sync `phonemize(text, "ar")`.
     *
     * `opts.lexicon` (default TRUE) enables the Egyptian short-vowel lexicon for `variety:"egyptian"` — a SHIPPED
     * refinement over the MSA-diacritizer vowels. The referee eval passes `lexicon:false` to keep the number
     * non-circular (the lexicon is mined from the same Wiktionary tradition as the wikipron-arz referee).
     */

    // ── Foreign-cluster repair (سنترال → sntrˈaːl) ───────────────────────────────────────────────────────────────
    // The neural diacritizer vocalizes native words and FREQUENT loans (كمبيوتر → kumbijuːtar), but rare
    // transliterations come back with few or no diacritics, and the g2p then emits consonant runs no Arabic
    // syllable allows — (C)V(C)(C) permits at most CC, so a 3+-consonant run is always a vocalization failure
    // (2.4% of FLEURS arz tokens: Carolyn kˈaːrwljn, Booking bwknɡ, microwave mjkrwwjf). Two repairs, applied
    // word-wise to the ASYNC path's final IPA (the sync path expects vocalized input and is left alone):
    //   Tier 1 — mater lectionis: inside an illegal run, و/ي were written AS VOWEL CARRIERS (o/u, e/i) but were
    //   read as consonants w/j. Re-reading them as u/i fixes most words outright: bwknɡ → buknɡ → (tier 2)
    //   bukinɡ; ˈiwtwbjs → utubiːs-shaped (autobus). The letter itself marks where the vowel goes — no guessing.
    //   Tier 2 — epenthesis: residual 3+ runs get the variety's epenthetic vowel INSIDE the run, the repair
    //   Arabic speakers themselves apply to foreign clusters. Insertion after the FIRST consonant of the run —
    //   selected by measuring both documented templates (Broselow's after-first vs after-second) against 57
    //   attested loanword transcriptions; after-first scored higher (booking → bukinɡ, not bukniɡ).
    // Both passes no-op on any legally-syllabified word, so native output is untouched by construction.
    // CAVEAT for future variety work: Moroccan (ary) legitimately allows heavy clusters in real Darija (ktbt).
    // Today that is moot — every variety runs the MSA diacritizer first, so ary output arrives vocalized and
    // the repair never fires on it (كتبت → kutˈibat). If ary ever gains true schwa-deletion, gate this repair
    // per variety (or raise its run threshold for ary) BEFORE shipping that change.
    private static readonly IReadOnlySet<string> REPAIR_VOWELS = Ipa.IPA_VOWEL;
    private static readonly HashSet<string> REPAIR_SKIP = new(Js.CodePoints("ˈˌːˤّـ"), StringComparer.Ordinal);

    private static readonly JsRe COMBINING_MARK = JsRegex.Compile("\\p{M}", "u");

    private sealed class RUnit
    {
        public required string Text;
        public required bool Vowel;
    }

    private static List<RUnit> RepairUnits(string word)
    {
        var @out = new List<RUnit>();
        foreach (var ch in Js.CodePoints(word.Normalize(System.Text.NormalizationForm.FormD)))
        {
            if (COMBINING_MARK.IsMatch(ch) || REPAIR_SKIP.Contains(ch) || ch == "͡")
            {
                if (@out.Count > 0) @out[^1].Text += ch;
                else @out.Add(new RUnit { Text = ch, Vowel = false });
                continue;
            }
            @out.Add(new RUnit { Text = ch, Vowel = REPAIR_VOWELS.Contains(ch) });
        }
        return @out;
    }

    /** One word of final IPA → repaired IPA. `epenthetic` is the variety's cluster-repair vowel. */
    public static string RepairForeignClusters(string word, string epenthetic = "i")
    {
        var units = RepairUnits(word);
        // maximal consonant runs (stress marks travel with their unit; a unit whose BASE is a vowel ends a run)
        int RunAt(int i)
        {
            var n = 0;
            while (i + n < units.Count && !units[i + n].Vowel) n++;
            return n;
        }
        var changed = false;
        // Tier 1: w/j inside an illegal run become u/i (leftmost first; re-scan, since each conversion splits a run)
        for (var guard = 0; guard < 8; guard++)
        {
            var acted = false;
            for (var i = 0; i < units.Count; i++)
            {
                if (units[i].Vowel) continue;
                var n = RunAt(i);
                if (n < 3) { i += n; continue; }
                for (var k = i; k < i + n; k++)
                {
                    var @base = units[k].Text[..1];
                    if (@base == "w" || @base == "j")
                    {
                        units[k] = new RUnit { Text = (@base == "w" ? "u" : "i") + units[k].Text[1..], Vowel = true };
                        acted = changed = true;
                        break;
                    }
                }
                if (acted) break;
                i += n;
            }
            if (!acted) break;
        }
        // Tier 2: epenthesis after the FIRST consonant of each remaining 3+ run
        for (var guard = 0; guard < 8; guard++)
        {
            var acted = false;
            for (var i = 0; i < units.Count; i++)
            {
                if (units[i].Vowel) continue;
                var n = RunAt(i);
                if (n >= 3)
                {
                    units.Insert(i + 1, new RUnit { Text = epenthetic, Vowel = true });
                    acted = changed = true;
                    break;
                }
                i += n;
            }
            if (!acted) break;
        }
        return changed
            ? string.Concat(units.Select(u => u.Text)).Normalize(System.Text.NormalizationForm.FormC)
            : word;
    }

    private static readonly JsRe PAUSE_TOKEN = JsRegex.Compile("^[.,!?;:…]+$", "");

    /** Sentence-level wrapper: repair each word token, leave pause marks alone. */
    private static string RepairSentence(string ipa, string epenthetic = "i")
    {
        return string.Join(" ", ipa
            .Split(' ')
            .Select(t => PAUSE_TOKEN.IsMatch(t) ? t : RepairForeignClusters(t, epenthetic)));
    }

    public static async Task<string> PhonemizeArabic(string text, string? variety = null, bool? lexicon = null, string? host = null)
    {
        var dkey = variety == "egyptian" ? "egyptian" : "msa";
        Task<Diacritizer.IArabicDiacritizer?>? diacP;
        lock (diacritizers)
        {
            if (!diacritizers.TryGetValue(dkey, out diacP))
                diacritizers[dkey] = diacP = Diacritizer.CreateArabicDiacritizer(variety);
        }
        var diac = await diacP.ConfigureAwait(false);
        // The diacritizer + Tashkeela restore lexicon are MSA (shared): they restore the MSA vocalization, which the
        // variety g2p then transforms. Egyptian short vowels differ from MSA — the egyptian-lexicon.tsv supplies them.
        // symbol words must be inserted BEFORE diacritization — a percent word injected after it would
        // reach the g2p as a bare skeleton (المئة → ilimʔ) instead of being vocalized (fi ilmiʔa).
        // The eastern letterforms fold FIRST, ahead of the diacritizer: the model's own letter test does not know
        // ⟨ی⟩/⟨ک⟩, so an unfolded word comes back unvocalized (see foldLetterforms). normalizeArabic folds again
        // downstream; the rewrite is idempotent.
        text = SYMBOLS(Normalize.FoldLetterforms(text));
        var vocalized = diac is not null ? await diac.Diacritize(text).ConfigureAwait(false) : text;
        var restored = diac is not null ? Restore.LexiconPrimary(vocalized, RestoreLex()) : vocalized;
        var useLexicon = lexicon ?? true;
        var key = $"{variety ?? "msa"}{(useLexicon ? "" : ":nolex")}";
        ILanguage? phon;
        lock (phonemizers)
        {
            if (!phonemizers.TryGetValue(key, out phon))
                phonemizers[key] = phon = CreateArabic(variety, useLexicon);
        }
        // The registry code, when the caller has one (`neuralRegistry.ts` passes it), so a foreign run inside the
        // sentence reaches the script router instead of being dropped for want of a host — the async path builds
        // this engine directly and therefore never passes through the registry's own `pushHost`. Synchronous, as
        // core/foreign.ts's stack requires. Without a code the run behaves as it did before: unrouted.
        var engine = phon;
        var read = host is null ? engine.Text(restored) : Foreign.WithHost(host, () => engine.Text(restored));
        return RepairSentence(read);
    }

    /** Registry bootstrap: the one Arabic module registers MSA plus every variety key. */
    internal static void RegisterSelf()
    {
        Registry.Register("arabic", () => CreateArabic());
        foreach (var v in new[] { "egyptian", "levantine", "sudanese", "iraqi", "gulf", "moroccan", "libyan", "southlevantine", "hijazi" })
        {
            var variety = v;
            Registry.Register($"arabic:{variety}", () => CreateArabic(variety));
        }
    }
}
