/**
 * European Portuguese (pt-PT) grapheme→phoneme engine. Portuguese orthography is largely rule-governed, so
 * this is a left-to-right scan producing a segment list (phoneme + nucleus/accent flags + the raw vowel), then
 * a stress pass, then the EP-signature vowel-REDUCTION pass (unstressed a→ɐ, e→ɨ, o→u). Stressed mid-vowel
 * quality (open ɛ/ɔ vs close e/o on bare e/o) and grapheme x are the partly-lexical residuals.
 * No lexicon (yet).
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
    // Accent classes + letter sets are DATA (portuguese.jsonc).
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

    /** Stressed IPA realization of a vowel from its letter (VOWEL_IPA table). Bare e/o default to close e/o. */
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
     * ⚠ ⟨ü⟩ IS IN IT because `vowelLetters` is: the trema survived in Brazilian spelling until 2009 and the corpus
     * still writes it.
     */
    private static readonly IReadOnlySet<string> KNOWN_LETTERS =
        new HashSet<string>(Js.CodePoints(Manifest.MANIFEST.VowelLetters).Concat(Js.CodePoints("bcçdfghjklmnñpqrstvwxz")),
            StringComparer.Ordinal);

    /**
     * ⚠ ⟨y⟩ IS THE ONE ASCII LETTER THIS SCAN HAS NO CASE FOR, and it is a VOWEL letter in the words Portuguese
     * borrows it in — so it folds to ⟨i⟩, the letter Portuguese itself uses for that sound (the 1911/1943
     * orthographies replaced Greek-derived ⟨y⟩ with ⟨i⟩ throughout: *yoga* → ioga, *Yeda* → Ieda). That puts it
     * through the ordinary ⟨i⟩ machinery, including the glide rule before another vowel:
     *
     *     Vichy → viʃi     curry → kuʁi     Madhya → madjɐ      (all three were *viʃ, *kuʁ, *madɐ)
     *
     * ⚠ NOT LEFT TO THE SHARED TABLE, which says /j/ — the consonantal value, right for German and English and
     * wrong for every Portuguese reading of the letter. `curry` → *kuʁj is a worse answer than the deletion it
     * replaces, which is the Chichewa ⟨cm⟩ → "kilometres" lesson: a fallback that fires where the language does
     * have an opinion is not an improvement.
     */
    private static readonly IReadOnlyDictionary<string, string> FOREIGN_LETTER =
        new Dictionary<string, string>(StringComparer.Ordinal) { ["y"] = "i" };

    private static readonly JsRe MARKS_RUN = JsRegex.Compile("\\p{M}+", "gu");

    /**
     * ⚠ A LETTER FROM SOMEONE ELSE'S ORTHOGRAPHY IS READ AS ITS BASE, NOT DELETED.
     *
     * The scan's `default:` used to drop anything it had no case for, and a foreign vowel is exactly that: ⟨è⟩ and
     * ⟨ï⟩ are not Portuguese accents, so `naïve` came out *nˈavɨ* and `Klöcker` *kɫkkˈeɾ* — a syllable short, with
     * two consonants welded together. Folding the marks away first makes each one the vowel it sits on, and the
     * whole vowel machinery downstream (nasalization lookahead, the falling-diphthong test, reduction, stress)
     * then sees an ordinary vowel instead of a character it must skip.
     *
     * ⚠ ONE CHARACTER FOR ONE CHARACTER, so every index, lookahead and `atEnd` test below still refers to the same
     * position it did before. A letter with no decomposition (ß, æ, ð) is left alone here and handled at the
     * `default:` branch, which is also where a non-letter goes.
     *
     * ⚠ AND ⟨ñ⟩ IS EXCLUDED FROM THE FOLD ON PURPOSE — it is in `KNOWN_LETTERS` and has its own case. Portuguese
     * has /ɲ/ and writes it ⟨nh⟩, so reading the Spanish letter as /n/ would discard a sound this language makes
     * daily (`Cañitas`, `señor`, `El Niño`). Same decision as Tagalog's ⟨ñ⟩, pinned in test/latin-tokenizers.
     */
    private static List<string> FoldForeignLetters(string w)
    {
        var cs = Js.CodePoints(w);
        if (cs.All(c => KNOWN_LETTERS.Contains(c))) return cs; // the overwhelmingly common case: no work
        return cs.Select(c =>
        {
            if (KNOWN_LETTERS.Contains(c)) return c;
            if (FOREIGN_LETTER.TryGetValue(c, out var named)) return named;
            var b = MARKS_RUN.Replace(c.Normalize(System.Text.NormalizationForm.FormD), "");
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

            // Consonant digraphs.
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
                // Vowel (nucleus). Nasal diphthongs and offglides handled by look-ahead.
                var nasal = NasalizedHere(w, i);
                // Word-final -m nasal endings: -am/-em → the diphthongs ɐ̃w̃ / ɐ̃j̃ (falam, homem, também); -om/-im/-um →
                // simple nasal vowels (bom → bõ, sim → sĩ, um → ũ).
                if (nx == "m" && nx2 == "" && (c == "a" || c == "á" || c == "e" || c == "é"))
                {
                    var acc = ACUTE_GRAVE.Contains(c, StringComparison.Ordinal); // á/é keep the stress; plain a/e stay unstressable
                    var isE = c == "e" || c == "é";
                    segs.Add(new Seg
                    {
                        // -am → [ɐ̃w̃] in both; -em → EP [ɐ̃j̃] but BP [ẽj̃] (tem → tẽj̃, homem → omẽj̃, viagem → viaʒẽj̃).
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
                // ou → monophthong [o] (standard EP: souto → sotu, amou → ɐmo), not a diphthong. raw="" so it does NOT
                // further reduce to u when unstressed (ouvir → oviɾ).
                if (c == "o" && nx == "u" && !nasal)
                {
                    segs.Add(new Seg { Ph = "o", Nucleus = true, Accent = false, Raw = "", Nasal = false });
                    i += 2;
                    continue;
                }
                // Nasal diphthongs: ão/ãe/õe (+ optional final s).
                if (c == "ã" && nx == "o") { PushV(segs, "ã", true); PushGlide(segs, "w̃", true); i += 2; continue; }
                if (c == "ã" && nx == "e") { PushV(segs, "ã", true); PushGlide(segs, "j̃", true); i += 2; continue; }
                if (c == "õ" && nx == "e") { PushV(segs, "õ", true); PushGlide(segs, "j̃", true); i += 2; continue; }
                PushV(segs, c, nasal);
                i++;
                // Absorb a coda nasal m/n that nasalized this vowel (it is not itself pronounced).
                if (nasal && (nx == "m" || nx == "n")) i++;
                // Oral offglide: a following unaccented i/u forms a falling diphthong (pai → paj, mau → maw, baixo → bajʃu)
                // — EXCEPT when it is a stressed hiatus nucleus, signalled by a final consonant other than s (raiz → ʁɐiʃ,
                // sair → sɐiɾ, possuir → pusuiɾ; but mais/dois keep the glide). The mais-vs-raiz split is otherwise lexical.
                var g = At(i);
                var after = At(i + 1);
                var hiatus = after != "" && after != "s" && !IsV(after) && At(i + 2) == ""; // i/u + final C(≠s)
                var accentedNext = after != "" && ACCENTED_VOWEL_CHARS.Contains(after); // guard ""; i/u before an accented vowel is hiatus (miúdo)
                // falling diphthong: i/u after a vowel, even before another (unaccented) vowel (praia → pɾajɐ, raio → ʁaju)
                if ((g == "i" || g == "u") && !hiatus && !accentedNext)
                {
                    PushGlide(segs, g == "i" ? "j" : "w", false);
                    i++;
                }
                continue;
            }

            // Single consonants (context-sensitive ones resolved downstream where they need neighbours).
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
                    // Not a Portuguese letter, but Portuguese has the sound and spells it ⟨nh⟩ — so the Spanish
                    // names its own corpus quotes (`Cañitas`) read with the palatal rather than losing it.
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
                    // What is left has no decomposition to fold (ß, æ, ð, þ) — the shared table names the phone
                    // each of those letters denotes. Non-letters return `undefined` and are still skipped.
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

    /** s/z realization by position: a single intervocalic s → z; any coda s/z → the coda sibilant (before voiceless /
     *  word-final) or its voiced pair (before a voiced consonant). ç, ss, soft-c and x are fixed /s/ or /ʃ/ (raw≠"s")
     *  and do not voice. The coda sibilant is postalveolar ʃ/ʒ in EP but ALVEOLAR s/z in (standard/paulistano) BP
     *  (luz → EP luʃ / BP lus; mesmo → EP meʒmu / BP mezmu) — the `dialect` selects the pair. */
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
                // onset / intervocalic
                if (prevV && !prev!.Nasal && s.Raw == "s") s.Ph = "z"; // single s voices (casa → kazɐ); NOT after a
                continue;                                             // nasal vowel (sansão → sɐ̃sɐ̃w̃) — an absorbed
            }                                                         // coda n precedes it. ç/ss/initial s stay s.
            s.Ph = next is null ? coda : VOICED.Contains(next.Ph) ? codaVoiced : coda; // coda → ʃ/ʒ (EP) or s/z (BP)
        }
    }
}
