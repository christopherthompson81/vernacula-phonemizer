/**
 * English-native canonical converter: CMUdict ARPABET → canonical IPA (the en divestment convention).
 * Ported from src/languages/english/englishArpabet.ts — see that file for the corpus evidence.
 */
using System.Text;
using System.Text.Json.Serialization;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.English;

public sealed class ConditionalVowelPair
{
    public string Unstressed { get; init; } = "";
    public string Stressed { get; init; } = "";
}

public sealed class ConditionalVowelIy
{
    public string BeforeR { get; init; } = "";
    public string Unstressed { get; init; } = "";
    public string Stressed { get; init; } = "";
}

public sealed class ConditionalVowelUw
{
    public string BeforeR { get; init; } = "";
    public string Default { get; init; } = "";
}

public sealed class ConditionalVowels
{
    // ⚠ EXPLICIT JSON NAMES. The loader applies a camelCase naming policy, which does NOT leave an all-caps
    // ARPABET key alone — so `AH`/`ER`/`IY`/`UW` silently deserialize to their defaults and every vowel they
    // own comes out as the EMPTY STRING, with nothing thrown.
    [JsonPropertyName("AH")] public ConditionalVowelPair AH { get; init; } = new();
    [JsonPropertyName("ER")] public ConditionalVowelPair ER { get; init; } = new();
    [JsonPropertyName("IY")] public ConditionalVowelIy IY { get; init; } = new();
    [JsonPropertyName("UW")] public ConditionalVowelUw UW { get; init; } = new();
}

/** The ARPABET→IPA correspondence DATA (from english.jsonc's `arpabet` block). The allophony ALGORITHM
 *  below reads these values; a different English variety supplies its own `map` / `conditionalVowels`. */
public sealed class ArpabetDef
{
    /** ARPABET phone → IPA: consonants + simple (unconditional) vowels. */
    public IReadOnlyDictionary<string, string> Map { get; init; } = new Dictionary<string, string>();
    /** The ARPABET vowel bases (a fixed property of the notation) — used to locate nuclei. */
    public IReadOnlyList<string> Vowels { get; init; } = Array.Empty<string>();
    /** Vowels resolved by stress (AH, ER) or a following R (IY, UW). */
    public ConditionalVowels ConditionalVowels { get; init; } = new();
}

public static class EnglishArpabet
{
    private readonly record struct Phone(string Base, int Stress);

    private static readonly JsRe PHONE = JsRegex.Compile("^([A-Z]+)([0-2])?$");

    /**
     * A WORD HAS EXACTLY ONE PRIMARY STRESS. Demote every primary but the LAST to secondary.
     * Ported from englishArpabet.ts — see that file for the full measurement.
     *
     * ⚠ THIS WAS ENFORCED ON THE OOV PATHS AND NOT ON THE DICTIONARY. 1,029 `g2p-dict.tsv` rows carry more
     * than one stress-1 nucleus, because CMUdict declines to resolve prefixed forms, compounds and
     * initialisms (`AA1 R CH B IH1 SH AH0 P`, `N AY1 N T IY1 N`), and the flat lexicon rendered them
     * verbatim — so 372 words came out with two or three primary marks in one group. `EnforceSinglePrimary`
     * had always run on the n-gram and tagger output, which is why it never showed there.
     *
     * ⚠ THE LAST, AND THIS IS THE ONLY PLACE THE CHOICE IS MADE — `EnforceSinglePrimary` no longer demotes,
     * so the predictor and the dictionary cannot disagree. Gold resolves CMUdict's unresolved rows to the
     * later element (81:24 on the 150 prefixed rows, 7 of 7 on the teen numerals: `nˌIntˈin`, `θˌɜɹtˈin`).
     * Over 89,411 words against gold: +341 / −106, net +235. Keeping the first is +37 / −0, and splitting
     * the two paths was +147 / −0 but reintroduced the seam.
     */
    public static List<string> SinglePrimary(IReadOnlyList<string> phones)
    {
        var last = -1;
        for (var i = 0; i < phones.Count; i++)
            if (PRIMARY_DIGIT.IsMatch(phones[i])) last = i;
        // ⚠ ALWAYS A FRESH LIST, including the no-primary case: EnforceSinglePrimary writes into what it
        // gets back, so handing the input straight through would mutate a caller's phones in place.
        var outp = new List<string>(phones.Count);
        for (var i = 0; i < phones.Count; i++)
            outp.Add(last >= 0 && i != last && PRIMARY_DIGIT.IsMatch(phones[i])
                ? PRIMARY_DIGIT.Replace(phones[i], "2") : phones[i]);
        return outp;
    }

