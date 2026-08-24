/**
 * Native Pashto / پښتو (ps) phonemizer — Perso-Arabic (extended) abjad → canonical IPA. First Eastern Iranian
 * language. Logical order = phonetic order, so RTL is a non-issue. Pashto is a SHALLOWER abjad than Urdu/Arabic:
 * it writes the long/mid vowels distinctly — ا/آ→ɑ (ā), ې→e, و→o (or the glide w), ی→i (or the glide j), ۍ/ئ→əi —
 * but the SHORT vowels a/ə/i/u are usually UNWRITTEN, so a default [ə] (the zwarakay) + medial-schwa deletion
 * stand in for the deferred short-vowel-restoration subsystem (, as for Urdu/Persian). Word-final ه→[ə]
 * (ښه→ʂə); ع→ʔ. Dialect: ښ/ږ = Kandahari retroflex ʂ/ʐ.
 *
 * ⚠ THE THREE AMBIGUOUS-CARRIER RULES ARE THE FIDDLY PART OF THIS ENGINE, and each is a COUNTED majority on the
 * raw pbt reference rather than a tidy generalization — they live on `longVowel` and the glide branch in `g2p`,
 * with their counts. Summary: word-final ⟨ی⟩ is the -ay diphthong and ⟨ي⟩ is plain /i/; a carrier immediately
 * before ⟨ا⟩ is the glide; a carrier homorganic with the preceding vowel is the mater lectionis (⟨ـُو⟩→uː). The
 * cases that counted out as COIN FLIPS are deliberately absent and belong to `lexicon.tsv`: medial ⟨و⟩ is /u/
 * 103 vs /o/ 100, and the word-initial cluster is 70% vowel-broken / 30% kept with no sonority conditioning.
 *
 * ⚠ THE COVERAGE LEXICON IS CALIBRATED TO THIS FILE, so a change to what a carrier MEANS invalidates it and the
 * mine must be re-run — `invert_harakat.ts` searches vocalizations by round-tripping through this g2p, so it
 * learns whatever convention the g2p has, including its bugs. (It had mined بندول as بندُول for /bandawəl/ back
 * when a medial ⟨ـُو⟩ wrongly read u·w·ə.) Re-mine: `--lexicon ps --shard=k/14` → `export_lexicons.sh`.
 *
 * ⚠⚠ AND DO NOT QUOTE THIS ENGINE'S REFEREE SCORE WITHOUT THE CAVEAT: the lexicon is mined from wikipron/kaikki,
 * which ARE the referees, so the shipped number is substantially circular (pbt slice: shipped 69.6%, espeak-only
 * lexicon 46.7%, rules-only 46.9%). Engine changes are compared on RULES-ONLY. See tools/referee-eval/langs/
 * ps.jsonc and docs/investigations/ps_neural_restoration_investigation.md Run 11.
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
    // The vowel/glide-bearing letters (after a consonant → a long/mid vowel; after a vowel → a glide).
    private static bool IsVowelCarrier(string c) =>
        c == ALIF || c == WAW || c == YA || c == YA_AR || c == YA_E || c == YA_FEM || c == YA_HAMZA;
    private static readonly JsRe ENDS_IN_VOWEL = JsRegex.Compile("[aeiouɑə]$", "u");
    private static bool EndsInVowel(string outp) => ENDS_IN_VOWEL.IsMatch(outp);

    /**
    * A vowel-carrier letter standing after a consonant → its long/mid vowel.
    *
    * ⚠ `final` SEPARATES ⟨ی⟩ FROM ⟨ي⟩, AND THAT ONE BIT IS THE LARGEST SINGLE ENGINE WIN THIS ENGINE HAS HAD.
    * Pashto's orthography distinguishes the two yehs word-finally where Persian/Urdu do not: ⟨ی⟩ (U+06CC) is the
    * masculine-singular / adjectival **-ay diphthong** and ⟨ي⟩ (U+064A) is plain /i/. Reading both as /i/ cost a
    * whole segment on every -ay word. Counted on the RAW pbt reference (never the folded string — Run 8):
    *
    *     word-final ی   108/125 (86%)  aɪ 53 · ai 52 · ɪ 2 · əi 1     ← the diphthong
    *                      8       i        (ناڅاپی, لوی — loans and a few natives)
    *                      5       j        (خدای, دوی — after a vowel, handled by the offglide branch instead)
    *     word-final ي    42/43  (98%)  i                              ← plain /i/, unchanged
    *
    * Emitted as `əi` rather than `aɪ` to match ⟨ۍ⟩/⟨ئ⟩, which are the SAME suffix in feminine/verbal spelling and
    * whose references write it `əi` 24× — one form for one morpheme. Under the eval fold all of aɪ/ai/əi/əɪ
    * collapse together anyway, so the choice is about internal consistency, not about scoring.
    */
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
    * The Arabic ADVERBIAL ENDING ⟨ـاً⟩ — the tanwīn's alif is a SEAT, not a long vowel, so word-finally it is
    * dropped and the mark falls back onto its own consonant, where the `harakat` table reads it as /an/.
    * تقریباً → t̪əqriban rather than t̪əqribˈɑ. Word-final only: a medial ⟨اً⟩ is not this ending.
    */
    private static readonly JsRe TANWIN_ALIF = JsRegex.Compile("[اىیي]([ًٌٍ])$", "u");

    /**
    * ⚠ SHADDA BEFORE ITS VOWEL MARK — AND WITHOUT THIS, A GEMINATE THAT CARRIES A VOWEL IS NOT A GEMINATE.
    *
    * The scan below reads the marks after a consonant in a FIXED order: shadda first, then one haraka. But the
    * canonical Unicode ordering of the Arabic marks is the OPPOSITE for the commonest case — a vowel mark has
    * combining class 30 and the shadda 33, so ⟨زَّ⟩ is stored ⟨ز⟩+fatḥa+shadda and text arrives that way. The
    * shadda test therefore saw the fatḥa, fell through, and the shadda was skipped as an unknown mark:
    * `الزَّادِ` read *alzaɑd̪i* with no length at all. Found while triaging the `silentCharsIn` report of ⟨ّ⟩ ×10
    * in ps — whose own probe words are something else (a shadda mistyped onto an alif), but whose diagnosis
    * turned this up underneath. Rewriting the pair into the order the scan expects is the whole fix, and it is
    * a no-op on any word that already writes them that way.
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

        // Word-initial vowel carrier: آ→ɑ; ا + long-vowel letter → that vowel; bare ا → short [a].
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
            // ه / ھ: word-final → the schwa [ə] (ښه→ʂə); before a consonant when it can't be a vowel → [h].
            if (ch == HE || ch == HE_DO)
            {
                if (i == n - 1 && outp.Length > 0 && !EndsInVowel(outp)) outp += "ə";
                else
                {
                    // ⚠ A MEDIAL ⟨ه⟩ IS A CONSONANT AND TAKES THE ZWARAKAY LIKE ONE. This branch emitted [h] and
                    // returned, so a word whose only other letters are consonants came out with NO NUCLEUS AT
                    // ALL: هم *hm, هر *hr, مهم *mhm, بهر *bhr, ذهن *zhn — unpronounceable in any dialect. 370
                    // corpus tokens. The condition mirrors the consonant branch below.
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
            // Vowel/glide letters: a glide (w/j) after a vowel OR before a word-final ه (ـیه→jə); else the long vowel.
            if (IsVowelCarrier(ch))
            {
                // Explicit glide: وْ/یْ (a sukun on the و/ی) → the consonantal glide w/j — a cluster onset, NOT a vowel
                // nucleus (الوْتل→alwətəl vs the long-vowel الوتل→alot̪əl). Medial و/ی is long-vowel-vs-glide ambiguous, so
                // the sukun makes it mineable/lexicon-correctable. Consumes the sukun; epenthesis before a next consonant.
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
                // ⚠ A و/ی/ي IMMEDIATELY BEFORE ا/آ IS THE GLIDE, AND THE ا IS THE [ɑ] NUCLEUS — ⟨وا⟩→wɑ, ⟨يا⟩→jɑ
                // (خواږه→xwɑʐə, باغوان→bɑɣwɑn, خپلواک→xpəlwɑk, اسپانيا→əspɑnjɑ). Counted on the RAW pbt+kaikki
                // references, this is the most one-sided fact in Pashto's carrier inventory:
                //
                //     ⟨وا⟩  31/31 = 100% glide          ⟨يا⟩  25/25 = 100% glide
                //     ⟨وی⟩  5/10  =  50%  ⟨يو⟩ 4/9 = 44%  ⟨وي⟩ 5/7 — COIN FLIPS, left lexical on purpose
                //
                // ⚠ THE OLD RULE WAS THIS ONE RESTRICTED TO WORD-FINAL ـيا, AND THE RESTRICTION HID A BUG. After a
                // CONSONANT the و took the `longVowel` branch → [o], which then made `endsInVowel` true at the ا, so
                // the ا fell into the glide branch below and was emitted as **[j]** — a sound ⟨ا⟩ has in no position.
                // خواږه read *xojʐə for xwɑʐə. That is why `ALIF` is excluded from the glide test: a carrier that
                // reaches it before an ا is now already the glide, and an ا that reaches it is a hiatus [ɑ], never j.
                var glideBeforeAlif = glideable && (At(i + 1) == ALIF || At(i + 1) == ALIF_MADDA);
                var offglideAfterVowel = EndsInVowel(outp) && ch != ALIF && ch != ALIF_MADDA;
                if (glideBeforeAlif || glideBeforeFinalHe || offglideAfterVowel)
                {
                    // A WORD-FINAL و/ی after a vowel is the DIPHTHONG offglide (سړی -ay→saɽaɪ, لوی→loɪ), not the
                    // consonantal glide — a medial glide (دنيا→dənjɑ) stays j/w.
                    //
                    // ⚠ BUT HOMORGANIC FIRST, AND IN **ANY** POSITION: a و after /u/ (or a ی after /i/) is the
                    // MATER LECTIONIS marking that vowel long — the ordinary Perso-Arabic ⟨ـُو⟩ = /uː/, ⟨ـِي⟩ =
                    // /iː/. This test used to be gated on `i === n - 1`, so it only ever fired word-finally
                    // (آسُو→ɑsuː) and a MEDIAL ⟨ـُو⟩ fell through to the glide arm: کُور read *kuwər for /kur/ and
                    // مُوک read *muwək for /muk/ — an epenthetic vowel and a spurious /w/ on every such word.
                    // ⚠ THAT WAS ON THE SHIPPED PATH, not a hypothetical: `lexicon.tsv` supplies exactly these
                    // harakat, and **416 of its 10,723 rows carried ⟨ُو⟩**, so the coverage layer was feeding the
                    // bug rather than avoiding it. The gate is gone; the glide arm now handles only the genuinely
                    // heterorganic cases it was written for.
                    var pv = outp.Length > 0 ? outp[^1..] : null;
                    var homorganic =
                        (ch == WAW && (pv == "u" || pv == "ʊ")) || (ch != WAW && (pv == "i" || pv == "ɪ"));
                    var emittedGlide = false;
                    if (homorganic && !glideBeforeAlif) outp += "ː";
                    else if (i == n - 1 && EndsInVowel(outp)) outp += ch == WAW ? "ʊ" : "ɪ";
                    else { outp += ch == WAW ? "w" : "j"; emittedGlide = true; }
                    // A glide behaves like a coda consonant: before another consonant it takes an epenthetic ə (the
                    // verbal infinitive -ول = /awəl/: کَول→kawəl, not kawl). Mirrors the consonant-branch INH insertion.
                    // SUPPRESSED by a sukun on that consonant (ښایسْته→ʂɑjstə, not ʂɑjəstə) — glide+CC is lexically
                    // ambiguous (راوستل wants the ə, ښایسته doesn't), so the sukun makes it lexicon-correctable/mineable.
                    // ⚠ AND GATED ON `emittedGlide`, WHICH IS THE OTHER HALF OF THE MATER-LECTIONIS FIX. The rule is
                    // about a CODA CONSONANT needing a following nucleus; a length mark is not one. Without the gate
                    // مُوک came out *muːək — the /w/ was gone but the epenthetic ə it had licensed stayed behind, and
                    // the referee got WORSE (810 → 799) even though the segment it complained about was fixed.
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
            // Consonant.
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
                    // A following vowel-carrier letter is the nucleus; otherwise insert the default short vowel [ə].
                    // ⚠ ⟨ه⟩ IS EXCLUDED ONLY WHEN IT IS WORD-FINAL, where it IS the vowel (ښه→ʂə) and an
                    // inherent vowel before it would double up. A MEDIAL ⟨ه⟩ is [h], an ordinary consonant, and
                    // skipping the zwarakay before it is what left مهم as *mhm.
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
        // ⚠ A ONE-CONSONANT WORD CANNOT REACH THE ZWARAKAY RULE, because that rule is conditioned on a
        // FOLLOWING consonant — so it has nothing to attach to and the word comes out with no nucleus at all.
        // That is not a rare corner: ⟨د⟩, the genitive particle, is the single commonest word in Pashto and was
        // rendering as bare *d̪* in 4,415 corpus tokens (91% of every vowel-less Pashto token). It is [də].
        //
        // ⚠ SCOPED TO ONE CONSONANT ON PURPOSE. A general "no nucleus → append ə" guard would also rewrite
        // ⟨کړ⟩, which `lexicon.tsv` sukun's to کْړ deliberately, and loans like ⟨بزنس⟩ where the missing vowels
        // are interior rather than final. Those are a different problem and are left to the lexicon.
        //
        // ⚠ AND IT COSTS THE ALPHABET, WHICH IS WHY THE REFEREE LOOKS WORSE THAN IT IS. wikipron lists every
        // letter as a headword against its bare consonant (⟨ب⟩ = b, ⟨ت⟩ = t …), so this guard "loses" 39 of
        // them and the raw score reads 69.6% → 67.5%. Excluding letter names — which is the methodology
        // `ps_neural_restoration_investigation.md` Run 11 already used, "ex letter-names, 1306 words" — it is
        // **71.7% → 72.7%**, and kaikki-pus 72.3% → 73.5% with the Kandahari-tagged slice flat at 79.4%.
        // The trade is 4,415 corpus tokens of the genitive particle against citation forms of the alphabet.
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

    // COVERAGE layer: mined undiacritized skeletons are vocalized before g2p (see core/harakatLexicon.ts). Loaded
    // LAZILY (registry.ts imports every rider eagerly; the TSV is only read on first Pashto use).
    private static Dictionary<string, string>? LEXICON;
    private static readonly object GATE = new();
    public static IReadOnlyDictionary<string, string> HarakatLexicon()
    {
        lock (GATE) return LEXICON ??= Core.HarakatLexicon.LoadHarakatLexicon(Dir);
    }

    /** Lexicon-FREE core: skeleton g2p + default-schwa deletion + stress. Used by the number path and the mining tool,
     *  which must NOT consult the content lexicon (number words / mining candidates collide with content homographs). */
    public static string PhonemizeWordCore(string word)
    {
        var ipa = G2p(word);
        if (ipa == "") return "";
        ipa = Schwa.DeleteMedialSchwa(ipa, "ə");
        // Homorganic nasal AFTER schwa deletion (so the nasal is adjacent to the velar): ن before a velar stop → [ŋ]
        // (انګور→aŋɡor). The standard assimilation; runs post-deletion because the epenthetic ə is removed first.
        ipa = NASAL_BEFORE_VELAR.Replace(ipa, "ŋ");
        // NOTE: no word-final-cluster ə-deletion — Pashto RETAINS the epenthetic ə before many final clusters
        // (اخښل→axʂəl), unlike Persian; deleting it there hurt the referee.
        // ⚠ STRESS, AND IT IS MEASURED NOW — BY tools/pashto/eval_ps_stress.ts AND BY NOTHING ELSE. The
        // referee-eval BACKBONE fold STRIPS stress before comparing, so eval.ts is blind to this line and always
        // was. On the NON-CIRCULAR basis (314 comparable words, ps.wiktionary-derived lexicon rows excluded):
        //
        //     always the LAST nucleus (trivial baseline)          72.6%
        //     THIS RULE: last long vowel, else last nucleus       75.5%
        //     "last nucleus unless ə → penult (except after ل)"   74.8%
        //
        // ⚠ THAT SECOND ALTERNATIVE WAS BUILT, SHIPPED IN A BRANCH, AND REVERTED. It measured 83.8% against this
        // rule's 73.8% — until the eval was made non-circular. 197 of the 463 referee words carry a lexicon row
        // mined from the SAME ps.wiktionary romanization being scored against, and those rows fix the short
        // vowels, which decides the nucleus count the stress index is measured over. Nine of the twelve points
        // were feedback. On honest data the two rules differ by two words out of 314, which is noise.
        //
        // ⚠ SO THE REAL FINDING IS NOT THE RULE, IT IS THE CEILING: Pashto stress is ~73% predictable by "always
        // the last nucleus", and nothing tried beats that by more than ~3 points. Do not replace this line
        // without running the tool NON-circularly; a large win there is the signature of the feedback loop, not
        // of a better rule.
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

    /**
    * Non-negative integer → Pashto numeral spelling (decimal; ⟨و⟩ joins the magnitude groups). Three distinct
    * sub-100 patterns, per the sources cited in pashto.jsonc: irregular fused `teens`, the bound-⟨ویشت⟩ `compound`
    * series for 21-29, and UNITS-FIRST composition (یو دېرش) for 31-99.
    */
    public static string NumberToText(double nn)
    {
        if (nn < 0) return "";
        if (nn < 10) return NUM.Units[(int)nn];
        if (nn < 20) return NUM.Teens[(int)nn - 10]; // irregular fused forms — NOT unit+لس
        if (nn < 100)
        {
            // `tens` is keyed by the ROUND value ("20".."90"); the lookup used Math.floor(nn/10) → "2".."9" → undefined,
            // so 20-90 rendered EMPTY and 21-99 lost their tens slot entirely (SLOT-GAP: " ˈo ˈiʊ" for 21).
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
        // The magnitude chain: زر (10³) · میلیون (10⁶) · میلیارد (10⁹). The million branch was previously unreachable —
        // the data existed but nothing above 999 999 was composed, so 10⁶+ fell through to the digits (→ EMPTY IPA).
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
        // ⚠ OUT OF RANGE MUST STILL BE READ — see amharic.ts. `toAscii` first, so Eastern Arabic-Indic digits
        // (۱۲۳) take the same path as ASCII ones rather than falling through the units table as undefined.
        if (!(double.IsInteger(nn) && Math.Abs(nn) <= 9007199254740991d) || nn < 0 || nn >= 1e12)
            return string.Join(" ", ToAscii(digits)
                .Where(c => c >= '0' && c <= '9')
                .Select(c => NumberToText(Js.Number(c.ToString())))
                .Select(PhonemizeWordCore));
        return string.Join(" ", NumberToText(nn).Split(' ').Select(PhonemizeWordCore)); // numbers bypass the content lexicon
    }

    // The foreign arm is `LATIN_RUN`, ALL of Latin plus marks — not `[A-Za-z]+`, which ended the token at a
    // diacritic and left that letter to be read as an English letter name (`Cañitas` → *ka ˈɛn ˈitas*). This
    // engine ROUTES a foreign word to the injected reader, so widening the class is the whole fix.
    private static readonly JsRe TOKEN = JsRegex.Compile(
        $"([{PERSO_ARABIC_WORD}]+)|({HostWord.LATIN_RUN})|([{DIGIT_CLASS}]+)|([۔؟،؛.?!,;:])", "gu");

    /** ⚠ THE NORMALIZER IS A FACTORY AND TAKES `numberToText`, WHICH IS NOT DECORATION. Pashto's ordinal is a
     *  gender/case SUFFIX written after the digits (`۱۹مه`), and a suffix cannot agree with a digit run — so
     *  that one rule has to turn the operand into WORDS inside itself and weld the suffix onto the last one
     *  (playbook trap 14). Passing the speller in rather than importing it there keeps the dependency one-way:
     *  the engine calls the normalizer, never the reverse. */
    private static readonly Func<string, string> NormalizePashto = Normalize.MakePashtoNormalizer(NumberToText);

    private readonly Func<string, string>? foreign;
    public PashtoPhonemizer(Func<string, string>? foreign = null) { this.foreign = foreign; }

    public string Text(string input)
    {
        // NORMALIZATION runs first — pure text→text, so everything it emits is then read by the ordinary
        // word, number and clause paths below. It must see the text BEFORE tokenization, because most of
        // what it repairs (a grouping `،`, a decimal `.`, a clock `:`) is a character this engine's TOKEN
        // would otherwise hand to `clausePunctuation` as a pause.
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
