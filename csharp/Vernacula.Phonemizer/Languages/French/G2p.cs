/**
 * French grapheme→phoneme engine (standard/Parisian French, broad IPA). French orthography is deep but
 * rule-GOVERNED in the reading direction: a left-to-right scan with context + longest-match multigraphs,
 * plus silent-final and glide handling. Irregular words are caught by an exception lexicon upstream
 * (french.ts). for the convention (ø œ ʁ ɥ ɲ nasals).
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.French;

public static class G2p
{
    // All French DATA — letter inventory, oral/nasal vowel-multigraph tables, yod groups, sounded-final set — is
    // consolidated in french.jsonc; here we bind it to the local names the scanning algorithm below uses.
    private static string VOWEL_LETTERS => Manifest.MANIFEST.VowelLetters;
    private static bool IsV(string c) => c != "" && VOWEL_LETTERS.Contains(c, StringComparison.Ordinal);
    private static IReadOnlyList<string[]> VOWEL_GROUPS => Manifest.MANIFEST.VowelGroups;
    private static IReadOnlyList<string[]> NASAL_GROUPS => Manifest.MANIFEST.NasalGroups;
    private static readonly IReadOnlySet<string> FINAL_SOUNDED =
        new HashSet<string>(Manifest.MANIFEST.FinalSounded, StringComparer.Ordinal);
    private static IReadOnlyList<string[]> YOD_DOUBLE => Manifest.MANIFEST.YodDouble;
    private static IReadOnlyList<string[]> YOD_FINAL => Manifest.MANIFEST.YodFinal;

    /** True when position k begins a silent word-final tail: end of word, or a plural -s at the end (belle, hommes). */
    private static bool SilentTail(string w, int k)
    {
        var c = At(w, k);
        return c == "" || (c == "s" && At(w, k + 1) == "");
    }

    private static string At(string w, int k) => k >= 0 && k < w.Length ? w[k].ToString() : "";

    /** eu/œu is "closed" (→ œ not ø) when a pronounced consonant CLOSES the syllable: word-final sounded C
     *  (peur, seul), a coda before another consonant, or a C before a silent final -e(s) (jeune, heure). Open (→ ø)
     *  when word-final vowel/end (feu), an onset before a vowel (heureux), or an obstruent+liquid onset (o.bli). */
    private static bool EuClosed(string w, int a)
    {
        var c1 = At(w, a);
        if (c1 == "" || IsV(c1)) return false;
        if (c1 == "x" && At(w, a + 1) != "") return true; // pronounced mid-word ⟨x⟩=[ks]/[ɡz] closes (sexuel→sɛ, texte→tɛ, examen→ɛ); word-final ⟨x⟩ is silent (deux→dø) and falls through
        var c2 = At(w, a + 1);
        if (c2 == "") return "rlfcqkbɡv".Contains(c1, StringComparison.Ordinal); // V+C$ → closed iff C is sounded
        // A double consonant CLOSES the preceding syllable for vowel QUALITY — standard loi de position: comme→kɔm,
        // comment→kɔmɑ̃, donner→dɔne, occuper→ɔkype, belle→bɛl (Lexique's merged [o]/[e] here is non-standard).
        if (c1 == c2) return true;
        if (c2 == "e" && SilentTail(w, a + 2)) return true; // V+C+e(s)$ (jeune, heure, belle) → closed
        // obstruent + liquid before a PRONOUNCED vowel = tautosyllabic onset (pro.blème, de.vrais) → syllable stays open
        var c3 = At(w, a + 2);
        if (
            "pbcdfgktv".Contains(c1, StringComparison.Ordinal) &&
            (c2 == "l" || c2 == "r") &&
            !((c1 == "t" || c1 == "d") && c2 == "l") &&
            IsV(c3) &&
            !(c3 == "e" && SilentTail(w, a + 3))
        )
            return false;
        return !IsV(c2); // V+CC → closed ; V+C+V → open
    }

    /** Bare ⟨o⟩ is [ɔ] by DEFAULT — standard French: closed syllables (porte→pɔʁt, comme→kɔm) AND open ones
     *  (voler→vɔle, joli→ʒɔli, photo→fɔto, poème→pɔɛm). It is [o] only in the restricted set: word-final OPEN
     *  (mot, piano, abdo), before [z] (rose, chose). (⟨ô⟩/⟨au⟩/⟨eau⟩→[o] are separate graphemes, not this case.) */
    private static bool OClosed(string w, int a)
    {
        var c1 = At(w, a);
        if (c1 == "") return false; // word-final open → o
        if (c1 == "z") return false; // before z → o
        if (c1 == "s" && IsV(At(w, a + 1))) return false; // o + intervocalic ⟨s⟩ (→[z]) → o (rose, poser, position, philosophe)
        if (At(w, a + 1) == "" && "tsdpx".Contains(c1, StringComparison.Ordinal)) return false; // o + silent final C → o (mot, gros, abdo)
        return true; // everything else (closed OR open) → ɔ
    }

    private static string VOWEL_PH => Manifest.MANIFEST.VowelPhonemes; // IPA vowel starts (for schwa-deletion consonant counting)
    private static bool IsConsPh(string ph) =>
        ph.Length >= 1 && !VOWEL_PH.Contains(ph[0].ToString(), StringComparison.Ordinal);
    // A phoneme carries a syllable nucleus if any of its chars is a vowel (catches multi-char glides+vowel: wa, ɥi, jɛ̃).
    private static bool HasNucleus(string ph) =>
        Js.CodePoints(ph).Any(c => VOWEL_PH.Contains(c, StringComparison.Ordinal));
    // A front vowel softens c→s / g→ʒ. NB: guard "" — "abc".includes("") is true, which would soften a word-final c/g.
    private static bool IsFront(string ch) => ch != "" && "eiéèêyœæ".Contains(ch, StringComparison.Ordinal);

    private sealed class Ph
    {
        public required string P;
        public required int S;
    }

    private static readonly JsRe VOWEL_RUN = JsRegex.Compile("[aeiouyɛɔøœəɑ]", "g");
    private static readonly JsRe ENDS_VOWEL_RE = JsRegex.Compile("[aeiouyɛɔøœəɑ]̃?$", "");

    /** French word → broad IPA (no stress; French is phrase-final-stressed, added at the prosody layer). */
    public static string ToIpa(string word)
    {
        var w = word.ToLowerInvariant();
        var n = w.Length;
        string AtW(int k) => At(w, k);
        var seg = new List<Ph>(); // phoneme + source start index (for silent-final/doubles)
        void Push(string ph, int s) => seg.Add(new Ph { P = ph, S = s });
        var i = 0;

        // Special endings resolved up front (they override the letter scan).
        // -ent as a 3rd-person-plural verb ending is silent; but we can't know POS, so treat word-final "ent"
        // after a vowel-stem as silent only for the common "-ent" verb pattern is ambiguous → leave to lexicon.

        while (i < n)
        {
            string c = AtW(i), nx = AtW(i + 1), nx2 = AtW(i + 2);
            var rest = w[i..];
            bool AtEnd(int len) => i + len >= n;

            // vowel + ill/il → yod (aille → aj, travail → tʁavaj, fille handled below).
            var yod = false;
            foreach (var pair in YOD_DOUBLE)
                if (rest.StartsWith(pair[0], StringComparison.Ordinal))
                {
                    Push(pair[1], i);
                    i += pair[0].Length;
                    yod = true;
                    break;
                }
            if (!yod)
                foreach (var pair in YOD_FINAL)
                    if (rest.StartsWith(pair[0], StringComparison.Ordinal) && i + pair[0].Length >= n)
                    {
                        Push(pair[1], i);
                        i += pair[0].Length;
                        yod = true;
                        break;
                    }
            if (yod) continue;

            // Nasal vowel: a vowel-group + n/m, not followed by a vowel, not doubled. (Runs before `ai` so pain→pɛ̃
            // is taken as a nasal, while laine/aime fall through to `ai` below.)
            var nasal = false;
            foreach (var pair in NASAL_GROUPS)
            {
                var g = pair[0];
                if (rest.StartsWith(g, StringComparison.Ordinal))
                {
                    var after = AtW(i + g.Length);
                    var doubled =
                        (g.EndsWith("n", StringComparison.Ordinal) && after == "n") ||
                        (g.EndsWith("m", StringComparison.Ordinal) && after == "m");
                    if (!IsV(after) && !doubled)
                    {
                        Push(pair[1], i);
                        i += g.Length;
                        nasal = true;
                        break;
                    }
                }
            }
            if (nasal) continue;

            // ai → ɛ (laine, mais, vraiment, maison) — the Lexique convention renders it ɛ across positions.
            if (rest.StartsWith("ai", StringComparison.Ordinal))
            {
                Push("ɛ", i);
                i += 2;
                continue;
            }

            // ou before a vowel → glide w (oui → wi, accouer → akwe).
            if (rest.StartsWith("ou", StringComparison.Ordinal) && IsV(nx2))
            {
                Push("w", i);
                i += 2;
                continue;
            }
            // t before i+vowel → s (nation → nasjɔ̃, abbatial → abasjal), except after s (question → kɛstjɔ̃).
            if (c == "t" && nx == "i" && IsV(nx2) && AtW(i - 1) != "s")
            {
                Push("s", i);
                i++;
                continue;
            }

            // eu / œu / eû: œ in a closed syllable (peur, seul), ø in open (deux, feu, jeûne).
            if (rest.StartsWith("eu", StringComparison.Ordinal) ||
                rest.StartsWith("œu", StringComparison.Ordinal) ||
                rest.StartsWith("eû", StringComparison.Ordinal))
            {
                var g = rest.StartsWith("œu", StringComparison.Ordinal)
                    ? "œu"
                    : rest.StartsWith("eû", StringComparison.Ordinal)
                      ? "eû"
                      : "eu";
                Push(EuClosed(w, i + g.Length) ? "œ" : "ø", i);
                i += g.Length;
                continue;
            }

            // ⟨au⟩/⟨eau⟩ before ⟨r⟩ lowers to [ɔ] (standard: restaurant→ʁɛstɔʁɑ̃, aurais→ɔʁɛ, dinosaure→dinozɔʁ,
            // Laure→lɔʁ). Everywhere else ⟨au⟩/⟨eau⟩ stays [o] (handled by the vowel-group table below).
            if (rest.StartsWith("au", StringComparison.Ordinal) || rest.StartsWith("eau", StringComparison.Ordinal))
            {
                var g = rest.StartsWith("eau", StringComparison.Ordinal) ? "eau" : "au";
                if (AtW(i + g.Length) == "r")
                {
                    Push("ɔ", i);
                    i += g.Length;
                    continue;
                }
            }

            // Oral vowel multigraphs (longest first).
            var vg = false;
            foreach (var pair in VOWEL_GROUPS)
                if (rest.StartsWith(pair[0], StringComparison.Ordinal))
                {
                    Push(pair[1], i);
                    i += pair[0].Length;
                    vg = true;
                    break;
                }
            if (vg) continue;

            // Consonant digraphs / context.
            if (c == "c" && (nx == "'" || nx == "’")) { Push("s", i); i++; continue; } // elided c' (ce/ça) → s, not k
            if (c == "c" && nx == "h") { Push("ʃ", i); i += 2; continue; }
            if (c == "p" && nx == "h") { Push("f", i); i += 2; continue; }
            if (c == "t" && nx == "h") { Push("t", i); i += 2; continue; }
            if (c == "g" && nx == "n") { Push("ɲ", i); i += 2; continue; }
            if (c == "q" && nx == "u") { Push("k", i); i += 2; continue; } // qu → k
            if (c == "g" && nx == "u" && IsFront(nx2)) { Push("ɡ", i); i += 2; continue; } // gue/gui → ɡ (u silent)
            if (c == "i" && "ll".Contains(nx, StringComparison.Ordinal) && AtW(i + 2) == "l"
                && !"mtv".Contains(AtW(i - 1), StringComparison.Ordinal))
            {
                // -ill- → ij (fille → fij). Rough; ville/mille/tranquille exceptions handled by lexicon.
                Push("ij", i);
                i += 3;
                continue;
            }

            switch (c)
            {
                case "a":
                case "à":
                    Push("a", i);
                    i++;
                    break;
                case "e":
                {
                    // e: silent word-final; ə mid-word; but before a double consonant / two consonants → ɛ.
                    // final e — silent (choses → ʃoz), also before a silent plural -s (e + final s); ə in a monosyllable (le, je)
                    if (AtEnd(1) || (nx == "s" && AtEnd(2)))
                    {
                        if (!seg.Any(s => HasNucleus(s.P))) Push("ə", i);
                        i++;
                        break;
                    }
                    if (nx == "r" && AtEnd(2) && seg.Any(s => HasNucleus(s.P)))
                    {
                        Push("e", i);
                        i += 2;
                        break;
                    } // -er → e (polysyllable: manger); monosyllable mer/cher falls through → ɛʁ
                    if (nx == "z" && AtEnd(2)) { Push("e", i); i += 2; break; } // -ez → e
                    if (nx == "t" && AtEnd(2)) { Push("ɛ", i); i += 2; break; } // -et → ɛ
                    // e → ɛ in a closed syllable (mer, sel, accentuel, belle); ə in an open one (later maybe deleted).
                    Push(EuClosed(w, i + 1) ? "ɛ" : "ə", i);
                    i++;
                    break;
                }
                case "i":
                case "y":
                {
                    // i/y before a PRONOUNCED vowel → glide j; before a silent final -e = nucleus i
                    var glide = IsV(nx) && !(nx == "e" && AtEnd(2));
                    var p1 = seg.Count >= 1 ? seg[^1] : null;
                    var p2 = seg.Count >= 2 ? seg[^2] : null;
                    // after an obstruent+liquid cluster (bʁ, tʁ, kl…) an i-glide needs a supporting [i]: abrier → abʁije
                    var clusterBefore =
                        p1 is not null &&
                        p2 is not null &&
                        IsConsPh(p1.P) &&
                        IsConsPh(p2.P) &&
                        (p1.P == "ʁ" || p1.P == "l");
                    if (glide && clusterBefore)
                    {
                        Push("i", i);
                        Push("j", i);
                    }
                    else Push(glide ? "j" : "i", i);
                    i++;
                    break;
                }
                case "o": // [o] word-final / open / before z (rose, abdo); [ɔ] in a closed syllable (porte)
                    Push(OClosed(w, i + 1) ? "ɔ" : "o", i);
                    i++;
                    break;
                case "u":
                    Push(IsV(nx) ? "ɥ" : "y", i);
                    i++;
                    break; // u before vowel → glide ɥ (huit → ɥi)
                case "b":
                    Push("b", i);
                    i++;
                    break;
                case "c":
                    Push(IsFront(nx) ? "s" : "k", i);
                    i++;
                    break;
                case "ç":
                    Push("s", i);
                    i++;
                    break;
                case "d":
                    Push("d", i);
                    i++;
                    break;
                case "f":
                    Push("f", i);
                    i++;
                    break;
                case "g":
                    Push(IsFront(nx) ? "ʒ" : "ɡ", i);
                    i++;
                    break;
                case "h":
                    i++;
                    break; // silent
                case "j":
                    Push("ʒ", i);
                    i++;
                    break;
                case "k":
                    Push("k", i);
                    i++;
                    break;
                case "l":
                    Push("l", i);
                    i++;
                    break;
                case "m":
                    Push("m", i);
                    i++;
                    break;
                case "n":
                    Push("n", i);
                    i++;
                    break;
                case "p":
                    Push("p", i);
                    i++;
                    break;
                case "r":
                    Push("ʁ", i);
                    i++;
                    break;
                case "s":
                    Push(IsV(AtW(i - 1)) && IsV(nx) ? "z" : "s", i);
                    i++;
                    break; // intervocalic s → z
                case "t":
                    Push("t", i);
                    i++;
                    break;
                case "v":
                case "w":
                    Push("v", i);
                    i++;
                    break;
                case "x":
                    Push("ks", i);
                    i++;
                    break;
                case "z":
                    Push("z", i);
                    i++;
                    break;
                case "œ":
                    Push("œ", i);
                    i++;
                    break;
                default:
                {
                    // ⚠ NOT SILENTLY. Everything French has an opinion about was matched above (including the
                    // accents French WRITES — à â é è ê î ï ô ù û ü œ are all vowel letters or vowel groups), so
                    // what reaches here is a letter from someone else's orthography inside a name: `Málaga` was
                    // *mlaɡa, `Taínos` *tanos, `Cañitas` *kaita. `latinPhone` reads the letter the marks sit on,
                    // and gives ⟨ñ⟩ its own /ɲ/ — a phoneme French already has and spells ⟨gn⟩, so folding it to
                    // /n/ here would throw away a sound this language can pronounce. Non-letters (the apostrophe
                    // this branch also catches) return `undefined` and are still skipped.
                    var ph = LatinPhones.LatinPhone(c, new PhoneOpts { Initial = i == 0 });
                    if (ph is not null) Push(ph, i);
                    i++;
                    break;
                }
            }
        }

        // Post-pass 1 — collapse geminate consonants first (French has no phonemic length): homme → ɔm, belle → bɛl.
        var dedup = new List<Ph>();
        foreach (var s in seg)
        {
            var prev = dedup.Count > 0 ? dedup[^1] : null;
            if (prev is not null && prev.P == s.P && IsConsPh(s.P) && s.P.Length == 1) continue;
            dedup.Add(s);
        }

        // Post-pass 2 — hiatus-schwa deletion only: drop a word-internal ə that directly follows a VOWEL
        // (aboiement → abwamɑ̃, aient → ɛ). The loi des trois consonnes (VCəCV → VCCV, maintenant) is a prosodic
        // reduction, NOT applied here: the Lexique convention keeps the citation schwa (maintenant → mɛ̃tənɑ̃).
        var collapsed = new List<Ph>();
        for (var p = 0; p < dedup.Count; p++)
        {
            if (dedup[p].P == "ə" && p > 0 && p < dedup.Count - 1)
            {
                var before1 = dedup[p - 1];
                var after = dedup[p + 1];
                bool EndsVowel(Ph? s) => s is not null && ENDS_VOWEL_RE.IsMatch(s.P);
                if (EndsVowel(before1) && IsConsPh(after.P)) continue; // hiatus schwa → delete
            }
            collapsed.Add(dedup[p]);
        }

        // Post-pass 2 — silent final consonant CLUSTER (only when the word ends in a CONSONANT; a final silent -e
        // makes the preceding consonant sounded, so homme → ɔm, table → tabl are untouched). Drop trailing
        // consonant letters that aren't sounded (c/r/f/l/q/k/b/g stay): temps → tɑ̃, corps → kɔʁ, sport → spɔʁ.
        if (At(w, n - 1) != "e")
        {
            var cut = n;
            for (var k = n - 1; k >= 0; k--)
            {
                var ch = At(w, k);
                if (IsV(ch)) break; // reached a vowel → stop
                if (FINAL_SOUNDED.Contains(ch)) break; // sounded final consonant → keep it, stop
                cut = k; // silent final consonant → drop its phoneme(s)
            }
            while (collapsed.Count > 0 && collapsed[^1].S >= cut) collapsed.RemoveAt(collapsed.Count - 1);
        }

        return string.Concat(collapsed.Select(x => x.P));
    }
}