    private static readonly JsRe PRIMARY_DIGIT = JsRegex.Compile("1$");

    private static readonly JsRe SUFFIX_IST = JsRegex.Compile("ists?$");
    private static readonly JsRe SUFFIX_SIS = JsRegex.Compile("is$");
    private static readonly JsRe SUFFIX_AGE = JsRegex.Compile("ages?$");

    /**
     * CMUdict WRITES `AH0` WHERE THE VOWEL IS `/ɪ/`, in three suffixes. Re-base those to `IH0`.
     * Ported from englishArpabet.ts — see that file for the referee evidence and the two rejected designs.
     *
     * ⚠ RE-BASED TO `IH`, NOT ROUTED THROUGH `IsBarredI`, and the difference is the symbol. `IsBarredI`
     * yields the weak vowel `ᵻ`, which is right for the INFLECTIONAL `-es`/`-ed` — and misaki's gold agrees
     * there, writing `ᵻ` itself. Gold has that symbol and deliberately does NOT use it for `-ist`: it writes
     * a full `ɪ`. Building this as an `IsBarredI` arm was measured at −486 exact against gold with 0 gained.
     *
     * ⚠ AND IT IS THE SUFFIX'S OWN VOWEL, THE LAST ONE — scanning every AH0 fired on the prefix instead
     * (`assist` → *ɪsˈɪst, `aphesis` → *ˈæfɪsɪs), 58 regressions.
     *
     * ⚠ `-is`, NOT `-sis`. The first version tested `/sis$/` and missed every other spelling of the same
     * ending, so `mastitis` read *mæstaɪtəs while `analysis` was right one row away. The part it missed is
     * the stronger half: 35 of 36 referee rows `ɪ` (97.2%) with ZERO `ə`, against 9 of 12 for `-sis`.
     *
     * ⚠ `-ness` AND `-less` ARE DELIBERATELY ABSENT. Gold writes `ɪ` in both and they are the LARGEST
     * family in the class, but the referee says `ə` — 81.0% over 100 `-ness` rows, 74.4% over 43 `-less`
     * rows — so the schwa already written there is right and the reference is wrong.
     */
    private static void RebaseSuffixIh(List<Phone> P, string word)
    {
        // ⚠ THE SUFFIX'S OWN VOWEL, LOCATED FROM THE END. Taking "the last vowel" instead split a
        // singular from its own plural: `package` (P AE1 K AH0 JH) was reached and `packages`
        // (P AE1 K AH0 JH AH0 Z) was not, because the inflection has moved past the -age vowel. Gold has
        // no entry for `packages`, so the score was identical either way — only the invariant catches it.
        var n = P.Count;
        string At(int i) => i >= 0 && i < P.Count ? P[i].Base : "";
        bool Unstressed(int i) => i >= 0 && i < P.Count && P[i].Stress == 0;
        var vi = -1;
        if (SUFFIX_IST.IsMatch(word))
        {
            if (At(n - 2) == "S" && At(n - 1) == "T") vi = n - 3;
            else if (At(n - 3) == "S" && At(n - 2) == "T" && At(n - 1) == "S") vi = n - 4;
        }
        else if (SUFFIX_SIS.IsMatch(word))
        {
            if (At(n - 1) == "S") vi = n - 2;
        }
        else if (SUFFIX_AGE.IsMatch(word))
        {
            if (At(n - 1) == "JH") vi = n - 2;
            // … AH0 JH <epenthetic vowel> Z — the plural, where the inflection sits past the -age vowel
            else if (At(n - 3) == "JH" && At(n - 1) == "Z" && Unstressed(n - 2)) vi = n - 4;
        }
        if (vi < 0 || vi >= P.Count) return;
        var p = P[vi];
        if (p.Base == "AH" && p.Stress == 0) P[vi] = p with { Base = "IH" };
    }

