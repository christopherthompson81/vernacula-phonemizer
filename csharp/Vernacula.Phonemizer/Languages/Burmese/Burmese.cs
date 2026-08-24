/**
 * Native Burmese / မြန်မာ (my) text phonemizer — canonical IPA. Sino-Tibetan, the Mon-Burmese
 * abugida (Unicode U+1000–U+109F), stored in LOGICAL order (consonant-first). The g2p scans each syllable:
 * base consonant → optional MEDIALS (ျ/ြ palatalise velars ကျ→t͡ɕ + the velar nasal ငြ→ɲ, ွ adds -w- / rounds the
 * inherent rime to ʊ, ှ devoices sonorants မှ→m̥) → the RIME, whose vowel quality depends on the CODA — open, NASAL
 * (killed ŋ/ɲ/n/m or anusvara ံ → ɴ) or CHECKED (killed k/s/t/p → ʔ): -i open→i, nasal→ɪɴ, checked→ɪʔ. Then the
 * TONE (orthographic, rule-derived: low ˨ / high ˥˩ / creaky ˥ˀ, checked = the ʔ coda) is inserted after the
 * nucleus. DEFERRED: intervocalic voicing sandhi (lexical) + minor-syllable reduction.
 */
using System.Text;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Burmese;

/** One syllable: the ONSET (voiceable) + the BODY (glide + rime + tone), plus `start` — the code-point index in
 *  the NFC word where the syllable begins (a legal word-boundary for segmentation). Split so the voicing lexicon
 *  can target the onset without re-parsing. */
public sealed class Syllable
{
    public string Onset = "";
    public string Body = "";
    public int Start;
}

public sealed class BurmesePhonemizer : ILanguage
{
    private const string Dir = "languages/burmese";
    private static BurmeseDef DEF => Manifest.DEF;
    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => DEF.ClausePunctuation;

    private const string VIRAMA = "်", // asat (kills the consonant → coda)
        STACKER = "္", // virama-stacker (U+1039): C1 ္ C2 conjunct — C1 is the coda, C2 the next onset
        ANUSVARA = "ံ",
        VISARGA = "း", // high-tone mark
        DOT_BELOW = "့", // creaky-tone mark
        MEDIAL_Y = "ျ", MEDIAL_R = "ြ", MEDIAL_W = "ွ", MEDIAL_H = "ှ",
        E_SIGN = "ေ", AA_SIGN = "ာ", AA_TALL = "ါ", II_SHORT = "ိ", II_LONG = "ီ",
        U_SHORT = "ု", U_LONG = "ူ";
    private static bool IsConsonant(string c) => DEF.Consonants.ContainsKey(c);

    /**
     * The Burmese tone (Chao letter) for a syllable — ORTHOGRAPHIC, rule-derivable. Explicit marks win: visarga း →
     * high, dot-below ့ → creaky, an asat on the vowel (ော် ) → low. A CLOSED (nasal-coda) syllable defaults to LOW
     * (ခေါင်→kʰàʊɴ, မြန်→mjàɴ). For an OPEN syllable the default is by vowel: ◌ော/◌ဲ → high; a bare inherent vowel or
     * a SHORT ◌ိ/◌ု → creaky; everything else (long ◌ီ/◌ူ, ◌ာ, ◌ေ, ◌ို) → low. A CHECKED syllable (ʔ coda) and a
     * reduced minor syllable carry no tone letter (returns "").
     */
    private static string ToneLetter(
        string vowel, List<string> signs, string coda, bool checkedSyl,
        bool asatOnVowel, bool hasVisarga, bool hasDot)
    {
        if (checkedSyl) return "";
        bool Has(string x) => signs.Contains(x);
        string cat;
        if (hasVisarga) cat = "high";
        else if (hasDot) cat = "creaky";
        else if (asatOnVowel) cat = "low"; // ော် (the asat-on-au low-tone marker)
        else if (coda != "open") cat = "low"; // all closed (nasal) syllables default low — the diphthong is low
        else if (vowel == "au" || vowel == "ai") cat = "high";
        else if (vowel == "inherent" || vowel == "wu") cat = "creaky";
        else if (Has(II_SHORT) && !Has(U_SHORT)) cat = "creaky"; // short ◌ိ (ို=o has both → falls through to low)
        else if (Has(U_SHORT) && !Has(II_SHORT)) cat = "creaky"; // short ◌ု
        else cat = "low"; // long ◌ီ/◌ူ, ◌ာ/ါ, ◌ေ, ◌ို
        return DEF.Tones.TryGetValue(cat, out var t) ? t : "";
    }

