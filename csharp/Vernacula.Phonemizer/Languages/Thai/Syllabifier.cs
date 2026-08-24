/**
 * Thai SYLLABIFIER — the structural half of the g2p: the leading-vowel reorder, the อักษรนำ leaders, the
 * inherent-vowel (schwa) algorithm, syllable segmentation and the computed tone. `g2p.ts` renders what this
 * produces. The TS file carries no docblock of its own (it opens on its imports); this one names it so the
 * C# file is not the only one in the directory without a header.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Thai;

// A vowel UNIT carries its graphemes plus an optional trailing GLIDE consonant:
// ไ/ใ (aj) and ำ (am) are vowel + a glide (j / m) that, like any consonant, fills
// the coda slot so a FOLLOWING consonant opens a new syllable (ใหม่ → hajmaʔ, ม is
// an onset). The centering diphthongs เีย/เือ/ัว (ia̯/ɯa̯/ua̯) are pure vowels — no glide.
//
// ⚠ ONE CLASS, NOT A DISCRIMINATED UNION. The TS type is `{kind:"C"; g; ph} | {kind:"V"; gs; glide?}` and
// its narrowing is what keeps the two halves apart; C# has no structural union, so `Kind` is checked
// explicitly at every site the TS narrows at, and the unused half is left at its default.
public sealed class ThaiUnit
{
    public required string Kind { get; init; } // "C" | "V"
    public string G { get; init; } = "";       // C: the consonant grapheme
    public string Ph { get; init; } = "";      // C: its onset phoneme class
    public IReadOnlyList<string> Gs { get; init; } = [];  // V: the vowel graphemes
    public string? Glide { get; init; }        // V: "j" | "m", else null
}

/** One scanned syllable: `nucleus` is its vowel unit index (where the tone glyph is
 *  injected — BEFORE the vowel, so the engine repositions it after the syllabic vowel,
 *  Punjabi-style, without disrupting coda/glottal rules) and `tone` its lexical tone
 *  (undefined for an onsetless run). */
public sealed class ThaiSyllableScan
{
    public required int Nucleus { get; init; }
    public required string? Tone { get; init; }
    public required List<string> OnsetCs { get; init; } // onset consonant graphemes (may include a silent ห/อ leader)
    public required ThaiUnit NucUnit { get; init; }     // the nucleus unit (C = inherent vowel, V = written vowel)
    public required string CodaG { get; init; }         // coda consonant grapheme ("" if none)
    public required bool Long { get; init; }
    public required string? Fate { get; init; }
}

public sealed class ThaiPrepResult
{
    public required List<ThaiUnit> Units { get; init; }
    public required Dictionary<int, string> Fates { get; init; }
    public required List<string?> UnitMark { get; init; }
    public required List<bool> ShortMark { get; init; }
}

public static class Syllabifier
{
    /** Thai leading (pre-posed) vowels: เ แ โ ใ ไ (U+0E40-U+0E44). */
    private static readonly JsRe THAI_LEADING_VOWEL_RE = JsRegex.Compile("[เ-ไ]", "");

    /** Thai consonant ก-ฮ (U+0E01-U+0E2E). */
    private static bool IsThaiConsonant(string c) =>
        string.CompareOrdinal(c, "ก") >= 0 && string.CompareOrdinal(c, "ฮ") <= 0;

    /**
     * Irregular Thai words whose ORTHOGRAPHY does not yield the right pronunciation through the regular
     * grapheme rules — rewritten to an orthographic form that DOES (the rewrite is captured
     * for tone BEFORE stripThaiMarks). ก็ = /kɔ̂ː/ ("also / then", extremely common): its
     * mai-taikhu ็ is lexicalised, not the usual vowel-shortener, and stripThaiMarks would
     * drop it leaving a bare ก. ก่อ gives the right result — mid-class + mai-ek → low tone,
     * อ → ɔː. Applied only TOKEN-INITIALLY so mid-word ก็ (เก็บ → kèp) is untouched.
     */
    private static readonly (string From, string To)[] THAI_LEXICAL_FIXUPS = { ("ก็", "ก่อ") };

    public static string ThaiLexicalFixup(string text)
    {
        foreach (var (from, to) in THAI_LEXICAL_FIXUPS)
        {
            if (text.StartsWith(from, StringComparison.Ordinal)) return to + text[from.Length..];
        }
        return text;
    }