    /**
     * CMUdict's final `-y` is `IY0` 7,219 times and `IY2` 198 times, in the same slot. Demote the 198.
     * Ported from englishArpabet.ts — see that file for the full evidence and the two narrowings.
     *
     * `city` is `S IH1 T IY0` and `ability` is `AH0 B IH1 L AH0 T IY2`: the same unstressed FLEECE vowel,
     * same environment, different digit. Upstream noise rather than a convention, and misaki's gold agrees
     * with the 97% — of the 123 `-y`-spelled `IY2` rows it covers, it leaves 121 unstressed.
     *
     * ⚠ ONLY `IY`, AND ONLY ON A `-y` SPELLING. A blanket rule is WRONG: gold KEEPS the 2° on 94–100% of
     * final `EY`/`AY`/`OY`/`AW` (`airway`, `alibi`, `aircrew`), and final `IY2` NOT spelled `-y` is only
     * 67% unstressed because those are `-ee` compounds whose last syllable is a free morpheme
     * (`bumblebee`, `jubilee`, `oversee`). No `-key` exception: 15 of the 17 `-key` rows are SURNAMES
     * whose CMUdict twins are `IY0`, and it would buy nothing anyway — `latchkey`/`turnkey` carry the
     * `IY2` adjacent to the primary, so the clash rule drops their mark before this rule is reachable.
     *
     * Demoting the DIGIT rather than suppressing the mark is deliberate: the digit also selects the vowel
     * (`iː` vs `i`) and gates the flap, so `ability` becomes `əbˈɪlᵻt̬i` — all three consistent.
     */
    private static void DemoteFinalIy2(List<Phone> P, string word)
    {
        if (P.Count == 0) return;
        var last = P[^1];
        if (word.EndsWith("y", StringComparison.Ordinal) && last.Base == "IY" && last.Stress == 2)
            P[^1] = last with { Stress = 0 };
    }

    /** One CMUdict phone (e.g. "AH0", "T", "ER1") → {base, stress}. */
    private static Phone Split(string phone)
    {
        var m = PHONE.Match(phone);
        return new Phone(
            m.Success ? m.Groups[1].Value : phone,
            m.Success && m.Groups[2].Success && m.Groups[2].Value.Length > 0 ? int.Parse(m.Groups[2].Value, System.Globalization.CultureInfo.InvariantCulture) : -1);
    }

    private static readonly JsRe ED_ES = JsRegex.Compile("(ed|es)$");
    private static readonly JsRe ES = JsRegex.Compile("es$", "");
    /** The sibilants, before which the `-es` suffix takes an epenthetic vowel at all. */
    private static readonly IReadOnlySet<string> SIBILANT =
        new HashSet<string>(new[] { "S", "Z", "SH", "ZH", "CH", "JH" }, StringComparer.Ordinal);
    private static readonly JsRe ITY = JsRegex.Compile("(it|iti|ities|ety|ities)y?$");
    private static readonly JsRe IBLE = JsRegex.Compile("ibl[ey]?$");
    private static readonly JsRe LATINATE_PREFIX = JsRegex.Compile("^(be|de|re|se|pre)[^aeiouy]");