    private static readonly JsRe CODA_TAIL = JsRegex.Compile("[ɴʔ]$", "u");

    /** Scan a Burmese word into syllables (onset + body + start). Exposed for the voicing-lexicon builder + segmenter. */
    public static List<Syllable> Syllabify(string word)
    {
        var s = Js.CodePoints(word.Normalize(NormalizationForm.FormC));
        var n = s.Count;
        var syls = new List<Syllable>();
        var i = 0;
        string At(int k) => k >= 0 && k < n ? s[k] : "";

        while (i < n)
        {
            var ch = s[i];
            if (DEF.IndependentVowels.TryGetValue(ch, out var indep))
            {
                // Standalone vowel (ʔ-onset): its default tone, with a trailing visarga း → high / dot-below ့ → creaky.
                // (Rare independent-vowel + killed-consonant coda, ဣန်, is left to the next-syllable scan — a known gap.)
                var start0 = i;
                i++;
                var cat = DEF.IndependentTone.TryGetValue(ch, out var it) ? it : "low";
                while (i < n && (s[i] == VISARGA || s[i] == DOT_BELOW))
                {
                    cat = s[i] == VISARGA ? "high" : "creaky";
                    i++;
                }
                syls.Add(new Syllable
                {
                    Onset = "",
                    Body = indep + (DEF.Tones.TryGetValue(cat, out var tn) ? tn : ""),
                    Start = start0,
                });
                continue;
            }
            if (!IsConsonant(ch))
            {
                i++; // punctuation handled by text(); stray sign → skip
                continue;
            }
            // Onset consonant.
            var start = i;
            var onset = DEF.Consonants[ch];
            i++;
            // Medials: ျ/ြ palatalise (velars → t͡ɕ) else add -j-; ွ labialises; ှ devoices the sonorant.
            var glide = "";
            bool wMedial = false, hasPalatal = false, hasH = false;
            while (i < n && (s[i] == MEDIAL_Y || s[i] == MEDIAL_R || s[i] == MEDIAL_W || s[i] == MEDIAL_H))
            {
                if (s[i] == MEDIAL_Y || s[i] == MEDIAL_R) hasPalatal = true;
                else if (s[i] == MEDIAL_W) wMedial = true;
                else if (s[i] == MEDIAL_H) hasH = true;
                i++;
            }
            // Apply in PHONOLOGICAL order (not text order): the ⟨ှ⟩ devoices the base FIRST, then ⟨ျ⟩/⟨ြ⟩ palatalise —
            // so လျှ → devoiced l̥ → palatal ʃ (lya-ha = /ʃ/), while မျှ → m̥ + j (m̥ja). Native ရှ (j→ʃ) still works.
            if (hasH && DEF.Voiceless.TryGetValue(onset, out var vl)) onset = vl;
            if (hasPalatal) onset = DEF.Palatal.TryGetValue(onset, out var pl) ? pl : onset + "j";
            // Vowel signs → an abstract vowel KEY. Combos: ိ+ု = o, ေ+ာ = au (else the last sign, or inherent).
            var signs = new List<string>();
            while (i < n && DEF.VowelSigns.ContainsKey(s[i]))
            {
                signs.Add(s[i]);
                i++;
            }
            bool Has(string x) => signs.Contains(x);
            var vowel = "inherent";
            if (Has(II_SHORT) && Has(U_SHORT)) vowel = "o"; // ို
            else if (Has(E_SIGN) && (Has(AA_SIGN) || Has(AA_TALL))) vowel = "au"; // ော / ေါ (tall-aa variant U+102B)
            else if (signs.Count > 0) vowel = DEF.VowelSigns[signs[^1]];
            // A ⟨ွ⟩ medial with a vowel sign is a plain -w- glide (ကွေ→kwe).
            if (wMedial && vowel != "inherent") glide = "w";
            // Coda class: anusvara ံ (nasal 'anu'), a killed consonant (base + ်) → its class, else open. An asat ်
            // directly on a vowel (ော်) is a low-TONE marker, NOT a checked coda (ကျော်→t͡ɕɔ̀).
            var coda = "open";
            var asatOnVowel = false;
            if (At(i) == ANUSVARA)
            {
                coda = "anu";
                i++;
            }
            else if (IsConsonant(At(i)) && (At(i + 1) == VIRAMA || (At(i + 1) == DOT_BELOW && At(i + 2) == VIRAMA)))
            {
                // killed consonant (the dot-below creaky mark may sit between the coda letter and its asat: ကန့်).
                coda = DEF.CodaClass.TryGetValue(s[i], out var cc) ? cc : "t";
                i += At(i + 1) == VIRAMA ? 2 : 1; // leave the dot for the tone-mark scan below
            }
            else if (IsConsonant(At(i)) && At(i + 1) == STACKER)
            {
                // Stacked conjunct C1 ္ C2: the upper member C1 is the CODA of THIS syllable (stop → checked ʔ, nasal →
                // ɴ: ဗုဒ္ဓ→boʊʔda, အိန္ဒိယ→ʔeɪndija), and C2 (after the stacker) is the next onset.
                coda = DEF.CodaClass.TryGetValue(s[i], out var cc2) ? cc2 : "t";
                i += 2; // consume C1 + the stacker, leaving C2 as the next onset
            }
            else if (At(i) == VIRAMA)
            {
                asatOnVowel = true;
                i++;
            }
            // ⟨ွ⟩ / a /w/ onset (ဝ) on an inherent-vowel syllable: before an -n/-m/stop coda it ROUNDS the rime to ʊ
            // (ကွန်→kʊɴ, ဝန်→wʊɴ, လွတ်→lʊʔ), but before the velar-nasal -ng coda (လွင်→lwɪɴ, ဝင်→wɪɴ) and in an OPEN
            // syllable (ခွ→kʰwa̰, ဝ→wa) the ⟨ွ⟩ stays a -w- glide over the plain rime. Coda-specific, decided here.
            if (vowel == "inherent" && (wMedial || onset == "w"))
            {
                if (coda == "ng" || coda == "open") { if (wMedial) glide = "w"; } // keep the glide, plain rime
                else vowel = "wu"; // round: ʊɴ / ʊʔ
            }
            // Explicit tone marks (visarga း = high, dot-below ့ = creaky) — may trail the coda, in either order — plus
            // any stray combining sign. Capture the tone marks; skip the rest.
            bool hasVisarga = false, hasDot = false;
            while (i < n && !IsConsonant(s[i]) && !DEF.IndependentVowels.ContainsKey(s[i])
                   && !(CLAUSE_MARK.TryGetValue(s[i], out var cm) && cm.Length > 0))
            {
                if (s[i] == VISARGA) hasVisarga = true;
                else if (s[i] == DOT_BELOW) hasDot = true;
                i++;
            }

            // A bare open syllable (inherent vowel, no coda) that is NOT word-final is a MINOR syllable → reduced [ə]
            // (toneless). Otherwise look up the rime and insert the tone letter after the nucleus, before a ɴ/ʔ coda.
            var minor = vowel == "inherent" && coda == "open" && i < n && IsConsonant(s[i]);
            if (minor)
            {
                syls.Add(new Syllable { Onset = onset, Body = glide + "ə", Start = start });
                continue;
            }
            var rime = Lookup(coda, vowel) ?? Lookup("open", vowel) ?? "a";
            var checkedSyl = rime.EndsWith("ʔ", StringComparison.Ordinal);
            var tone = ToneLetter(vowel, signs, coda, checkedSyl, asatOnVowel, hasVisarga, hasDot);
            var codaChar = CODA_TAIL.IsMatch(rime) ? rime[^1..] : "";
            var nucleus = codaChar.Length > 0 ? rime[..^codaChar.Length] : rime;
            syls.Add(new Syllable { Onset = onset, Body = glide + nucleus + tone + codaChar, Start = start });
        }
        return syls;
    }