    public static string ReorderThaiLeadingVowels(string text)
    {
        if (!THAI_LEADING_VOWEL_RE.IsMatch(text)) return text;
        var cs = Js.CodePoints(text).ToList();
        string At(int k) => k >= 0 && k < cs.Count ? cs[k] : "";
        for (var i = 0; i < cs.Count - 1; i++)
        {
            if (!(THAI_LEADING_VOWEL_RE.IsMatch(cs[i]) && IsThaiConsonant(cs[i + 1])))
                continue;
            // A silent ห leader before a raisable sonorant is part of the ONSET (หม/หน/หว…),
            // so the leading vowel belongs AFTER both (ใหม่ → ห·ม·ใ → màj, not ห·ใ·ม). Rotate
            // [v, ห, sonorant] → [ห, sonorant, v]; the silent ห is then dropped downstream.
            if (cs[i + 1] == "ห" && THAI_H_RAISABLE.Contains(At(i + 2)))
            {
                var v = cs[i];
                cs[i] = cs[i + 1];
                cs[i + 1] = cs[i + 2];
                cs[i + 2] = v;
                i += 2; // skip past ห and the sonorant onset
                continue;
            }
            // อักษรนำ under a เ frame: เ + high/mid LEADER + non-cluster sonorant + trailing อ. The leader
            // takes an inherent short 'a' and the เ…อ frame belongs to the sonorant's syllable, which the
            // leader then raises (เสนอ → ส·น·เ·อ → sa.nɤ̌ː, not seː.nɔː). Rotate [เ, C1, C2] → [C1, C2, เ].
            // Gated on the trailing อ, which forces the sonorant to be an ONSET (distinguishes เสนอ from
            // เบน, where น is a coda and เ belongs to the single onset บ). Non-cluster sonorant only, so a
            // real เ-cluster (เกลอ, เปรอะ) is untouched (its C2 ∈ ร/ล/ว).
            var c1cls = ThaiTone.ThaiConsonantClass(cs[i + 1]);
            if (cs[i] == "เ" &&
                (c1cls == "high" || c1cls == "mid") &&
                THAI_LEADER_SONORANT.Contains(At(i + 2)) &&
                At(i + 3) == "อ")
            {
                var v = cs[i];
                cs[i] = cs[i + 1];
                cs[i + 1] = cs[i + 2];
                cs[i + 2] = v;
                i += 2;
                continue;
            }
            (cs[i], cs[i + 1]) = (cs[i + 1], cs[i]);
            i++; // don't re-process the moved consonant
        }
        return string.Concat(cs);
    }

    /** Any Thai mark touched by stripThaiMarks: phinthu, mai-taikhu..thanthakhat..nikhahit. */
    private static readonly JsRe THAI_MARK_RE = JsRegex.Compile("[ฺ็-ํ]", "u");
    private static readonly JsRe TONE_MARKS_RE = JsRegex.Compile("[่-๋]", "gu");
    private static readonly JsRe THANTHAKHAT_RE = JsRegex.Compile(".์", "gu");
    private static readonly JsRe INERT_MARKS_RE = JsRegex.Compile("[็ํฺ]", "gu");

    /**
     * Strip Thai marks that are segmentally inert (mirrors epitran tha-Thai's
     * preprocessor deletions, IN ITS ORDER), applied AFTER the leading-vowel reorder:
     *  1. tone marks ◌่◌้◌๊◌๋ (U+0E48-0E4B) — deleted FIRST (epitran), so a tone mark
     *     between a consonant and its thanthakhat doesn't shield the consonant from (2).
     *  2. thanthakhat ◌์ (U+0E4C) SILENCES the consonant it sits on, so drop that
     *     preceding char AND the mark (`สัตว์ → สัต`; epitran `.◌์ → 0`, single char —
     *     this DELIBERATELY matches epitran even where Thai silences a fuller cluster).
     *  3. mai-taikhu ◌็ (U+0E47, vowel-shortener), nikhahit ◌ํ (U+0E4D), phinthu ◌ฺ
     *     (U+0E3A) — segmentally inert here (tone/length are a later phase); deleting
     *     them lets the scan see adjacent consonants (`ด้วย`'s ◌้ no longer breaks the
     *     inherent-vowel lookahead).
     */
    public static string StripThaiMarks(string text)
    {
        if (!THAI_MARK_RE.IsMatch(text)) return text;
        var s = JsRegex.Replace(text, TONE_MARKS_RE, _ => ""); // (1) tone marks (U+0E48-0E4B)
        s = JsRegex.Replace(s, THANTHAKHAT_RE, _ => "");       //    (2) thanthakhat-silenced consonant
        return JsRegex.Replace(s, INERT_MARKS_RE, _ => "");    // (3) mai-taikhu, nikhahit, phinthu
    }