    /**
     * Is the `R` after an `IY` the ONSET of a following element rather than a coda on the same syllable?
     *
     * The `BeforeR` laxing is right for a coda and wrong across a morpheme boundary: `career` is kɚˈɪɹ, but
     * `copyright` is copy + right and its IY belongs to `copy` — laxing gave kʰˈɑːpɪɹˌaᶦt, "copperite".
     * Prevocalic-r is NOT the discriminator, so this is morphological: measured against misaki gold over
     * every dict row with IY immediately before R, gold writes `ɪɹ` on 28 of 28 codas AND on 20 of 34
     * onsets (`careerism`, `experience`, `serious`). The 14 it writes `iɹ` on are all a productive prefix
     * or compound-initial element ending in /iː/ before an ⟨r⟩- or ⟨wr⟩-initial base.
     * The ⟨wr⟩ half is load-bearing: `rewriting` has no ⟨r⟩ after the prefix, because ⟨wr⟩ spells /r/.
     * The test is on the WHOLE WORD, so it exempts every IY-before-R in a matching word rather than only
     * the one at the boundary; of the 37 dict rows it fires on, none has a second such site.
     * See the TS twin in englishArpabet.ts for the full scoring.
     */
    private static readonly JsRe IY_PREFIX_BEFORE_R = JsRegex.Compile("^(?:copy|deoxy|re|pre|de)(?:r|wr)");

    /** Should this unstressed vowel-phone at index `vi` (nucleus number `ni`) surface as the weak vowel ᵻ?
     *  Cleanroom weak-vowel-merger rule from the WORD's morphology (public GenAm phonology). */
    private static bool IsBarredI(string word, IReadOnlyList<Phone> P, int vi, int ni, int nucleiCount)
    {
        var (bas, stress) = P[vi];
        if (stress > 0 || (bas != "IH" && bas != "AH")) return false;
        if (ED_ES.IsMatch(word)
            && ni == nucleiCount - 1
            && vi + 1 < P.Count
            && vi > 0
            && (P[vi - 1].Base == "T" || P[vi - 1].Base == "D"))
            return true;
        // -es plural / 3sg after a SIBILANT (services, offices, chances, bridges → ᵻz).
        // ⚠ The Greek /iːz/ plurals need no exclusion: CMUdict writes them with IY, which the base test
        // above already refuses. See src/languages/english/englishArpabet.ts.
        if (ES.IsMatch(word)
            && ni == nucleiCount - 1
            && vi > 0
            && vi + 1 < P.Count
            && P[vi + 1].Base == "Z"
            && SIBILANT.Contains(P[vi - 1].Base))
            return true;
        if (ITY.IsMatch(word) && vi + 1 < P.Count && P[vi + 1].Base == "T")
            return true;
        if (IBLE.IsMatch(word) && vi + 1 < P.Count && P[vi + 1].Base == "B")
            return true;
        if (ni == 0 && LATINATE_PREFIX.IsMatch(word)) return true;
        return false;
    }