    /** `DEF.rimeChart[coda]?.[vowel]` — a missing coda row or vowel column is `undefined`, not a throw. */
    private static string? Lookup(string coda, string vowel) =>
        DEF.RimeChart.TryGetValue(coda, out var row) && row.TryGetValue(vowel, out var v) ? v : null;

    // Intervocalic voicing sandhi (LEXICAL): the per-word `voicing-lexicon.tsv` maps an undiacritized word to a
    // per-syllable flag string ('1' = voice this syllable's onset, via DEF.voicing). Built from the kaikki gold
    // (tools/gen/build-my-voicing.ts); OOV words keep the careful (voiceless) reading — the pass only ADDS voicing.
    // The flags are POSITIONAL (index-aligned to syllabify()), so a change to syllabify() requires REBUILDING the
    // lexicon — a misalignment surfaces as a referee-eval drop (guarded by the my floor in referee-eval.test.ts).
    private static IReadOnlyDictionary<string, string> VOICE => DEF.Voicing;
    // Lazy (registry.ts imports every language eagerly; the TSVs are only read on first Burmese use).
    private static Dictionary<string, string>? VOICING_LEXICON;
    private static readonly object GATE = new();
    private static Dictionary<string, string> VoicingLexicon()
    {
        lock (GATE) return VOICING_LEXICON ??= LoadTsv.LoadTsvMap(Dir, "voicing-lexicon.tsv", optional: true);
    }
    // Pronunciation lexicon (the LEXICAL layer): a per-word canonical-IPA override for words the rule g2p can't derive
    // — lexical rime (ည→i~ɛ), colloquial forms, Pali gemination, loanword ⟨ရ⟩→ɹ. Mined from the kaikki gold
    // (tools/gen/build-my-dict.ts), authoritative over the rules; OOV words fall through to the rule g2p. See docs.
    private static Dictionary<string, string>? DICTIONARY;
    private static Dictionary<string, string> Dictionary_()
    {
        lock (GATE) return DICTIONARY ??= LoadTsv.LoadTsvMap(Dir, "dictionary.tsv", optional: true);
    }