    /**
     * Thai consonant grapheme → its onset phoneme class, used for cluster-former detection and for
     * coda neutralization. These are ONSET classes only — the coda inventory is smaller, and the
     * neutralization rule is what maps one onto the other.
     */
    private static readonly IReadOnlyDictionary<string, string> THAI_CONS_PH = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["ก"] = "k",
        ["ข"] = "kh",
        ["ฃ"] = "kh",
        ["ค"] = "kh",
        ["ฅ"] = "kh",
        ["ฆ"] = "kh",
        ["ง"] = "N",
        ["จ"] = "tS",
        ["ฉ"] = "tSh",
        ["ช"] = "tSh",
        ["ฌ"] = "tSh",
        ["ซ"] = "s",
        ["ญ"] = "j",
        ["ฎ"] = "d",
        ["ด"] = "d",
        ["ฏ"] = "t",
        ["ต"] = "t",
        ["ฐ"] = "th",
        ["ฑ"] = "th",
        ["ฒ"] = "th",
        ["ถ"] = "th",
        ["ท"] = "th",
        ["ธ"] = "th",
        ["ณ"] = "n",
        ["น"] = "n",
        ["บ"] = "b",
        ["ป"] = "p",
        ["ผ"] = "ph",
        ["พ"] = "ph",
        ["ภ"] = "ph",
        ["ฝ"] = "f",
        ["ฟ"] = "f",
        ["ม"] = "m",
        ["ย"] = "j",
        ["ร"] = "r",
        ["ล"] = "l",
        ["ฬ"] = "l",
        ["ว"] = "w",
        ["ศ"] = "s",
        ["ษ"] = "s",
        ["ส"] = "s",
        ["ห"] = "h",
        ["ฮ"] = "h",
        ["ฤ"] = "r",
    };

    /** Consonant graphemes (incl. อ, which can be the glottal-stop consonant ʔ). */
    private static readonly IReadOnlySet<string> THAI_CONS =
        new HashSet<string>(THAI_CONS_PH.Keys.Append("อ"), StringComparer.Ordinal);

    /** Standalone vowel signs (thai.jsonc). ำ is NOT here — it is a glide-bearing span
     *  (am), handled explicitly in thaiVowelSpan. */
    private static readonly IReadOnlySet<string> THAI_VSIGN =
        new HashSet<string>(Manifest.MANIFEST.VowelSigns, StringComparer.Ordinal);

    /** อ is the glottal-stop CONSONANT ʔ before one of these, else the vowel ɔː
     *  (thai.jsonc, which records why ำ and ๅ are absent). */
    private static readonly IReadOnlySet<string> THAI_O_GLOTTAL_NEXT =
        new HashSet<string>(Manifest.MANIFEST.OGlottalNext, StringComparer.Ordinal);

    /** Longest-first เ-combinations (post-reorder: เ sits after its consonant). */
    private static readonly string[] THAI_E_COMBOS =
    {
        "เือะ",
        "เือ",
        "เียะ",
        "เีย",
        "เาะ",
        "เา",
        "เอะ",
        "เอ",
        "เิ",
        "เะ",
        "เ",
    };

    private static readonly IReadOnlyDictionary<string, string> THAI_CLUSTER_FORMER = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["k"] = "k",
        ["kh"] = "k",
        ["p"] = "p",
        ["ph"] = "p",
        ["t"] = "t",
        ["th"] = "t",
    };

    /** Does an onset of cluster-class `former` (k/p/t) accept `med` (l/r/w) as the 2nd cluster member? k→l/r/w,
     *  p→l/r, t→r (kr/kl/kw, pr/pl, tr). Used by rule 5 (cluster schwa-deletion) and rule 3's cluster-schwa guard. */
    private static bool ThaiIsCluster(string? former, string med) =>
        former == "k" ? med == "l" || med == "r" || med == "w"
        : former == "p" ? med == "l" || med == "r"
        : former == "t" ? med == "r"
        : false;

    private sealed class VowelSpan
    {
        public required IReadOnlyList<string> Gs { get; init; }
        public string? Glide { get; init; }
    }

    /** Parse a vowel SPAN starting at index i; returns {gs, glide} or null. */
    private static VowelSpan? ThaiVowelSpan(IReadOnlyList<string> s, int i)
    {
        var c = s[i];
        string At(int k) => i + k >= 0 && i + k < s.Count ? s[i + k] : "";
        if (c == "เ")
        {
            // เ + ย = /ɤːj/ (เลย → lɤːj) when ย is the syllable's OFFGLIDE — i.e. ย is not
            // followed by a vowel. If a vowel follows, ย is the next syllable's onset (เขย่า →
            // kʰa.jàʔ, เยาว์ → jaw), so fall through to the normal เ-combo handling.
            var at2 = At(2);
            if (At(1) == "ย" &&
                !(THAI_VSIGN.Contains(at2) ||
                  THAI_LEADING_VOWEL_RE.IsMatch(at2) ||
                  at2 == "อ"))
            {
                return new VowelSpan { Gs = new[] { "เ", "ย" }, Glide = "j" };
            }
            foreach (var pat in THAI_E_COMBOS)
            {
                // ⚠ `pat.length` IS A UTF-16 LENGTH IN THE TS, used to slice an array of CODE POINTS. Every
                // เ-combo is BMP so the two coincide; mirrored rather than corrected so the shapes match.
                if (string.Concat(s.Skip(i).Take(pat.Length)) == pat)
                    return new VowelSpan { Gs = Js.CodePoints(pat) };
            }
        }
        if (c == "ั")
        {
            if (At(1) == "ว" && At(2) == "ะ") return new VowelSpan { Gs = new[] { "ั", "ว", "ะ" } };
            if (At(1) == "ว") return new VowelSpan { Gs = new[] { "ั", "ว" } };
            return new VowelSpan { Gs = new[] { "ั" } };
        }
        if (c == "ไ")
            return At(1) == "ย"
                ? new VowelSpan { Gs = new[] { "ไ", "ย" }, Glide = "j" }
                : new VowelSpan { Gs = new[] { "ไ" }, Glide = "j" };
        if (c == "ใ") return new VowelSpan { Gs = new[] { "ใ" }, Glide = "j" };
        if (c == "ำ") return new VowelSpan { Gs = new[] { "ำ" }, Glide = "m" };
        if (c == "แ") return At(1) == "ะ" ? new VowelSpan { Gs = new[] { "แ", "ะ" } } : new VowelSpan { Gs = new[] { "แ" } };
        if (c == "โ") return At(1) == "ะ" ? new VowelSpan { Gs = new[] { "โ", "ะ" } } : new VowelSpan { Gs = new[] { "โ" } };
        // ◌ือ (sara uee + อ) is ONE long vowel /ɯː/ — the อ is a silent orthographic tail,
        // not the ɔː vowel. Consume both so อ never surfaces as a separate vowel (คือ → kʰɯː,
        // was kʰɯɔ).
        if (c == "ื" && At(1) == "อ") return new VowelSpan { Gs = new[] { "ื", "อ" } };
        if (THAI_VSIGN.Contains(c)) return new VowelSpan { Gs = new[] { c } };
        // อ as the vowel ɔː: when it is NOT acting as the glottal-stop consonant (i.e. the
        // next grapheme is not in the อ→ʔ list — epitran keys this on the FOLLOWING grapheme.
        // EXCEPTION: a WORD-INITIAL อ before ย is the silent อ of the อย words (อยู่/อย่าง);
        // keep it a consonant so thaiIsSilentLeader can drop it (else ปอย-type อ stays ɔː).
        // A WORD-INITIAL อ before a consonant is the glottal ONSET ʔ of a Sanskrit อ-syllable, not the
        // ɔː vowel — keep it a consonant so it takes an inherent vowel from the schwa fates (อธิบาย →
        // ʔa.tʰi.baːj, องค์ → ʔoŋ), and so thaiIsSilentLeader can drop the อย leader. (Generalises the
        // former อย-only guard; อำ stays ɔː since ำ is not a consonant — epitran-intentional, see above.)
        if (c == "อ" &&
            !THAI_O_GLOTTAL_NEXT.Contains(At(1)) &&
            !(i == 0 && IsThaiConsonant(At(1))))
            return new VowelSpan { Gs = new[] { "อ" } };
        // ว as the medial vowel /ua/ in a WORD-INITIAL CวC syllable: a single onset consonant
        // at the word start, ว, then a coda consonant (ส่วน → sŭan, ด้วย → dŭaj, ขวด → kʰŭat).
        // Restricted to i===1 because a mid-word ว after a coda starts a new ว-ONSET syllable
        // (สงวน → soŋ·won, ผนวก → pʰon·wok) — distinguishing onset from coda there needs the
        // schwa fates, which aren't available yet. ทวี/กว่า (ว before a vowel) stay consonant.
        // (อ after ว is the ɔː VOWEL of a cluster, not a coda — ควอ → kʰwɔ, not kʰua·ɔ.)
        // EXCEPTION: a k-class onset (a ว-cluster former) + ว + ร is the kʰw-cluster word ควร
        // (→ kʰwɔːn), not /ua/ — while the same onset + ว + other coda IS /ua/ (ควง/ควบ/ขวด).
        // EXCEPTION: a leading ห is a SILENT leader before ว (raisable), so หว is ห-silent +
        // ว-onset (หวง → wŏŋ), NOT a CวC nucleus — leave ว a consonant so thaiIsSilentLeader fires.
        if (c == "ว" &&
            i == 1 &&
            IsThaiConsonant(s.Count > 0 ? s[0] : "") &&
            IsThaiConsonant(At(1)) &&
            At(1) != "อ" &&
            (s.Count > 0 ? s[0] : "") != "ห" &&
            !("กขฃคฅฆ".Contains(s.Count > 0 ? s[0] : "", StringComparison.Ordinal) && At(1) == "ร"))
        {
            return new VowelSpan { Gs = new[] { "ว" } };
        }
        // ◌ว = /ua/ NUCLEUS under a silent ห-leader: หCวC (ห + raised sonorant onset + ว + coda) — หลวง →
        // lŭaŋ, หมวด → mŭat, หนวด → nŭat. The silent ห makes s[i-1] the real onset, so ว here is the nucleus
        // exactly like the CวC case above; ว just sits at i≥2 (after the leader). Fires word-initial AND
        // mid-word (เมืองหลวง → …lŭaŋ). Needs a following coda consonant (not a vowel/อ). Without this, ว fell
        // through to a bare /w/ consonant and the leader logic mangled the onset (หลวง → nwoŋ).
        if (c == "ว" &&
            i >= 2 &&
            s[i - 2] == "ห" &&
            s[i - 1] != "ว" &&
            THAI_H_RAISABLE.Contains(s[i - 1]) &&
            IsThaiConsonant(At(1)) &&
            At(1) != "อ")
        {
            return new VowelSpan { Gs = new[] { "ว" } };
        }
        return null;
    }

    private static List<ThaiUnit> ThaiTokenize(string word)
    {
        var s = Js.CodePoints(word);
        var units = new List<ThaiUnit>();
        for (var i = 0; i < s.Count;)
        {
            var span = ThaiVowelSpan(s, i);
            if (span is not null)
            {
                units.Add(new ThaiUnit { Kind = "V", Gs = span.Gs, Glide = span.Glide });
                i += span.Gs.Count;
                continue;
            }
            var c = s[i];
            if (THAI_CONS.Contains(c))
            {
                units.Add(new ThaiUnit
                {
                    Kind = "C",
                    G = c,
                    Ph = c == "อ" ? "?" : THAI_CONS_PH[c],
                });
            }
            else
            {
                units.Add(new ThaiUnit { Kind = "V", Gs = new[] { c } }); // unknown grapheme: inert, can't bear a schwa
            }
            i++;
        }
        return units;
    }

    /** Low sonorants a silent ห raises to HIGH class (and ย after a silent อ): หม/หน/หว…, อย.
     *  From thai.jsonc — the SAME list g2p.ts reads, which is why it is not spelled out twice. */
    private static readonly IReadOnlySet<string> THAI_H_RAISABLE =
        new HashSet<string>(Js.CodePoints(Manifest.MANIFEST.Raisable), StringComparer.Ordinal);

    /** Non-cluster low sonorants — THAI_H_RAISABLE minus the cluster glides ย/ร/ล/ว, and DERIVED
     *  that way so the two cannot drift. Used for a leader's second consonant in the เ-frame
     *  อักษรนำ rotate, where C1+C2 can never be an onset cluster. */
    private static readonly IReadOnlySet<string> THAI_LEADER_SONORANT =
        new HashSet<string>(THAI_H_RAISABLE.Where(c => !"ยรลว".Contains(c, StringComparison.Ordinal)), StringComparer.Ordinal);

    /**
     * Is unit `i` a SILENT leading consonant — a ห before a raisable sonorant (หม/หน/หว/
     * หญ/หร/หล/หง) or the อ of the อย words (อย่า/อยาก/อยู่/อย่าง)? In correct Thai such a
     * leader is NOT pronounced; it only raises the syllable's tone class. ⚠ A naive syllabifier gives it
     * an inherent vowel and so a SPURIOUS SYLLABLE (จังหวัด → …ha.wat). The segmentation and the tone
     * analysis both skip it through this one shared predicate, so their syllable counts cannot disagree.
     */
    private static bool ThaiIsSilentLeader(IReadOnlyList<ThaiUnit> units, int i)
    {
        var u = i >= 0 && i < units.Count ? units[i] : null;
        if (u is null || u.Kind != "C") return false;
        var nx = i + 1 < units.Count ? units[i + 1] : null;
        if (nx is null || nx.Kind != "C") return false;
        return (u.G == "ห" && THAI_H_RAISABLE.Contains(nx.G)) ||
               (i == 0 && u.G == "อ" && nx.G == "ย");
    }

    private sealed class Tok
    {
        public required string Sym { get; set; }
        public required int Owner { get; init; }
    }

    /**
     * Compute each consonant's inherent-vowel fate by simulating epitran tha-Thai's
     * post-processor (post/tha-Thai.txt) in file order on a [C, schwa]* / V sequence.
     * Returns the fate per consonant index: "o", "a", or null (deleted — onset before
     * a vowel, a coda, or a cluster onset). Order is load-bearing: neutralization
     * (rule 4, l/r→n) runs BEFORE the cluster rule, so a coda ร doesn't cluster.
     */
    private static Dictionary<int, string> ThaiSchwaFates(IReadOnlyList<ThaiUnit> units)
    {
        // Token sym: a consonant phoneme, "V" (written vowel), "ə" (pending schwa), or —
        // after rules 6/7 — "o"/"a". owner = the consonant's unit index (-1 = none).
        var seq = new List<Tok>();
        for (var ci = 0; ci < units.Count; ci++)
        {
            var u = units[ci];
            if (u.Kind == "C")
            {
                seq.Add(new Tok { Sym = u.Ph, Owner = ci });
                seq.Add(new Tok { Sym = "ə", Owner = ci });
            }
            else
            {
                seq.Add(new Tok { Sym = "V", Owner = -1 });
                // A glide-final vowel (aj/am) ends in a CONSONANT (j/m) that fills the coda
                // slot — model it as a schwa-less consonant (never carries a marker).
                if (u.Glide is not null) seq.Add(new Tok { Sym = u.Glide, Owner = -1 });
            }
        }
        static bool IsV(Tok? t) => t is not null && (t.Sym == "V" || t.Sym == "ə");
        static bool IsC(Tok? t) => t is not null && !IsV(t);
        Tok? At(List<Tok> l, int i) => i >= 0 && i < l.Count ? l[i] : null;

        // The rewrites mirror epitran post/tha-Thai.txt IN ORDER. Crucially they are
        // NON-OVERLAPPING (Python re.sub): a context-bearing match consumes its whole
        // span, so a trailing context char can't seed the next match (this is why
        // การศึกษา keeps the second ก's vowel: kaːnsɯkasaː, not kaːnsɯksaː).

        // 1: ə → 0 / _V  (right-context lookahead — drop ə before any vowel)
        // ⚠ THE LOOKAHEAD READS THE ORIGINAL ARRAY. JS `Array.prototype.filter` hands the callback the array
        // being traversed, and `seq` is only reassigned after the call returns, so `seq[i+1]` is the PRE-filter
        // neighbour. Filtering in place would consult already-shortened indices and drop the wrong schwas.
        {
            var src = seq;
            seq = new List<Tok>();
            for (var i = 0; i < src.Count; i++)
                if (!(src[i].Sym == "ə" && IsV(At(src, i + 1)))) seq.Add(src[i]);
        }

        // 2: ə → 0 / VC_#  (a coda schwa at word end)
        if (seq.Count >= 3 &&
            seq[^1].Sym == "ə" &&
            IsC(At(seq, seq.Count - 2)) &&
            IsV(At(seq, seq.Count - 3)))
            seq.RemoveAt(seq.Count - 1);

        // 3: ə → 0 / VC_CV  (consume V·C·ə·C·V; advance past the trailing CV)
        seq = RewriteThai(seq, 5, w =>
        {
            if (!(IsV(w[0]) && IsC(w[1]) && w[2]!.Sym == "ə" && IsC(w[3]) && IsV(w[4])))
                return null;
            // Protect a CLUSTER schwa: when w[1] is ร after an onset (w[0] is that onset's own schwa) forming a
            // valid kr/pr/tr cluster, w[2] is the cluster's nucleus schwa — deleting it here strands ร as a coda
            // (rule 4 → น). Leave it for rule 5: กรมการ → krom·kaːn, not kon·ma·kaːn. Restricted to ร: kr/pr/tr are
            // almost always true clusters, whereas ล/ว after an onset are usually the inserted-o + ล-coda reading
            // (ผล → pʰon, พล → pʰon, not pʰl). A Sanskrit inserted-vowel ร (กรกฎา → ka-ra) is the dictionary's job.
            //
            // ⚠ THE TS NAMED HEBREW LETTERS HERE for ร/ล/ว (resh/lamed/vav for ro rua/lo ling/wo waen) — fixed
            // TS-first in #903, so this comment is the corrected text rather than a divergence. The code never
            // depended on it: the test is on the PHONEME "r".
            //
            // ⚠ `units[w[0].owner]` IS AN OUT-OF-RANGE READ WHEN THE OWNER IS -1, which is every "V" token. JS
            // returns `undefined` and the `onset?.kind === "C"` test below then fails harmlessly; C# throws, so
            // the bounds check is explicit here. Same branch, same outcome.
            var ownerIdx = w[0]!.Owner;
            var onset = ownerIdx >= 0 && ownerIdx < units.Count ? units[ownerIdx] : null;
            if (w[0]!.Sym == "ə" &&
                w[1]!.Sym == "r" &&
                onset?.Kind == "C" &&
                ThaiIsCluster(THAI_CLUSTER_FORMER.GetValueOrDefault(onset.Ph), "r"))
                return null;
            return new List<Tok> { w[0]!, w[1]!, w[3]!, w[4]! };
        });

        // 4: neutralization before #/C (l/r→n runs BEFORE the cluster rule, so a coda
        //    ร doesn't cluster) — mutate consonant syms in place.
        for (var i = 0; i < seq.Count; i++)
        {
            if (!IsC(seq[i])) continue;
            if (IsV(At(seq, i + 1))) continue; // before a vowel: an onset, no neutralization
            var p = seq[i].Sym;
            seq[i].Sym =
                p == "kh"
                    ? "k"
                    : p == "tS" ||
                      p == "tSh" ||
                      p == "d" ||
                      p == "th" ||
                      p == "s"
                      ? "t"
                      : p == "ph"
                        ? "p"
                        : p == "l" || p == "r"
                          ? "n"
                          : p;
        }

        // 5: cluster schwa-deletion — (k)_(l/r/w), (p)_(l/r), (t)_r  (consume C·ə·C)
        seq = RewriteThai(seq, 3, w =>
        {
            if (!(IsC(w[0]) && w[1]!.Sym == "ə" && IsC(w[2]))) return null;
            return ThaiIsCluster(THAI_CLUSTER_FORMER.GetValueOrDefault(w[0]!.Sym), w[2]!.Sym)
                ? new List<Tok> { w[0]!, w[2]! }
                : null;
        });

        // 6: ə → o / _C(#|C)  (right-context lookahead — surfaces as o in a closed syllable)
        for (var i = 0; i < seq.Count; i++)
        {
            if (seq[i].Sym == "ə" &&
                IsC(At(seq, i + 1)) &&
                (At(seq, i + 2) is null || IsC(At(seq, i + 2))))
                seq[i].Sym = "o";
        }
        // 7: ə → a  (everything else)
        foreach (var t in seq) if (t.Sym == "ə") t.Sym = "a";

        var @out = new Dictionary<int, string>();
        foreach (var t in seq)
            if (t.Sym == "o" || t.Sym == "a") @out[t.Owner] = t.Sym;
        return @out;
    }

    /**
     * One NON-OVERLAPPING left-to-right rewrite pass: at each position try to match a
     * window of `width` tokens; if `apply` returns a replacement array, emit it and
     * advance PAST the whole window (consuming it); otherwise emit one token and step.
     */
    private static List<T> RewriteThai<T>(List<T> seq, int width, Func<List<T?>, List<T>?> apply)
        where T : class
    {
        var @out = new List<T>();
        for (var i = 0; i < seq.Count;)
        {
            var repl = i + width <= seq.Count
                ? apply(seq.GetRange(i, width).Select(x => (T?)x).ToList())
                : null;
            if (repl is not null)
            {
                @out.AddRange(repl);
                i += width;
            }
            else
            {
                @out.Add(seq[i]);
                i++;
            }
        }
        return @out;
    }

    /** Short vowel signs (thai.jsonc) — length feeds the dead-short/dead-long tone split. */
    private static readonly IReadOnlySet<string> THAI_SHORT_VSIGN =
        new HashSet<string>(Manifest.MANIFEST.ShortVowelSigns, StringComparer.Ordinal);

    /** Sonorant (and glide) codas that make a syllable LIVE — thai.jsonc, which records why the
     *  glides are here rather than folded into the nucleus as th-pron does it. */
    private static readonly IReadOnlySet<string> THAI_LIVE_CODA =
        new HashSet<string>(Manifest.MANIFEST.LiveCodas, StringComparer.Ordinal);

    private static readonly JsRe TONE_MARK_CHAR = JsRegex.Compile("[่-๋̄]", "u");

    /**
     * Prepare a (reordered, pre-strip) Thai word for the syllable scan: capture each tone
     * mark against the char it sits on (BEFORE stripThaiMarks drops it), strip the marks,
     * tokenize, run the schwa fates, and project the marks onto the surviving units.
     */
    public static ThaiPrepResult? ThaiPrep(string reordered)
    {
        var markAt = new List<string?>();
        // mai-taikhu ◌็ (U+0E47) shortens its syllable's vowel (เป็น /pen/, เล็ก /lék/). Like the tone
        // marks it is dropped by stripThaiMarks, so capture its position here (against the char it sits
        // on) before the strip, then project onto the surviving unit — used for BOTH the tone's
        // long/short input and the segmental short-vowel emission.
        var shortAt = new List<bool>();
        var cleaned = new List<string>();
        foreach (var c in Js.CodePoints(reordered))
        {
            if (TONE_MARK_CHAR.IsMatch(c))
            {
                if (cleaned.Count > 0) markAt[cleaned.Count - 1] = c;
                continue;
            }
            if (c == "็")
            {
                if (cleaned.Count > 0) shortAt[cleaned.Count - 1] = true;
                continue;
            }
            cleaned.Add(c);
            markAt.Add(null);
            shortAt.Add(false);
        }
        var word = StripThaiMarks(string.Concat(cleaned));
        // Project each captured mark onto the SURVIVING word char it belongs to. stripThaiMarks
        // can delete chars (a thanthakhat-silenced consonant); carry a mark that sat on a
        // deleted char forward to the next surviving char so it isn't lost. (A residual
        // ambiguity remains when an identical char survives further along — rare in practice.)
        var unitMarkByChar = new List<string?>();
        var shortByChar = new List<bool>();
        {
            var ci = 0;
            foreach (var wc in Js.CodePoints(word))
            {
                string? m = null;
                var sh = false;
                while (ci < cleaned.Count && cleaned[ci] != wc)
                {
                    m ??= markAt[ci];
                    sh = sh || shortAt[ci];
                    ci++;
                }
                unitMarkByChar.Add((ci < markAt.Count ? markAt[ci] : null) ?? m);
                shortByChar.Add((ci < shortAt.Count && shortAt[ci]) || sh);
                ci++;
            }
        }
        if (!Js.CodePoints(word).Any(c => THAI_CONS.Contains(c))) return null;
        var units = ThaiTokenize(word);
        var fates = ThaiSchwaFates(units);
        var unitMark = new List<string?>();
        var shortMark = new List<bool>();
        {
            var p = 0;
            foreach (var u in units)
            {
                var len = u.Kind == "C" ? 1 : u.Gs.Count;
                string? m = null;
                var sh = false;
                for (var k = 0; k < len; k++)
                {
                    m ??= p + k < unitMarkByChar.Count ? unitMarkByChar[p + k] : null;
                    sh = sh || (p + k < shortByChar.Count && shortByChar[p + k]);
                }
                unitMark.Add(m);
                shortMark.Add(sh);
                p += len;
            }
        }
        return new ThaiPrepResult { Units = units, Fates = fates, UnitMark = unitMark, ShortMark = shortMark };
    }

    /**
     * Scan a prepared Thai word into syllables, computing each one's lexical tone from the tone rule
     * (consonant class × live/dead × length × mark; see thaiTone.ts). ⚠ SEGMENTATION AND TONE COME OUT
     * OF THE SAME SCAN, which is what makes it impossible for them to disagree on syllable count.
     */
    public static List<ThaiSyllableScan> ThaiScanSyllables(
        IReadOnlyList<ThaiUnit> units,
        Dictionary<int, string> fates,
        IReadOnlyList<string?> unitMark,
        IReadOnlyList<bool>? shortMarkIn = null)
    {
        var shortMark = shortMarkIn ?? Array.Empty<bool>();
        bool Short(int i) => i >= 0 && i < shortMark.Count && shortMark[i];
        // A silent ห/อ leader (หม/หน/หว…, อย) is NOT a nucleus — skip it, using the same
        // `thaiIsSilentLeader` predicate that drops these leaders from the segment stream.
        bool IsNucleus(int i) =>
            !ThaiIsSilentLeader(units, i) &&
            (units[i].Kind == "V" || (units[i].Kind == "C" && fates.ContainsKey(i)));
        var @out = new List<ThaiSyllableScan>();
        var onsetStart = 0;
        // อักษรนำ (implicit leading consonant): a light high/mid consonant with an inherent short
        // vowel and no coda (e.g. ถ in ถนน, ส in เสนอ) RAISES a following low-class sonorant syllable
        // to the leader's tone class — the unwritten counterpart of the ห/อ leader handled explicitly
        // below (Wiktionary spells it with หฺ: ถนน → ถะ-หฺนน → tʰa.nǒn rising). Carries the leader's own
        // class to the next syllable when that syllable's onset is a bare sonorant.
        string? pendingLeaderClass = null;
        for (var i = 0; i < units.Count; i++)
        {
            if (!IsNucleus(i)) continue;
            var u = units[i];
            var onsetCs = new List<string>();
            for (var j = onsetStart; j <= i; j++)
            {
                var uj = units[j];
                if (uj.Kind == "C") onsetCs.Add(uj.G);
            }
            if (onsetCs.Count == 0)
            {
                onsetStart = i + 1;
                pendingLeaderClass = null;
                continue;
            } // adjacency broken by an onset-less nucleus
            string? cls;
            if (onsetCs[0] == "ห" &&
                onsetCs.Count >= 2 &&
                THAI_H_RAISABLE.Contains(onsetCs[1]))
                cls = ThaiTone.ThaiEffectiveClass(onsetCs[1], "ห");
            else if (onsetCs[0] == "อ" &&
                     onsetCs.Count >= 2 &&
                     onsetCs[1] == "ย")
                cls = ThaiTone.ThaiEffectiveClass("ย", "อ");
            else if (onsetCs.Count == 1 &&
                     pendingLeaderClass is not null &&
                     THAI_H_RAISABLE.Contains(onsetCs[0]))
                cls = pendingLeaderClass; // implicit อักษรนำ
            else cls = ThaiTone.ThaiEffectiveClass(onsetCs[0], null);
            var isLong =
                u.Kind == "V" && !Short(i)
                    ? !THAI_SHORT_VSIGN.Contains(u.Gs[^1])
                    : false;
            var glideVowel = u.Kind == "V" && u.Glide is not null; // ไ/ใ/ำ — live
            var codaG = "";
            var nextI = i + 1;
            var un = nextI < units.Count ? units[nextI] : null;
            // A ห before a low-class sonorant is that sonorant's LEADER (หมาย, หญิง), not this syllable's
            // coda — leave it in the next onset so the ห-raise fires there (fixes mid-word เป้าหมาย/ผู้หญิง).
            var nn = nextI + 1 < units.Count ? units[nextI + 1] : null;
            var hLeaderNext =
                un?.Kind == "C" &&
                un.G == "ห" &&
                nn?.Kind == "C" &&
                THAI_H_RAISABLE.Contains(nn.G);
            if (un?.Kind == "C" &&
                !fates.ContainsKey(nextI) &&
                nn?.Kind != "V" &&
                !hLeaderNext)
            {
                codaG = un.G;
                nextI++;
            }
            var live =
                glideVowel || THAI_LIVE_CODA.Contains(codaG) || (codaG == "" && isLong);
            // the syllable's tone mark may sit on any onset or nucleus unit (อย่า → ก on the
            // middle ย); scan the whole onset→nucleus span, not just the ends.
            string? mark = null;
            for (var j = onsetStart; j <= i; j++) mark ??= j < unitMark.Count ? unitMark[j] : null;
            @out.Add(new ThaiSyllableScan
            {
                Nucleus = i,
                Tone =
                    cls is null
                        ? null
                        : ThaiTone.ComputeThaiTone(
                            cls,
                            live ? "live" : "dead",
                            isLong ? "long" : "short",
                            mark),
                OnsetCs = new List<string>(onsetCs),
                NucUnit = u,
                CodaG = codaG,
                Long = isLong,
                Fate = fates.GetValueOrDefault(i),
            });
            // This syllable is a leader for the NEXT iff it is a bare high/mid consonant with an
            // inherent short 'a' vowel, no coda, and no tone mark (own class — a raised sonorant, being
            // low class, never qualifies, so the raise never chains).
            var ownCls = ThaiTone.ThaiConsonantClass(onsetCs[0]);
            pendingLeaderClass =
                onsetCs.Count == 1 &&
                (ownCls == "high" || ownCls == "mid") &&
                u.Kind == "C" &&
                fates.GetValueOrDefault(i) == "a" &&
                codaG == "" &&
                mark is null
                    ? ownCls
                    : null;
            onsetStart = nextI;
        }
        return @out;
    }
}