    /** Build the ARPABET→IPA converter from a correspondence def. The allophony (flap/aspirate/dark-l/ŋ/ʲ,
     *  stress marking, weak-vowel merger) is the shared engine; `def` supplies the variety-specific IPA
     *  values. */
    /// <param name="syllabic">
    /// Word → the indices of its ARPABET phones that are a SYLLABIC consonant's schwa slot
    /// (en-syllabic.tsv). Passed in rather than loaded here, because this class is DATA-FREE on
    /// purpose. Omitted (the OOV tagger's path) means no word has syllabic slots — the prior
    /// behaviour. Mirrors englishArpabet.ts.
    /// </param>
    public static Func<IReadOnlyList<string>, string, string> MakeArpabetToIpa(
        ArpabetDef def, IReadOnlyDictionary<string, IReadOnlyList<int>>? syllabic = null)
    {
        var map = def.Map;
        var cv = def.ConditionalVowels;
        var VOWELS = new HashSet<string>(def.Vowels, StringComparer.Ordinal);
        // The TRUE diphthongs, for the clash exception below — NOT OW/EY. See the TS.
        // The vowels gold marks on an OPEN final syllable next to the primary. Measured, not chosen:
        // OY 10/10, AW 8/8, EY 65/71, AY 11/12, AO 10/11, UW 22/33 against OW 22/104, IY 9/55, AA 5/15.
        // See englishArpabet.ts for the full re-measurement of this rule against the reference.
        var STRONG_OPEN_FINAL = new HashSet<string>(new[] { "EY", "AY", "OY", "AW", "AO", "UW" }, StringComparer.Ordinal);

        /**
         * Diphthongs that take an r-coloured offglide — the `-ower`, `-ire`, `-ayer`, `-oer` nucleus.
         * ARPABET writes these as TWO nuclei (`AW2 ER0`) so the clash rule counts the site as "not the
         * final syllable" and drops its mark; phonetically it is one syllable, and gold marks it 63 times
         * out of 64 (AY 28/29, AW 20/20, OW 8/8, EY 7/7) against 60% at every other clash site. ⚠ The
         * monophthongs are NOT in this set: `IY+ER0`/`UW+ER0` are the same shape on paper and gold marks
         * neither. See englishArpabet.ts for the measurement.
         */
        var R_OFFGLIDE_DIPHTHONG =
            new HashSet<string>(new[] { "AY", "AW", "OW", "EY", "OY" }, StringComparer.Ordinal);

        /**
         * Convert a CMUdict ARPABET phone list → canonical IPA (before-nucleus stress + cleanroom GenAm
         * allophony).
         */
        return (phones, word) =>
        {
            word ??= "";
            // ⚠ WHICH PHONES THE DEMOTION TOUCHED, because the clash rule below must not delete those marks.
            // It exists to drop a 2° CMUdict WROTE on an ordinary syllable next to the primary (`zorro`,
            // `aalto`); a 2° this engine just created from a 1° is the opposite case — the dictionary called
            // that syllable strong, and deleting the mark leaves `nineteen` as `naᶦntˈiːn` with nothing on
            // `nine`, where gold has `nˌIntˈin`. Worth +55 exact on its own.
            var resolved = SinglePrimary(phones);
            var demoted = new HashSet<int>();
            for (var i = 0; i < phones.Count; i++) if (phones[i] != resolved[i]) demoted.Add(i);
            var P = resolved.Select(Split).ToList();
            DemoteFinalIy2(P, word);
            RebaseSuffixIh(P, word);
            // The slots whose schwa is not a schwa but the sonorant after it being syllabic.
            IReadOnlyList<int>? sylSlots = null;
            syllabic?.TryGetValue(word, out sylSlots);
            var pendingSyllabic = false;
            var nucleiIdx = new List<int>();
            for (var i = 0; i < P.Count; i++) if (VOWELS.Contains(P[i].Base)) nucleiIdx.Add(i);
            var nucleusNum = new Dictionary<int, int>();
            for (var ni = 0; ni < nucleiIdx.Count; ni++) nucleusNum[nucleiIdx[ni]] = ni;
            var primaryNi = nucleiIdx.FindIndex(vi => P[vi].Stress == 1);

            var outSb = new StringBuilder();
            for (var i = 0; i < P.Count; i++)
            {
                var (bas, stress) = P[i];
                var nextIsR = i + 1 < P.Count && P[i + 1].Base == "R";
                var nextIsV = i + 1 < P.Count && VOWELS.Contains(P[i + 1].Base);
                // REDUCED SLOT — misaki writes `ᵊ` and we write one of TWO things, because `ᵊ` is not
                // one phonological fact: in 81% of the slots the sonorant is a CODA and carries the
                // syllable (`able` → ˈeᶦbɫ̩), in 19% it is the ONSET of the next syllable and cannot
                // be syllabic (`accompany` → əkʰˈʌmpə̆ni). So `ᵊ` is a REDUCED SCHWA, not a
                // syllabicity mark; canonical IPA has both and KokoroFormat maps each to ᵊ. See the TS.
                if (VOWELS.Contains(bas) && sylSlots is not null && sylSlots.Contains(i))
                {
                    var son = i + 1;
                    var sonIsOnset = son + 1 < P.Count && VOWELS.Contains(P[son + 1].Base);
                    if (sonIsOnset) { outSb.Append("ə\u0306"); continue; }   // extra-short schwa
                    pendingSyllabic = true;
                    continue;
                }
                if (VOWELS.Contains(bas))
                {
                    var ni = nucleusNum[i];
                    var mark = stress == 1 ? "ˈ" : stress == 2 ? "ˌ" : "";
                    // ⚠ The exception (closed final syllable on a true diphthong) and all three of its
                    // conditions are load-bearing — see the TS for the row-count measurement behind each.
                    if (stress == 2 && !demoted.Contains(i) && primaryNi >= 0 && Math.Abs(ni - primaryNi) == 1
                        && !(ni == nucleiIdx.Count - 1
                             && (i < P.Count - 1 || STRONG_OPEN_FINAL.Contains(bas)))
                        // ⚠ And not an r-coloured offglide, which ARPABET spells as two nuclei and is one
                        // syllable — see R_OFFGLIDE_DIPHTHONG for the 64-site measurement against gold.
                        && !(R_OFFGLIDE_DIPHTHONG.Contains(bas)
                             && i + 1 < P.Count && P[i + 1].Base == "ER" && P[i + 1].Stress == 0))
                        mark = "";
                    outSb.Append(mark);
                    if (bas == "AH" && IsBarredI(word, P, i, ni, nucleiIdx.Count)) outSb.Append('ᵻ');
                    else if (bas == "IH" && IsBarredI(word, P, i, ni, nucleiIdx.Count)) outSb.Append('ᵻ');
                    else if (bas == "AH") outSb.Append(stress <= 0 ? cv.AH.Unstressed : cv.AH.Stressed);
                    else if (bas == "ER") outSb.Append(stress <= 0 ? cv.ER.Unstressed : cv.ER.Stressed);
                    else if (bas == "IY") outSb.Append(nextIsR && !IY_PREFIX_BEFORE_R.IsMatch(word) ? cv.IY.BeforeR : stress <= 0 ? cv.IY.Unstressed : cv.IY.Stressed);
                    else if (bas == "UW") outSb.Append(nextIsR ? cv.UW.BeforeR : cv.UW.Default);
                    else outSb.Append(map.TryGetValue(bas, out var mv) ? mv : bas);
                    if (bas == "IY" && nextIsV) outSb.Append('ʲ');
                    continue;
                }
                // SYLLABIC CONSONANT, part 2 of 2 — takes the mark and skips the allophony below:
                // the flap rule would look for a following vowel that no longer exists, and dark-l is
                // already what a syllabic /l/ is.
                if (pendingSyllabic)
                {
                    pendingSyllabic = false;
                    outSb.Append(bas == "L" ? "ɫ" : (map.TryGetValue(bas, out var sv) ? sv : bas)).Append('\u0329');
                    continue;
                }
                if (bas == "N" && i + 1 < P.Count && (P[i + 1].Base == "K" || P[i + 1].Base == "G"))
                {
                    outSb.Append('ŋ');
                    continue;
                }
                if ((bas == "T" || bas == "D") && i > 0 && i + 1 < P.Count)
                {
                    var prev = P[i - 1];
                    var next = P[i + 1];
                    // ⚠ `== 0`, NOT `!= 1` — stress 2 is not unstressed — and it reads the DICTIONARY's
                    // digit, not the post-clash stress. See englishArpabet.ts for both measurements.
                    if ((VOWELS.Contains(prev.Base) || prev.Base == "R") && VOWELS.Contains(next.Base) && next.Stress == 0)
                    {
                        outSb.Append(bas == "T" ? "t̬" : "d̬");
                        continue;
                    }
                }
                if (bas == "P" || bas == "T" || bas == "K")
                {
                    var prevBase = i > 0 ? P[i - 1].Base : "#";
                    Phone? next = i + 1 < P.Count ? P[i + 1] : null;
                    var onset = i == 0 || VOWELS.Contains(prevBase); // word-initial or after a vowel (starts a syllable)
                    if (prevBase != "S" && onset && next is not null && VOWELS.Contains(next.Value.Base) && next.Value.Stress >= 1)
                    {
                        outSb.Append(bas == "P" ? "pʰ" : bas == "T" ? "tʰ" : "kʰ");
                        continue;
                    }
                }
                if (bas == "L" && !(i + 1 < P.Count && VOWELS.Contains(P[i + 1].Base)))
                {
                    outSb.Append('ɫ');
                    continue;
                }
                outSb.Append(map.TryGetValue(bas, out var mv2) ? mv2 : bas);
            }
            return outSb.ToString();
        };
    }
}