    /** RULE-only word → IPA (syllabify + orthographic tone + voicing sandhi), WITHOUT the pronunciation-lexicon
     *  override. Exposed for tools/gen/build-my-dict.ts: the dict miner must compare the gold against the RULES (else it
     *  reads the dict it is rebuilding and drops every covered entry). */
    public static string PhonemizeWordRules(string word)
    {
        var nfc = word.Normalize(NormalizationForm.FormC);
        var syls = Syllabify(nfc);
        if (VoicingLexicon().TryGetValue(nfc, out var flags) && flags.Length > 0)
        {
            for (var k = 0; k < syls.Count && k < flags.Length; k++)
            {
                if (flags[k] == '1' && VOICE.TryGetValue(syls[k].Onset, out var v) && v.Length > 0)
                    syls[k].Onset = v;
            }
        }
        return string.Concat(syls.Select(s => s.Onset + s.Body)).Normalize(NormalizationForm.FormC);
    }

    /** One segmented Burmese WORD → canonical IPA: the authoritative lexicon override, else the rule engine. */
    private static string PhonemizeSubword(string word)
    {
        // JS `lex ? lex : rules(word)` — a blank/empty dict value is FALSY and falls through to the rules.
        var lex = Dictionary_().TryGetValue(word.Normalize(NormalizationForm.FormC), out var l) ? l : null;
        return !string.IsNullOrEmpty(lex) ? lex : PhonemizeWordRules(word);
    }

    // Word SEGMENTATION: Burmese is spaceless, so a text run is one token that must be split into words before the
    // per-word voicing lexicon can fire. DAG maximal-match over seg-words.txt (multi-σ headwords), with word
    // boundaries constrained to SYLLABLE starts (syllabify().start). Lazy-loaded. A single word segments to itself
    // (so the per-word referee eval is unaffected); an unknown run coalesces into one token and still phonemizes.
    private static (HashSet<string> Set, int MaxLen)? SEG;
    private static (HashSet<string> Set, int MaxLen) SegWords()
    {
        lock (GATE) return SEG ??= Segment.LoadSegWords(Dir);
    }

    /**
     * Segment a spaceless Burmese run into words. Word boundaries are constrained to syllable starts (so the DAG never
     * splits mid-syllable). A FULL dictionary cover (every part is a known word) is trusted and split — the per-word
     * voicing lexicon then applies (like Thai). A PARTIAL cover (a dict word next to an OOV remainder) is the risky
     * case: peeling the OOV fragment and re-syllabifying it standalone can make a would-be word-internal MINOR syllable
     * word-final and lose its [ə] (ကစကား → the leading က must stay reduced kə, not become full ka). For those we accept
     * the split ONLY if it preserves every syllable BODY (whole-run vs concatenated per-part), else keep the run WHOLE.
     * So segmentation only ever IMPROVES the segmental output, never regresses it.
     */
    public static List<string> SegmentWord(string token)
    {
        var (set, maxLen) = SegWords();
        var cs = Js.CodePoints(token.Normalize(NormalizationForm.FormC));
        if (set.Count == 0 || cs.Count == 0) return new List<string> { token };
        var sylls = Syllabify(string.Concat(cs)); // whole-run pass, reused for both the boundaries and the safety check
        var bound = new HashSet<int> { cs.Count };
        foreach (var syl in sylls) bound.Add(syl.Start);
        var parts = Segment.SegmentByDag(cs, set, maxLen, bound);
        if (parts.Count <= 1 || parts.All(w => set.Contains(w))) return parts; // single word, or a full dictionary cover
        // ⚠ THE JOIN SEPARATOR IS U+0001 AND IT IS LOAD-BEARING — the comparison is of the syllable SEQUENCE,
        // not of the concatenated string, so two different boundary placements with the same total text must
        // NOT compare equal. In the TypeScript it is a bare control character, invisible in every editor;
        // written as an escape here (and now there too — see the paired TS fix).
        var whole = string.Join("\u0001", sylls.Select(s => s.Body));
        var split = string.Join("\u0001", parts.SelectMany(p => Syllabify(p).Select(s => s.Body)));
        return whole == split ? parts : new List<string> { token }; // split changes a syllable body (lost minor-ə) → keep whole
    }

