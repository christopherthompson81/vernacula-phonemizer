/**
 * European Portuguese (pt-PT) grapheme→phoneme engine.
 * Ported from src/languages/portuguese/g2p.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Portuguese;

public sealed class Seg
{
    public required string Ph;      // IPA (for a vowel: its STRESSED realization; reduction may rewrite it)
    public required bool Nucleus;   // is a syllable nucleus (a vowel, not a glide)
    public required bool Accent;    // bears a written accent (á é í ó ú â ê ô ã õ) → lexically stressed
    public required string Raw;     // the source vowel letter (base, unaccented) — drives reduction; "" for consonants
    public required bool Nasal;     // nasalized nucleus
}

public static class G2p
{
    private static IReadOnlyDictionary<string, string> ACCENTED => Manifest.MANIFEST.Accents.ToBase; // accented vowel → base letter
    private static string ACUTE_GRAVE => Manifest.MANIFEST.Accents.AcuteGrave; // open/explicit-stress accents
    private static string CIRCUMFLEX => Manifest.MANIFEST.Accents.Circumflex; // close-quality stressed
    private static string TILDE => Manifest.MANIFEST.Accents.Tilde; // nasal
    private static string VOWELS => Manifest.MANIFEST.VowelLetters;
    private static string FRONT => Manifest.MANIFEST.FrontLetters; // soften c/g
    private static IReadOnlyDictionary<string, string> VOWEL_IPA => Manifest.MANIFEST.VowelIpa; // vowel letter → stressed IPA realization

    private static bool IsV(string c) => c != "" && VOWELS.Contains(c, StringComparison.Ordinal);
    private static bool IsFront(string c) => c != "" && FRONT.Contains(c, StringComparison.Ordinal);
    private static string Base(string c) => ACCENTED.GetValueOrDefault(c, c);

    /**
     * Stressed IPA realization of a vowel from its letter (VOWEL_IPA table). Bare e/o default to close e/o.
     */
    private static string VowelIpaOf(string ch) => VOWEL_IPA.GetValueOrDefault(ch, ch);

    private static void PushV(List<Seg> segs, string ch, bool nasal) =>
        segs.Add(new Seg
        {
            Ph = VowelIpaOf(ch),
            Nucleus = true,
            Accent = ACUTE_GRAVE.Contains(ch, StringComparison.Ordinal) || CIRCUMFLEX.Contains(ch, StringComparison.Ordinal),
            Raw = Base(ch),
            Nasal = nasal,
        });

    private static void PushGlide(List<Seg> segs, string ph, bool nasal) =>
        segs.Add(new Seg { Ph = ph, Nucleus = false, Accent = false, Raw = "", Nasal = nasal });

    private static void PushC(List<Seg> segs, string ph) =>
        segs.Add(new Seg { Ph = ph, Nucleus = false, Accent = false, Raw = "", Nasal = false });

    /** A vowel is nasalized if it is written with a tilde, or followed by m/n that is a coda (not before a vowel).
     *  The n of an nh digraph (senhora) is NOT a coda nasal — it stays the ɲ onset of the next syllable. */
    private static bool NasalizedHere(IReadOnlyList<string> w, int vi)
    {
        var c = w[vi];
        if (TILDE.Contains(c, StringComparison.Ordinal)) return true;
        var nx = vi + 1 < w.Count ? w[vi + 1] : "";
        if (nx != "m" && nx != "n") return false;
        var after = vi + 2 < w.Count ? w[vi + 2] : "";
        if (nx == "n" && after == "h") return false; // nh digraph → ɲ, not a nasal coda
        return after == "" || !IsV(after); // m/n before a consonant or word-end → nasal coda
    }

    /**
     * Every letter this scan has a rule for — Portuguese's own alphabet, its five accents, and ⟨ñ⟩ (below).
     */
    private static readonly IReadOnlySet<string> KNOWN_LETTERS =
        new HashSet<string>(Js.CodePoints(Manifest.MANIFEST.VowelLetters).Concat(Js.CodePoints("bcçdfghjklmnñpqrstvwxz")),
            StringComparer.Ordinal);

    /**
     * ⟨y⟩ is the one ASCII letter the scan has no case for; it folds to ⟨i⟩ so the ordinary ⟨i⟩ machinery
     * (including the glide rule) runs. Deliberately not left to the shared Latin table, which says /j/.
     */
    private static readonly IReadOnlyDictionary<string, string> FOREIGN_LETTER =
        new Dictionary<string, string>(StringComparer.Ordinal) { ["y"] = "i" };

    private static readonly JsRe MARKS_RUN = JsRegex.Compile("\\p{M}+", "gu");

    /**
     * A letter from someone else's orthography is read as its base, not dropped. One character in, one
     * character out — every index, lookahead and `atEnd` test downstream still names the same position.
     * ⟨ñ⟩ is excluded from the fold on purpose: it is in KNOWN_LETTERS and has its own case (/ɲ/).
     */
    private static List<string> FoldForeignLetters(string w)
    {
        var cs = Js.CodePoints(w);
        if (cs.All(c => KNOWN_LETTERS.Contains(c))) return cs; // the overwhelmingly common case: no work
        return cs.Select(c =>
        {
            if (KNOWN_LETTERS.Contains(c)) return c;
            if (FOREIGN_LETTER.TryGetValue(c, out var named)) return named;
            var b = MARKS_RUN.Replace(Js.Normalize(c, System.Text.NormalizationForm.FormD), "");
            if (FOREIGN_LETTER.TryGetValue(b, out var mapped)) return mapped;
            return Js.CodePoints(b).Count == 1 && KNOWN_LETTERS.Contains(b) ? b : c;
        }).ToList();
    }

    private static readonly IReadOnlySet<string> ACCENTED_VOWEL_CHARS =
        new HashSet<string>(Js.CodePoints("áàâãéêíóôõúü"), StringComparer.Ordinal);

    /** Scan a lowercased word into segments (consonants realized in place; vowels get stressed-quality IPA).
     *  `dialect` only affects the word-final -em nucleus (EP [ɐ̃j̃] vs BP [ẽj̃]); everything else is shared. */
    public static List<Seg> ToSegments(string word, string dialect = "ep")
    {
        var w = FoldForeignLetters(word.ToLowerInvariant());
        var n = w.Count;
        var segs = new List<Seg>();
        var i = 0;
        string At(int k) => k >= 0 && k < n ? w[k] : "";

        while (i < n)
        {
            var c = w[i];
            var nx = At(i + 1);
            var nx2 = At(i + 2);

            if (c == "c" && nx == "h") { PushC(segs, "ʃ"); i += 2; continue; }
            if (c == "l" && nx == "h") { PushC(segs, "ʎ"); i += 2; continue; }
            if (c == "n" && nx == "h") { PushC(segs, "ɲ"); i += 2; continue; }
            if (c == "r" && nx == "r") { PushC(segs, "ʁ"); i += 2; continue; }
            if (c == "s" && nx == "s") { PushC(segs, "s"); i += 2; continue; } // massa → masɐ
            if (c == "q" && nx == "u")
            {
                PushC(segs, "k");
                if (!IsFront(nx2)) PushGlide(segs, "w", false);
                i += 2;
                continue;
            } // que/qui→k; qua/quo→kw
            if (c == "g" && nx == "u" && IsFront(nx2)) { PushC(segs, "ɡ"); i += 2; continue; } // gue/gui→ɡ (u silent)

            if (IsV(c))
            {
                var nasal = NasalizedHere(w, i);
                if (nx == "m" && nx2 == "" && (c == "a" || c == "á" || c == "e" || c == "é"))
                {
                    var acc = ACUTE_GRAVE.Contains(c, StringComparison.Ordinal); // á/é keep the stress; plain a/e stay unstressable
                    var isE = c == "e" || c == "é";
                    segs.Add(new Seg
                    {
                        Ph = isE && dialect == "bp" ? "e" : "ɐ",
                        Nucleus = true,
                        Accent = acc,
                        Raw = isE ? "e" : "a",
                        Nasal = true,
                    });
                    PushGlide(segs, c == "a" || c == "á" ? "w̃" : "j̃", true);
                    i += 2;
                    continue;
                }
                // raw="" on purpose: the ou monophthong must NOT reduce to u when unstressed (ouvir → oviɾ).
                if (c == "o" && nx == "u" && !nasal)
                {
                    segs.Add(new Seg { Ph = "o", Nucleus = true, Accent = false, Raw = "", Nasal = false });
                    i += 2;
                    continue;
                }
                if (c == "ã" && nx == "o") { PushV(segs, "ã", true); PushGlide(segs, "w̃", true); i += 2; continue; }
                if (c == "ã" && nx == "e") { PushV(segs, "ã", true); PushGlide(segs, "j̃", true); i += 2; continue; }
                if (c == "õ" && nx == "e") { PushV(segs, "õ", true); PushGlide(segs, "j̃", true); i += 2; continue; }
                PushV(segs, c, nasal);
                i++;
                if (nasal && (nx == "m" || nx == "n")) i++;
                var g = At(i);
                var after = At(i + 1);
                var hiatus = after != "" && after != "s" && !IsV(after) && At(i + 2) == ""; // i/u + final C(≠s)
                var accentedNext = after != "" && ACCENTED_VOWEL_CHARS.Contains(after); // guard ""; i/u before an accented vowel is hiatus (miúdo)
                if ((g == "i" || g == "u") && !hiatus && !accentedNext)
                {
                    PushGlide(segs, g == "i" ? "j" : "w", false);
                    i++;
                }
                continue;
            }

            switch (c)
            {
                case "b":
                    PushC(segs, "b");
                    break;
                case "c":
                    PushC(segs, IsFront(nx) ? "s" : "k");
                    break;
                case "ç":
                    PushC(segs, "s");
                    break;
                case "ñ":
                    PushC(segs, "ɲ");
                    break;
                case "d":
                    PushC(segs, "d");
                    break;
                case "f":
                    PushC(segs, "f");
                    break;
                case "g":
                    PushC(segs, IsFront(nx) ? "ʒ" : "ɡ");
                    break;
                case "h":
                    break; // silent
                case "j":
                    PushC(segs, "ʒ");
                    break;
                case "k":
                    PushC(segs, "k");
                    break;
                case "l":
                    PushC(segs, nx == "" || !IsV(nx) ? "ɫ" : "l");
                    break; // coda l → velarized ɫ
                case "m":
                    PushC(segs, "m");
                    break;
                case "n":
                    PushC(segs, "n");
                    break;
                case "p":
                    PushC(segs, "p");
                    break;
                case "q":
                    PushC(segs, "k");
                    break;
                case "r":
                {
                    var prev = At(i - 1);
                    var strong = i == 0 || prev == "n" || prev == "l" || prev == "s"; // initial / after n,l,s → ʁ
                    PushC(segs, strong ? "ʁ" : "ɾ");
                    break;
                }
                case "s":
                    segs.Add(new Seg { Ph = "s", Nucleus = false, Accent = false, Raw = "s", Nasal = false });
                    break; // raw="s": voiceable
                case "t":
                    PushC(segs, "t");
                    break;
                case "v":
                    PushC(segs, "v");
                    break;
                case "w":
                    PushC(segs, "v");
                    break;
                case "x":
                    segs.Add(new Seg { Ph = "ʃ", Nucleus = false, Accent = false, Raw = "x", Nasal = false });
                    break; // default ʃ; raw="x" so the lexicon can override to s/z/ks
                case "z":
                    PushC(segs, "z");
                    break; // coda → ʃ/ʒ downstream
                default:
                {
                    var ph = LatinPhones.LatinPhone(c, new PhoneOpts { Initial = i == 0 });
                    if (ph is not null) PushC(segs, ph);
                    break;
                }
            }
            i++;
        }
        return segs;
    }

    private static readonly JsRe VOWEL_PH = JsRegex.Compile("[aɐɛeiɔouɨ]", "");
    private static bool IsVowelPh(string ph) => VOWEL_PH.IsMatch(ph);

    /**
     * s/z realization by position: a single intervocalic s → z; any coda s/z → the coda sibilant (before
     * voiceless / word-final) or its voiced pair (before a voiced consonant).
     */
    private static readonly IReadOnlySet<string> VOICED =
        new HashSet<string>(Manifest.MANIFEST.VoicedConsonants, StringComparer.Ordinal);

    public static void Sibilants(List<Seg> segs, string dialect = "ep")
    {
        var (coda, codaVoiced) = dialect == "bp" ? ("s", "z") : ("ʃ", "ʒ");
        for (var i = 0; i < segs.Count; i++)
        {
            var s = segs[i];
            if (s.Ph != "s" && s.Ph != "z") continue;
            var prev = i - 1 >= 0 ? segs[i - 1] : null;
            var next = i + 1 < segs.Count ? segs[i + 1] : null;
            var prevV = prev is not null && (prev.Nucleus || IsVowelPh(prev.Ph));
            var nextV = next is not null && (next.Nucleus || IsVowelPh(next.Ph));
            if (nextV)
            {
                if (prevV && !prev!.Nasal && s.Raw == "s") s.Ph = "z"; // single s voices (casa → kazɐ); NOT after a
                continue;                                             // nasal vowel (sansão → sɐ̃sɐ̃w̃) — an absorbed
            }                                                         // coda n precedes it. ç/ss/initial s stay s.
            s.Ph = next is null ? coda : VOICED.Contains(next.Ph) ? codaVoiced : coda; // coda → ʃ/ʒ (EP) or s/z (BP)
        }
    }
}
