/**
 * Dutch (Northern Standard) grapheme→phoneme engine. Latin, largely rule-governed. Handles the open/closed
 * syllable vowel-length system (tense in an open syllable, lax in a closed one), the Dutch diphthongs
 * (ij/ei→ɛi̯, ui→œy̯, ou/au→ɑu̯, eu→øː, oe→u), the g→ɣ (onset) / x (coda) split, sch→sx, w→ʋ, h→ɦ, and final
 * devoicing (hond→hɔnt, dag→dɑx). Stress is added downstream (dutch.ts).
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Dutch;

public sealed class Seg
{
    public string Ph = "";
    public int S;
    public bool Vowel;
}

public static class G2p
{
    private static IReadOnlyDictionary<string, string> LONG => Manifest.MANIFEST.Vowels.Long;
    private static IReadOnlyDictionary<string, string> SHORT => Manifest.MANIFEST.Vowels.Short;
    private static IReadOnlyDictionary<string, string> CONS => Manifest.MANIFEST.Consonants;
    private static IReadOnlyDictionary<string, string> VOICED_FINAL => Manifest.MANIFEST.VoicedFinal;

    // Plain + trema vowel letters. The trema letters (ë ï ö ü) are vowels but never combine with a preceding vowel
    // into a digraph (the scanner's digraph tests only match the plain letters), so ⟨tweeën⟩ scans twe·e·ën.
    // ⚠ THE CIRCUMFLEXES ARE DUTCH SPELLING, NOT FOREIGN DECORATION — Dutch keeps them on the French loans it has
    // naturalised (enquête, crêpe, gêne, coûte, blessûre). They were missing from this string, so the scan fell all
    // the way past the consonant switch and DELETED them: enquête → *ɛnkʋtə, crêpe → *krpeː, a nucleus short each.
    private const string VOWELS = "aeiouyáéíóúàèâêîôûäëïöü";
    // ⚠ `c !== ""` IS THE WHOLE GUARD, AND IT IS LOAD-BEARING: `VOWELS.includes("")` is TRUE in JS, and
    // `.NET Contains("")` is true too. The scanner reads past the end of the word constantly (`w[i+1] ?? ""`),
    // so without the empty test every word would end in a phantom vowel.
    private static bool IsV(string c) => c != "" && VOWELS.Contains(c, StringComparison.Ordinal);
    private static bool IsLiquid(string c) => c == "l" || c == "r";

    /** Number of consonant letters from index j up to the next vowel or word end. */
    private static int ConsRun(string w, int j)
    {
        var n = 0;
        while (j < w.Length && !IsV(At(w, j)))
        {
            n++;
            j++;
        }
        return n;
    }

    /** JS `w[i]` — the code UNIT at i, or "" past the end (the TS reads with `?? ""` throughout). */
    private static string At(string w, int i) => i >= 0 && i < w.Length ? w[i].ToString() : "";

    /** Is the single vowel at index i in an OPEN syllable (→ tense/long)? Open = word-final (ja, nu), a hiatus
     *  vowel (open), or a single consonant followed by another vowel (wa·ter → aː). Closed (VC#, VCC → lax): dag→ɑ,
     *  man→ɑ, kort→ɔ. Doubled vowels (aa/ee/oo/uu) are handled before this is called (always long). */
    private static bool IsOpen(string w, int i)
    {
        var run = ConsRun(w, i + 1);
        if (run == 0) return true; // word-final vowel, or hiatus (na·ïef, ze·e) → open
        if (run == 1) return IsV(At(w, i + 2)); // V.CV (open) vs VC# (closed)
        return false; // VCC… → closed
    }

    /** The TS builds `new RegExp(`[${VOWELS}]`, "u")` inside the ⟨ë⟩ branch on every call; the class is constant. */
    private static readonly JsRe ANY_VOWEL = JsRegex.Compile($"[{VOWELS}]", "u");

    /** Scan a lowercased Dutch word into IPA segments (no stress; g/ch voicing, devoicing applied here). */
    public static List<Seg> ToSegments(string word)
    {
        var w = word.ToLowerInvariant();
        var n = w.Length;
        var segs = new List<Seg>();
        var i = 0;
        void Push(string ph, int s, bool vowel = false) => segs.Add(new Seg { Ph = ph, S = s, Vowel = vowel });

        while (i < n)
        {
            string c = At(w, i), nx = At(w, i + 1), nx2 = At(w, i + 2), nx3 = At(w, i + 3);
            var seenVowel = segs.Any(s => s.Vowel);

            // ── Unstressed native suffixes (reduce their vowel). Gated so stressed monosyllables are untouched. ──
            if (c == "l" && nx == "i" && nx2 == "j" && nx3 == "k" && i > 0)
            {
                // -lijk suffix (mogelijk → …lək): ⟨ij⟩ → ə. Word-initial ⟨lijk⟩ (the noun "corpse" → lɛi̯k) is excluded
                // by i>0. Matches -lijk / -lijke / -lijkheid (only the ⟨lijk⟩ span is consumed).
                Push("l", i);
                Push("ə", i, true);
                Push("k", i);
                i += 4;
                continue;
            }

            // ── Glide-final vowel sequences (longest first). A ⟨w⟩ closing an u-glide diphthong is absorbed. ──
            if (c == "i" && nx == "e" && nx2 == "u" && nx3 == "w")
            {
                Push("i", i, true);
                Push("u̯", i);
                i += 4;
                continue;
            } // ieuw → iu̯ (nieuw)
            if (c == "e" && nx == "e" && nx2 == "u" && nx3 == "w")
            {
                Push("eː", i, true);
                Push("u̯", i);
                i += 4;
                continue;
            } // eeuw → eːu̯ (leeuw)
            if (c == "a" && nx == "a" && nx2 == "i")
            {
                Push("aː", i, true);
                Push("i̯", i);
                i += 3;
                continue;
            } // aai → aːi̯ (draai)
            if (c == "o" && nx == "o" && nx2 == "i")
            {
                Push("oː", i, true);
                Push("i̯", i);
                i += 3;
                continue;
            } // ooi → oːi̯ (mooi)
            if (c == "o" && nx == "e" && nx2 == "i")
            {
                Push("u", i, true);
                Push("i̯", i);
                i += 3;
                continue;
            } // oei → ui̯ (moeite)

            // ── Two-letter vowel digraphs. ──
            if (c == "i" && (nx == "j" || nx == "e"))
            {
                // ⟨ij⟩ → ɛi̯; ⟨ie⟩ → i (long). ⟨ie⟩ + ⟨ë⟩ is the -iën plural (knieën, bacteriën): ⟨ie⟩→i here and the
                // ⟨ë⟩ becomes its own schwa next iteration. (⟨ië⟩ without the ⟨e⟩ — Italië — never enters this branch.)
                if (nx == "j")
                {
                    Push("ɛi̯", i, true);
                    i += 2;
                    continue;
                }
                Push("i", i, true);
                i += 2;
                continue;
            } // ij → ɛi̯ ; ie → i
            if ((c == "e" || c == "a") && nx == "i")
            {
                Push("ɛi̯", i, true);
                i += 2;
                continue;
            } // ei / aai-less ai → ɛi̯ (klein; ⟨ai⟩ loans → ɛi̯)
            if (c == "u" && nx == "i")
            {
                Push("œy̯", i, true);
                i += 2;
                continue;
            } // ui → œy̯ (huis)
            if ((c == "o" || c == "a") && nx == "u")
            {
                Push("ɑu̯", i, true);
                i += nx2 == "w" ? 3 : 2; // ⟨ouw⟩/⟨auw⟩ → ɑu̯ (the closing w is absorbed: vrouw → vrɑu̯)
                continue;
            } // ou / au → ɑu̯ (koud, auto)
            if (c == "e" && nx == "u")
            {
                Push("øː", i, true);
                i += 2;
                continue;
            } // eu → øː (deur)
            if (c == "o" && nx == "e")
            {
                Push("u", i, true);
                i += 2;
                continue;
            } // oe → u (boek)
            // Doubled vowel → one long/tense vowel (aa/ee/oo/uu).
            if (nx == c && "aeou".Contains(c, StringComparison.Ordinal))
            {
                Push(LONG[c], i, true);
                i += 2;
                continue;
            }

            // ── Consonant digraphs / context. ──
            if (c == "s" && nx == "c" && nx2 == "h")
            {
                // sch → sx before a vowel (school → sxoːl, schip); word-final / before a consonant → s (typisch → …is,
                // mensch). The ⟨s⟩ + separate ⟨ch⟩ (this ⟨sch⟩) is the Dutch trigraph.
                if (IsV(nx3))
                {
                    Push("s", i);
                    Push("x", i);
                }
                else
                {
                    Push("s", i);
                }
                i += 3;
                continue;
            }
            if (c == "c" && nx == "h")
            {
                Push("x", i);
                i += 2;
                continue;
            } // ch → x (acht, licht, lachen)
            if (c == "n" && nx == "g")
            {
                Push("ŋ", i);
                i += 2;
                continue;
            } // ng → ŋ (zingen)
            if (c == "n" && nx == "k")
            {
                Push("ŋ", i);
                Push("k", i);
                i += 2;
                continue;
            } // nk → ŋk (bank)
            if (c == "t" && nx == "h")
            {
                Push("t", i);
                i += 2;
                continue;
            } // th → t (thee)
            if (c == "d" && nx == "t")
            {
                Push("t", i);
                i += 2;
                continue;
            } // dt → t (Brandt, hij wordt)
            if (c == "p" && nx == "h")
            {
                Push("f", i);
                i += 2;
                continue;
            } // ph → f (loan)
            if (c == "q" && nx == "u")
            {
                Push("k", i);
                Push("ʋ", i);
                i += 2;
                continue;
            } // qu → kʋ
            if (c == "s" && nx == "j")
            {
                Push("ʃ", i);
                i += 2;
                continue;
            } // sj → ʃ (sjaal, meisje)

            // ── Vowels (single letter). ──
            if (IsV(c))
            {
                // Word-final unstressed -ig suffix → əx (twintig → tʋɪntəx, gelukkig → …kəx). Gated on seenVowel so a
                // stressed monosyllable (big → bɪx, twijg) — where ⟨i⟩ is the first nucleus — keeps its full lax vowel.
                if (c == "i" && nx == "g" && nx2 == "" && seenVowel)
                {
                    Push("ə", i, true);
                    Push("x", i);
                    i += 2;
                    continue;
                }
                // Word-final Latinate -isch → is (tense ⟨i⟩ + s; the ⟨ch⟩ is silent): typisch → tipis, logisch → loːxis.
                if (c == "i" && nx == "s" && nx2 == "c" && nx3 == "h" && i + 4 == n)
                {
                    Push("i", i, true);
                    Push("s", i);
                    i += 4;
                    continue;
                }
                // A single ⟨e⟩ that is NOT the first vowel nucleus reduces to schwa (Dutch default stress is initial:
                // water → ʋaːtər, achterbos → ɑxtərbɔs, zeven → zeːvə, de → də). The ⟨ee/ei/eu/ie⟩ digraphs and the
                // stressed first ⟨e⟩ (eten → eːtə) are consumed earlier, so they keep their full quality. Non-initial
                // FULL-vowel ⟨e⟩ (loanword second-syllable stress, protest → proːtɛst) is the minority residual.
                if (c == "e" && seenVowel)
                {
                    Push("ə", i, true);
                    i++;
                    continue;
                }
                // Trema ⟨ë⟩ in a final -ën / -ë ending (a hiatus/plural schwa: tweeën → tʋeːə, ideeën, knieën) → schwa.
                // A stressed ⟨ë⟩ with more material after it (poëzie → poːeːzi) keeps its full quality (falls through).
                if (c == "ë" && seenVowel && !ANY_VOWEL.IsMatch(w[(i + 1)..]))
                {
                    Push("ə", i, true);
                    i++;
                    continue;
                }
                // Trema/accented letters and plain vowels use the open/closed length rule.
                // ⚠ The circumflex joins the row its base is already on, rather than getting a value of its own:
                // this file's own precedent is that every accent Dutch writes on a vowel (á à ä é è ë …) reads as
                // the plain letter under the open/closed length rule, and a separate quality for ⟨ê⟩ would be a new
                // phonological claim with no referee behind it.
                var bas = "áàâä".Contains(c, StringComparison.Ordinal) ? "a"
                    : "éèêë".Contains(c, StringComparison.Ordinal) ? "e"
                    : "íìîï".Contains(c, StringComparison.Ordinal) ? "i"
                    : "óòô".Contains(c, StringComparison.Ordinal) ? "o"
                    : "úùû".Contains(c, StringComparison.Ordinal) ? "u"
                    : c;
                var lng = LONG.TryGetValue(bas, out var l1) ? l1 : LONG.TryGetValue(c, out var l2) ? l2 : "";
                var shrt = SHORT.TryGetValue(bas, out var s1) ? s1 : SHORT.TryGetValue(c, out var s2) ? s2 : "";
                Push(IsOpen(w, i) ? lng : shrt, i, true);
                i++;
                continue;
            }

            // ── Context-dependent consonants. ──
            if (c == "g")
            {
                // g → ɣ in the onset (before a vowel, or a liquid + vowel: geven→ɣ, groot→ɣr); → x in a coda
                // (dag→dɑx, magd, zorgt). ⟨gg⟩ → ɣ (zeggen → zɛɣə). Final devoicing already covered by the coda→x here.
                var onset = IsV(nx) || (nx == "g" && IsV(nx2)) || (IsLiquid(nx) && IsV(nx2));
                Push(onset ? "ɣ" : "x", i);
                if (nx == "g") i++; // gg → single
                i++;
                continue;
            }
            if (c == "c")
            {
                Push("eiyíé".Contains(nx, StringComparison.Ordinal) ? "s" : "k", i);
                i++;
                continue;
            } // c → s before e/i/y, else k
            if (c == "h")
            {
                Push("ɦ", i);
                i++;
                continue;
            } // h → ɦ (voiced glottal). Silent-h after a vowel (thee already handled via th) is rare; kept as onset.
            if (c == "x")
            {
                Push("k", i);
                Push("s", i);
                i++;
                continue;
            } // x → ks
            if (c == "r" && nx == "r")
            {
                i++;
                continue;
            } // rr → single r (falls through to the r switch next iteration)

            if (c == "ñ")
            {
                // ⚠ READ AS ⟨nj⟩, WHICH IS HOW THIS ENGINE ALREADY SPELLS THE PALATAL NASAL (Spanje → spɑnjə,
                // oranje). Not a Dutch letter, but Dutch borrows the names that carry it and used to DELETE it
                // (Cañitas → *kaːitɑs, a consonant short). Emitting /ɲ/ instead would be a phone Dutch has nowhere
                // else in this engine's output; emitting /n/ alone would throw the palatal away.
                Push("n", i);
                Push("j", i);
                i++;
                continue;
            }
            var cp = CONS.TryGetValue(c, out var cpv) ? cpv : null;
            // ⚠ NOT SILENTLY when the consonant table has nothing either. Everything Dutch spells was matched
            // above, so what reaches here is a letter out of someone else's alphabet inside a name; the shared
            // table names the phone it denotes rather than dropping it. Non-letters return `undefined`.
            var ph = cp ?? LatinPhones.LatinPhone(c, new PhoneOpts { Initial = i == 0 });
            if (ph is not null) Push(ph, i);
            i++;
        }

        // Collapse doubled consonants (Dutch writes them only to mark a short vowel: bakken→bɑkə, zeggen handled).
        var outp = new List<Seg>();
        foreach (var s in segs)
        {
            var prev = outp.Count > 0 ? outp[^1] : null;
            if (prev is not null && !prev.Vowel && !s.Vowel && prev.Ph == s.Ph && s.Ph.Length == 1) continue;
            outp.Add(s);
        }
        FinalDevoice(outp);
        return outp;
    }

    /** Auslautverhärtung: a voiced obstruent that is word-final or before a voiceless consonant devoices. */
    private static void FinalDevoice(List<Seg> segs)
    {
        for (var k = 0; k < segs.Count; k++)
        {
            var s = segs[k];
            if (!VOICED_FINAL.TryGetValue(s.Ph, out var dev) || dev == "") continue;
            var next = k + 1 < segs.Count ? segs[k + 1] : null;
            // Devoice a coda voiced obstruent word-finally, before a voiceless obstruent, or before another voiced
            // obstruent that will itself devoice (the whole coda cluster devoices). Before a sonorant/vowel it is an
            // onset and stays voiced (bever, adem).
            if (next is null
                || (!next.Vowel
                    && ("ptksfxʃ".Contains(next.Ph.Length > 0 ? next.Ph[0].ToString() : "", StringComparison.Ordinal)
                        // JS truthiness: a devoicing entry counts only if it is a NON-EMPTY string.
                        || (VOICED_FINAL.TryGetValue(next.Ph, out var nd) && nd != ""))))
                s.Ph = dev;
        }
    }
}
