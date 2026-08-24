/**
 * German (Standard/Hochdeutsch) grapheme→phoneme engine. Latin, largely rule-governed. Handles long/short
 * vowels (from spelling), diphthongs (ei/au/eu → aɪ̯/aʊ̯/ɔʏ̯), the ch ich-laut/ach-laut split, sch and
 * word-initial sp-/st-, final devoicing, r-vocalization, and schwa in unstressed endings. Stress is added
 * downstream (german.ts).
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.German;

public sealed class Seg
{
    public required string Ph;
    public required int S;
    public required bool Vowel;
}

public static class G2p
{
    private const string VOWELS = "aeiouäöüy";
    private static bool IsV(string c) => c != "" && VOWELS.Contains(c, StringComparison.Ordinal);

    // Long / short vowel IPA, context-free consonant letters, and final-devoicing pairs — from german.jsonc.
    private static IReadOnlyDictionary<string, string> LONG => Manifest.MANIFEST.Vowels.Long;
    private static IReadOnlyDictionary<string, string> SHORT => Manifest.MANIFEST.Vowels.Short;
    private static IReadOnlyDictionary<string, string> CONS => Manifest.MANIFEST.Consonants;
    private static IReadOnlyDictionary<string, string> VOICED_FINAL => Manifest.MANIFEST.VoicedFinal;

    private static string At(string w, int k) => k >= 0 && k < w.Length ? w[k].ToString() : "";

    /** Number of consonant letters from index j up to the next vowel or word end. */
    private static int ConsRun(string w, int j)
    {
        var n = 0;
        while (j < w.Length && !IsV(w[j].ToString()))
        {
            n++;
            j++;
        }
        return n;
    }

    // Short-vowel function words + long-⟨ch⟩ stems (exception lists from german.jsonc).
    private static readonly IReadOnlySet<string> SHORT_MONO =
        new HashSet<string>(Manifest.MANIFEST.ShortMonosyllables, StringComparer.Ordinal);

    /** The vowels that are always FULL in German orthography — ⟨e⟩ and ⟨i⟩ are excluded because they are the
     *  two that reduce (schwa in -en/-e, [ɪ] in -ig). Two rules turn on exactly this distinction: the ⟨i⟩-glide
     *  in medial hiatus (Liberia → …ʁi̯a) and the post-vowel ⟨h⟩ at a prefix boundary (be·haglich keeps its h,
     *  ge·hen does not). Named so the two cannot drift apart, and so an edit to one is not silently an edit to
     *  both — a sed over the bare literal hit both rules at once while this was being written. */
    private const string FULL_VOWEL = "aouäöü";

    private static IReadOnlyList<string> LONG_CH => Manifest.MANIFEST.LongCh;
    // Words where a leading ⟨ge⟩/⟨er⟩ is NOT a prefix → ⟨st⟩ stays alveolar (gestern, erst); see german.jsonc.
    private static readonly IReadOnlySet<string> ST_KEEP =
        new HashSet<string>(Manifest.MANIFEST.Morphology.StKeepWords, StringComparer.Ordinal);

    private static readonly JsRe PREFIX_ST = JsRegex.Compile("^(be|ge|ver|zer|ent|emp|er)$", "");
    private static readonly JsRe ANY_VOWEL = JsRegex.Compile("[aeiouäöüy]", "");
    private static readonly JsRe H_PREFIX = JsRegex.Compile("(be|ge|ver|zer|er|vor|zu|un|emp|ent|miss)$", "");

    /** Is the vowel at index i long? V+h, doubled vowel and ie → long; V+double-C / ck / tz / ≥2 C → short;
     *  V+single-C(+vowel|end) → long (open syllable). */
    private static bool IsLong(string w, int i)
    {
        string c = At(w, i), nx = At(w, i + 1), nx2 = At(w, i + 2);
        if (SHORT_MONO.Contains(w)) return false; // das, in, mit … (function words)
        if (nx == "h") return true; // Uhr, sehen (h silent, lengthens)
        if (nx == c && "aeou".Contains(c, StringComparison.Ordinal)) return true; // Saat, See, Boot
        if (nx == "ß") return true; // Straße, Fuß
        if (nx == "c" && nx2 == "h") return LONG_CH.Any(s => w.StartsWith(s, StringComparison.Ordinal)); // nach/Buch/suchen long; ach/Bach short
        var run = ConsRun(w, i + 1);
        if (run >= 2) return false; // Wasser, kommen, Angst, ck, tz, sch → short
        return true; // Vater, gut, Tag, Hof (single C → long)
    }

    /** ch after a back vowel a/o/u (incl. au) → ach-laut x; otherwise ich-laut ç (ich, Milch, Bücher). */
    // ⚠ NO EMPTY GUARD, DELIBERATELY. `prevVowel` is "" until the scan has seen a vowel, and JS
    // `"aou".includes("")` is TRUE — so a ⟨ch⟩ with no preceding vowel takes the ach-laut. .NET's
    // `Contains("")` is true as well, so the plain call reproduces it; adding a `!= ""` guard would silently
    // flip those words to ç.
    private static string ChSound(string prevVowel) =>
        "aou".Contains(prevVowel, StringComparison.Ordinal) ? "x" : "ç";

    /** Scan a lowercased German word into IPA segments (no stress; devoicing + r-vocalization applied here). */
    public static List<Seg> ToSegments(string word)
    {
        var w = word.ToLowerInvariant();
        var n = w.Length;
        var segs = new List<Seg>();
        var i = 0;
        void Push(string ph, int s, bool vowel = false) => segs.Add(new Seg { Ph = ph, S = s, Vowel = vowel });
        var lastVowelLetter = "";

        while (i < n)
        {
            string c = At(w, i), nx = At(w, i + 1), nx2 = At(w, i + 2), nx3 = At(w, i + 3);
            var initial = i == 0;

            // Diphthongs.
            if ((c == "e" || c == "a") && nx == "i") { Push("aɪ̯", i, true); lastVowelLetter = "i"; i += 2; continue; }
            if (c == "a" && nx == "u") { Push("aʊ̯", i, true); lastVowelLetter = "u"; i += 2; continue; }
            // Word-final French -eur → øːɐ̯ (Friseur → fʁizøːɐ̯, Amateur, Ingenieur): NOT the ⟨eu⟩ diphthong ɔʏ̯. Only
            // word-final ⟨eur⟩ (i+3===n) is the loan suffix; ⟨-euer⟩ (Steuer → ʃtɔʏ̯ɐ) is eu+er and stays the diphthong.
            if (c == "e" && nx == "u" && nx2 == "r" && i + 3 == n)
            {
                Push("øː", i, true);
                Push("ɐ̯", i);
                lastVowelLetter = "u";
                i += 3;
                continue;
            }
            if ((c == "e" && nx == "u") || (c == "ä" && nx == "u")) { Push("ɔʏ̯", i, true); lastVowelLetter = "u"; i += 2; continue; }

            // Latin -tion/-tial suffixes: ⟨t⟩ + ⟨i⟩ + ⟨o⟩ (or ⟨ia⟩ + ⟨l⟩) → t͡s + i̯ (non-syllabic glide) + the vowel
            // (nation → nat͡si̯oːn, initial → init͡si̯aːl, rational → ʁat͡si̯oːnaːl). ti+o always (reliably Latin); ti+a
            // ONLY before ⟨l⟩ (-tial) so ⟨-tian⟩ NAMES (Christian, Bastian → ti) don't misfire; word-final ⟨-tie⟩ /
            // the ⟨ie⟩ digraph (Garantie → …tiː) is ti+e and also unmatched.
            if (c == "t" && nx == "i" && (nx2 == "o" || (nx2 == "a" && nx3 == "l")))
            {
                Push("t͡s", i);
                Push("i̯", i);
                lastVowelLetter = "i";
                i += 2;
                continue;
            }

            // Consonant digraphs / context.
            if (c == "s" && nx == "c" && nx2 == "h") { Push("ʃ", i); i += 3; continue; } // sch → ʃ
            if (c == "s" && nx == "s") { Push("s", i); i += 2; continue; } // ss → s
            if (c == "ß") { Push("s", i); i++; continue; }
            // sp-/st- → ʃp/ʃt word-initially or after a derivational prefix (bestimmt → bəʃtɪmt, verstehen → fɛɐ̯ʃteːən).
            if (c == "s" && (nx == "p" || nx == "t")
                && (initial || (!ST_KEEP.Contains(w) && PREFIX_ST.IsMatch(w[..i]))))
            {
                Push("ʃ", i);
                i++;
                continue;
            }
            if (c == "c" && nx == "h")
            {
                // Word-initial ⟨ch⟩ is never the ach-laut x: → ç before a front vowel (China → çiːna, Chemie → çe…),
                // → k before a consonant or back vowel (Christ → kʁ…, Chaos → k…, Chlor → k…). (French ⟨ch⟩→ʃ in
                // Chef/Chance is lexical, left as residual.) Mid-word ⟨ch⟩ uses the ach/ich-laut rule.
                if (initial) Push("eiäöüy".Contains(nx2, StringComparison.Ordinal) ? "ç" : "k", i); // empty nx2 → true, as in JS
                else Push(ChSound(lastVowelLetter), i);
                i += 2;
                continue;
            } // ch → x/ç/k
            if (c == "c" && nx == "k") { Push("k", i); i += 2; continue; } // ck → k
            // -igk- (the -igkeit suffix): ⟨g⟩ between ⟨i⟩ and ⟨k⟩ → ç (ich-laut), not the devoiced k
            // (geschwindigkeit → …ɪçkaɪt). ⟨igl⟩ (königlich k / Iglu ɡ) is lexical, left alone.
            if (c == "g" && At(w, i - 1) == "i" && nx == "k") { Push("ç", i); i++; continue; }
            if (c == "t" && nx == "s" && nx2 == "c" && nx3 == "h") { Push("t͡ʃ", i); i += 4; continue; } // tsch → t͡ʃ
            if (c == "t" && nx == "z") { Push("t͡s", i); i += 2; continue; } // tz → t͡s
            if (c == "d" && nx == "t") { Push("t", i); i += 2; continue; } // dt → t (Stadt)
            if (c == "p" && nx == "h") { Push("f", i); i += 2; continue; } // ph → f
            if (c == "q" && nx == "u") { Push("k", i); Push("v", i); i += 2; continue; } // qu → kv
            if (c == "n" && nx == "g") { Push("ŋ", i); i += 2; continue; } // ng → ŋ
            if (c == "n" && nx == "k") { Push("ŋ", i); Push("k", i); i += 2; continue; } // nk → ŋk
            if (c == "p" && nx == "f") { Push("p", i); Push("f", i); i += 2; continue; } // pf → pf
            if (c == "i" && nx == "g" && nx2 == "") { Push("ɪ", i, true); Push("ç", i); i += 2; continue; } // final -ig → ɪç

            if (IsV(c))
            {
                lastVowelLetter = c;
                var seenVowel = segs.Any(s => s.Vowel);
                // Short ⟨ä⟩: emit the marker Ɛ (not plain ɛ) so a downstream lexicon length flag lengthens it to ɛː,
                // NOT the eː that longOf[ɛ] gives ⟨e⟩ (Standard German long ä is ALWAYS ɛː: ärzte → ɛːɐ̯tstə, not eː).
                // applyLength (german.ts) normalises any surviving Ɛ back to ɛ for genuinely-short ä (hätte → hɛtə).
                if (c == "ä" && !IsLong(w, i)) { Push("Ɛ", i, true); i++; continue; }
                var noVowelAfter = !ANY_VOWEL.IsMatch(w[(i + 1)..]);
                // -er coda in a non-first syllable → ɐ (Vater, über, Wasser); Erde (first syllable) keeps eː + ɐ̯.
                if (c == "e" && nx == "r" && !IsV(nx2) && seenVowel) { Push("ɐ", i, true); i += 2; continue; }
                // ie → iː (native: die, Liebe, sieben) — EXCEPT the unstressed Latinate suffix -ie/-ien after another
                // syllable (Familie → famiːli̯ə, Ferien → feːʁi̯ən): word-final ⟨ie⟩/⟨ien⟩ preceded by a vowel becomes a
                // non-syllabic glide i̯ + schwa. Monosyllables (die, sie, Knie) have no preceding vowel → stay iː; the
                // final-stressed loans (Melodie → melodiː) are restored to iː by a stressed-i̯ə post-pass in german.ts.
                if (c == "i" && nx == "e")
                {
                    var ieEnd = i + 2 == n; // …ie#
                    var ienEnd = nx2 == "n" && i + 3 == n; // …ien#
                    if ((ieEnd || ienEnd) && segs.Any(s => s.Vowel))
                    {
                        Push("i̯", i);
                        Push("ə", i, true);
                        if (ienEnd) Push("n", i);
                        i += ienEnd ? 3 : 2;
                        continue;
                    }
                    Push("iː", i, true);
                    i += 2;
                    continue;
                }
                // Unstressed ⟨i⟩ in a MEDIAL hiatus — the Latinate -iVC- suffix pattern (Union → uni̯oːn, genial →
                // ɡeni̯aːl, Aluminium → …ni̯ʊm, Material → …ʁi̯aːl) → non-syllabic glide i̯, not a full syllable iː.
                // Gated to -iV followed by MORE material (i + 2 < n): a WORD-FINAL -iV# stays two syllables (Radio, and
                // crucially the many proper-noun -ia/-io: Liberia → …ʁi.a, Ontario, Ohio — kaikki keeps those syllabic).
                // Excludes ⟨ie⟩ (handled above → iː) and word-initial ⟨i⟩ (Ion, Iota — seenVowel guards). The following
                // vowel carries the syllable's stress, so the glide i̯ is never itself stressed.
                if (c == "i" && FULL_VOWEL.Contains(nx, StringComparison.Ordinal) && seenVowel && i + 2 < n)
                {
                    Push("i̯", i);
                    i++;
                    continue;
                }
                // doubled vowel aa/ee/oo → one long vowel (Saat, See, Boot).
                if (nx == c && "aeo".Contains(c, StringComparison.Ordinal)) { Push(LONG[c], i, true); i += 2; continue; }
                // weak schwa: an unstressed e in the FINAL syllable — machen (-en), Blume (-e); a root e keeps its quality
                // because a later vowel follows (blenden → blɛndən). Mid-compound -en needs morphology, left for later.
                if (c == "e" && seenVowel && noVowelAfter) { Push("ə", i, true); i++; continue; }
                Push(IsLong(w, i) ? LONG[c] : SHORT[c], i, true); // silent lengthening/hiatus h is dropped in the switch
                i++;
                continue;
            }

            // r: vocalize to ɐ̯ only after a LONG vowel (Uhr → uːɐ̯) or word-finally after a vowel (wir → viːɐ̯); stays ʁ
            // in an onset and in a coda after a SHORT vowel (scherz → ʃɛʁt͡s, Herz → hɛʁt͡s).
            if (c == "r")
            {
                var prev = segs.Count > 0 ? segs[^1] : null;
                if (nx == "r") i++; // rr → single r (Herr, irre)
                var after = At(w, i + 1);
                var coda = after == "" || !IsV(after);
                if (coda && prev is not null && prev.Vowel) Push("ɐ̯", i); // coda r after a vowel → vocalized (Uhr, hart, Hamburg, scherz)
                else Push("ʁ", i); // onset r (rot, drei, Straße)
                i++;
                continue;
            }

            // Context-DEPENDENT letters handled here; the rest are a data lookup (MANIFEST.consonants).
            if (c == "h")
            {
                // Onset h is pronounced; h after a vowel is silent (sehen, Uhr, fröhlich) — EXCEPT the ⟨hör⟩ root after
                // a prefix (ge·hör, be·hörde, zu·be·hör → ɡəhøːɐ̯), where h is a real onset. Gated to ⟨hö⟩ + a preceding
                // prefix, so gehen (h→e, silent) and rohöl (roh, not a prefix) are unaffected.
                // ⚠ ⟨th⟩ AT A WORD EDGE IS A LOAN DIGRAPH, and German has no [th] sequence at all: Thema is
                // [ˈteːma], Theater [teˈaːtɐ], Ruth [ʁuːt]. The rule below pronounces h after any consonant, so
                // every one of these carried a spurious [h].
                //
                // ⚠ THE EDGE RESTRICTION IS THE WHOLE SAFETY ARGUMENT. Medially, ⟨th⟩ is just as often a
                // COMPOUND BOUNDARY where the h is real — Rathaus, Schlachthof, Aufenthalt, Truthahn, and the
                // productive `-heit` suffix on any -t adjective (Vertrautheit, Bejahrtheit). In the kaikki
                // referee, word-initial ⟨th⟩ is 8/8 silent and word-final 3/3 silent, while MEDIAL is only
                // 34/52 — so the edges are a rule and the middle is not. Measured on the corpus: this costs
                // nothing and gains 88 rows (88 closer, 0 further).
                //
                // Extending it medially scores 186 closer / 24 further, net positive and NOT taken.
                //
                // ⚠ AND THE REASON IS NOT A MISSING COMPOUND DETECTOR, which is what this note used to say.
                // One already exists and was already running when that was measured: `phonemizeWord` calls
                // `decompose()` and g2p's each morpheme SEPARATELY, so a word that splits never presents ⟨th⟩
                // as a unit at all — gasthaus is g2p'd as "gast" + "haus", kunsthändler as "kunst" + "händler",
                // achthundert as "acht" + "hundert". Those are already safe and are not among the 24.
                //
                // The 24 are the words `decompose` CANNOT split, and every one is a lexicon-coverage gap rather
                // than an algorithm gap:
                //   · rathaus — `rat` is 3 letters and splitCompound floors a leading constituent at 4. That
                //     floor is load-bearing (measured −143 on Afrikaans at 3), so it is not movable for this.
                //   · truthahn, balsaholz, gänsehaut — `trut`, `balsa`, `gänse` are absent from lexicon.tsv.
                //   · vertrautheit, bejahrtheit — ⟨heit⟩ IS a listed suffix, but it only strips when the
                //     remainder is a known word: schön/frei/gesund/krank split, traut/bejahrt/mehr do not.
                //   · parenthood, south, ninth — English inside German, where [θ] is right and neither tier helps.
                // Widening lexicon.tsv is generated-data work (kaikki ∩ frequency), not a rule change, and the
                // trade without it is bad in kind rather than in count: the 24 DELETE a consonant from ordinary
                // nouns (Rathaus → *ʁaːtaʊ̯s*) while the 186 remove a spurious [h] from loanwords.
                //
                // ⚠ AND ⟨rh⟩ IS NOT THE SAME CASE, though it looks identical. Only 3 of 47 kaikki ⟨rh⟩ words
                // drop the h: Jahrhundert, Mehrheit, verhandlung, fieberhaft are the norm and Rhythmus the
                // exception. ⟨gh⟩ is 0 of 12. Both were checked before assuming, and both stay untouched.
                if (At(w, i - 1) == "t" && (i == 1 || i == w.Length - 1))
                {
                    /* word-edge ⟨th⟩: silent */
                // ⚠ THE PREFIX GATE IS LOAD-BEARING; THE VOWEL RESTRICTION WAS NOT. This exception was written
                // for ⟨hö⟩ alone (ge·hör, be·hörde) but the same boundary carries every full vowel —
                // be·haglich, vor·be·halten, ent·halten were all losing their h. Widening ⟨ö⟩ to the full-vowel
                // set is 39 rows closer and 0 further.
                //
                // ⚠ AND DROPPING THE PREFIX TEST INSTEAD IS NET NEGATIVE, which the referee alone would not
                // have shown. In the kaikki sample, post-vowel ⟨h⟩ before a full vowel is pronounced 24 of 28
                // times (h+o 7/7, h+ä 5/5, h+a 9/11) against h+e 7/40 and h+i 4/15 — so "h before a full vowel
                // is an onset" looks like the rule. On the corpus it scores 80 closer / 138 FURTHER, because
                // real German is full of compounds where the h ENDS the first morpheme and the next one begins
                // with the vowel: Dreh·arbeit, Roh·öl, Ein·weihung, Erzieh·ung. The prefix is what identifies a
                // boundary with h on the RIGHT of it.
                //
                // Compound boundaries are therefore still wrong — Gänse·haut, Balsa·holz, Johannes keep losing
                // their h — and need the same compound detector the medial ⟨th⟩ note above wants.
                }
                else if (!IsV(At(w, i - 1))
                         || (FULL_VOWEL.Contains(nx, StringComparison.Ordinal) && H_PREFIX.IsMatch(w[..i])))
                    Push("h", i);
            } // onset h pronounced; silent after a vowel (sehen, Uhr)
            else if (c == "s")
            {
                Push(IsV(nx) ? "z" : "s", i);
            } // s → z before a vowel (sehen, lesen); else s
            else if (c == "x")
            {
                Push("k", i);
                Push("s", i);
            } // x → ks
            else
            {
                if (CONS.TryGetValue(c, out var cp)) Push(cp, i);
            } // context-free consonant letter
            i++;
        }

        // Collapse doubled consonants FIRST, before devoicing — German writes them only to mark a short vowel (Wasser,
        // Krabbe, Roggen → single). If finalDevoice ran first it would see the geminate as a coda cluster and wrongly
        // devoice its first half (Krabbe → kʁapbə instead of kʁabə; the second b "will itself devoice", triggering it).
        var @out = new List<Seg>();
        foreach (var s in segs)
        {
            var prev = @out.Count > 0 ? @out[^1] : null;
            if (prev is not null && !prev.Vowel && !s.Vowel && prev.Ph == s.Ph && s.Ph.Length == 1) continue;
            @out.Add(s);
        }
        FinalDevoice(@out, w);
        return @out;
    }

    /** Auslautverhärtung: a voiced obstruent that is word-final or before a voiceless consonant devoices. */
    private static void FinalDevoice(List<Seg> segs, string w)
    {
        for (var k = 0; k < segs.Count; k++)
        {
            var s = segs[k];
            if (!VOICED_FINAL.TryGetValue(s.Ph, out var dev) || string.IsNullOrEmpty(dev)) continue;
            var next = k + 1 < segs.Count ? segs[k + 1] : null;
            // Devoice a coda voiced obstruent word-finally, before a voiceless obstruent (-bt, -gt), OR before another
            // voiced obstruent that will itself devoice (the whole coda cluster devoices: smaragd → smarakt, bagdad
            // → bakdat). Before a sonorant/vowel it's an onset and stays voiced (Adler, wagen).
            if (next is null
                || (!next.Vowel
                    && ("ptksfçxʃ".Contains(next.Ph.Length > 0 ? next.Ph[0].ToString() : "", StringComparison.Ordinal)
                        || VOICED_FINAL.ContainsKey(next.Ph))))
                s.Ph = dev;
        }
        _ = w;
    }
}