    /** One Burmese TOKEN → IPA: segment the spaceless run into words, phonemize each (voicing per word), space-join. */
    public static string PhonemizeWord(string token) =>
        string.Join(" ", SegmentWord(token).Select(PhonemizeSubword).Where(w => w != ""));

    // Burmese digits ၀-၉ (U+1040–1049) sit inside the U+1000–109F block, so they would be swallowed by the
    // word group; they are matched with ASCII digits instead and normalised before composition.
    private const string MY_DIGITS = "\u1040-\u1049";
    // The letter class STOPS BEFORE U+104A. U+104A ၊ and U+104B ။ are Burmese's own phrase and sentence
    // marks and they sit inside the Myanmar block, so a class written as a raw block range swallows them —
    // the alternation tries the letter branch first and the clause group below could never be reached. Every
    // sentence boundary in Burmese text was being dropped silently. Found by auditing all engines whose TOKEN
    // class is a raw Unicode range, after the Greek run reported the same shape for U+0387 ANO TELEIA.
    private static readonly JsRe TOKEN = JsRegex.Compile(
        $"([\u1000-\u103F\u104C-\u109F\ua9e0-\ua9f9]+)|([0-9{MY_DIGITS}]+)|([။၊.?!,])", "gu");

    public string Text(string rawInput)
    {
        // everything the g2p cannot read is rewritten to Burmese words FIRST — see normalize.ts for
        // the ordered steps and the two negative results.
        var input = Normalize.NormalizeBurmese(rawInput);
        var (sink, finish) = Clauses.ClauseSink();
        var cursor = 0;
        foreach (var m in TOKEN.Matches(input))
        {
            // This engine scans with its own exec loop rather than assembleClauses, so it needs the
            // gap pass explicitly — without it embedded Latin (a brand name, acronym) is dropped.
            if (m.Index > cursor) Clauses.EmitUnclaimed(input[cursor..m.Index], sink);
            cursor = m.Index + m.Length;
            if (m.Groups[1].Success && m.Groups[1].Value.Length > 0) sink.Emit(PhonemizeWord(m.Groups[1].Value));
            else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
            {
                // Digits (ASCII or Burmese ၀-၉) → Burmese number words, then phonemize each.
                var ascii = string.Concat(Js.CodePoints(m.Groups[2].Value).Select(c =>
                {
                    var cp = Js.CodePointAt0(c);
                    return cp >= 0x1040 && cp <= 0x1049 ? Js.NumberToString(cp - 0x1040) : c;
                }));
                // One token: the numeral is a single Burmese word, so the segmenter and the compound
                // voicing apply across it (100 renders [təja˨], not [tɪʔ ja˨]).
                // ⚠ ABOVE 2^53 THE NUMBER USED TO VANISH ENTIRELY. `numberToWords` correctly refuses to
                // compose an integer whose low digits the float has already lost — but it returns the ASCII
                // digits, and this g2p has no rules for Latin, so the numeral was silently DROPPED and the
                // sentence still scanned. Read it out digit-at-a-time instead: separate words, because the
                // digits are being read rather than composed (see spellDigits).
                var n = Js.Number(ascii);
                if (double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d && n >= 0)
                    sink.Emit(PhonemizeWord(Numbers.NumberToWords(n)));
                else
                    foreach (var wd in Numbers.SpellDigits(ascii).Split(' ')) sink.Emit(PhonemizeWord(wd));
            }
            else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
            {
                if (CLAUSE_MARK.TryGetValue(m.Groups[3].Value, out var mk) && mk.Length > 0) sink.Pause(mk);
            }
        }
        if (cursor < input.Length) Clauses.EmitUnclaimed(input[cursor..], sink);
        return finish();
    }

    /** Build the Burmese phonemizer. */
    public static ILanguage CreateBurmese() => new BurmesePhonemizer();

    internal static void RegisterSelf() => Registry.Register("burmese", CreateBurmese);
}
