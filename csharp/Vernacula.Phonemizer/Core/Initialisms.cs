/**
 * Shared INITIALISM handling — decide what to do with an all-caps letter run before the tokenizer.
 *
 * THE ARCHITECTURE, which is the whole point of this file being this small: a known acronym's reading is a
 * LEXICAL fact, and an unpronounceable one is an OOV case. Those are the only two things here.
 *
 *   · LEXICAL. Whether `NASA` is a word and `NHS` is letters is not derivable from spelling — it is
 *     recorded knowledge, so it belongs in the language's DATA, not in logic. The pronunciation dictionary
 *     already carries most of it (CMUdict has bbc/gdp/fbi/cia/uk/dna/gps/mri with LETTER readings and
 *     scuba/radar/nasa/nato as WORDS), and this pass simply leaves such tokens alone for the normal
 *     lexicon lookup to resolve — the engines lowercase before lookup anyway. What the dictionary cannot
 *     express is the case-keyed pair: `US` the country versus `us` the pronoun. Those are listed per
 *     language in its manifest as `acronymLetters`, alongside the language's other hand-authored facts.
 *
 *   · OOV. When the acronym is recorded nowhere, the one thing that CAN be derived from spelling is
 *     whether the letters could be read as a word at all. If they cannot, spelling out is the only
 *     sensible reading; if they can, the existing OOV g2p already produces that word, so this pass gets
 *     out of the way. This is the failure it exists for, and it was severe: English `NHS` → [ns] with the
 *     H gone, `MP` → [mp], `NYC` → [niːk], `WTO` → [uːt], `DSLR` → [ʌdslɚ]; French `SNCF` → [snkf] and
 *     `TGV`/`PDG` DROPPED from the output entirely. Every one of those has no vowel or an illegal cluster.
 *
 * ⚠ THERE IS DELIBERATELY NO LENGTH-BASED "LEXICALIZATION THRESHOLD" (4+ letters and pronounceable ⇒ read
 * as a word). That is logic trying to re-derive a lexical fact, and it duplicates what the OOV g2p already
 * does: measured against the wikipron referee, the g2p is ALREADY right on the pronounceable acronyms it
 * records as words (BAMF, SNES, CUPE, TESDA, CAGR, USAR, VUSA).
 * The cost is honest and small: an acronym that IS spelled out in speech but is pronounceable and unrecorded
 * (ROV, NYC, SUV) needs a data entry, where a threshold would guess — and guess wrong about as often (it
 * reads USAF as a word), for a two-word difference on the referee.
 */

namespace Vernacula.Phonemizer.Core;

public sealed class InitialismData
{
    /** Letter → the orthographic form to emit for its NAME. English can emit most letters unchanged,
     *  because CMUdict carries all 26 single letters with their letter-name pronunciations. */
    public required Func<string, string?> LetterName { get; init; }
    /**
     * LOWERCASE, IF THE LANGUAGE'S IS NOT JAVASCRIPT'S. Defaults to `String.prototype.toLowerCase`, which is
     * LOCALE-BLIND, and for the Turkic dotted-I pair it is not merely imprecise but destructive in two
     * different directions. Measured on this pass before the hook existed:
     *
     *     tr  "IMF raporu"  → "i me fe raporu"   ⚠ `I` is the DOTLESS capital; its name is *ı*, not *i*
     *     tr  "İETT"        → /iˈetː/            ⚠ read as a WORD, never spelled out at all
     *
     * The second is the one that hides. `"İ".toLowerCase()` is not `"i"` — it is `i` + U+0307 COMBINING DOT
     * ABOVE, two code points — so `spellOut` asks for the name of a combining mark, gets `undefined`, and
     * correctly declines to emit a partial reading. The token then falls through to the phonotactic test,
     * which sees a vowel and says "pronounceable", and the initialism is read as a word. A defect that
     * expresses itself as the pass silently doing nothing is exactly the shape a gate cannot see.
     *
     * ⚠ IT MUST BE THE SAME FUNCTION THE G2P USES, not a second copy, because every consumer here is a
     * lookup key: `letterName`, `acronymLetters`, `isRecorded` and `isUnreadable` are all keyed on the
     * language's own lowercase, and two spellings of it means the tables answer for one and not the other.
     * `turkish/g2p.ts`'s `trLower` and `azerbaijani/g2p.ts`'s `azLower` are those functions.
     */
    public Func<string, string>? Lower { get; init; }
    /**
     * LEXICAL: acronyms read letter-by-letter although their lowercase form is an ordinary word, so the
     * dictionary cannot express the distinction — `US`/`UN`/`IT`/`LED`/`WHO` in English, `USA`/`ONG`/`PIB`
     * in French. Authored in the language's manifest, not here.
     */
    public required IReadOnlySet<string> AcronymLetters { get; init; }
    /**
     * Is this lowercase form RECORDED in the pronunciation dictionary? The OOV rule below applies only to
     * tokens that are genuinely out of vocabulary — `CD` has no vowel and so looks unreadable, but CMUdict
     * carries it as [siːdˈiː], one token with one stress, which is both correct and better prosody than
     * spelling it out. A recorded pronunciation is not the OOV tier's business.
     */
    public required Func<string, bool> IsRecorded { get; init; }
    /** OOV strategy: can this letter sequence be read as a word at all? */
    public required Func<string, bool> IsUnreadable { get; init; }
}

public sealed class PhonotacticsData
{
    /** Vowel LETTERS of the orthography (not phonemes) — the coarse syllabifiability test. */
    public required JsRe Vowels { get; init; }
    /** Two-consonant clusters the language can begin a word with. */
    public required IReadOnlySet<string> LegalOnsets { get; init; }
    /** Two-consonant clusters the language can end a word with. */
    public required IReadOnlySet<string> LegalCodas { get; init; }
    /**
     * The letters that count as LIQUIDS for signal 2 — the sounds that break up a consonant run and keep it
     * syllabifiable. Defaults to `LIQUIDS`, which covers the Latin and Cyrillic letters used by every
     * language that wires this test today. A language in another script MUST declare its own, or signal 2
     * will fire on every 3-consonant run it meets.
     */
    public JsRe? Liquids { get; init; }
    /**
     * DIGRAPHS: two letters spelling ONE consonant phoneme. Declaring them fixes a systematic over-firing,
     * because every test below counts LETTERS while the phonotactics it is modelling is about PHONEMES.
     *
     * Measured over the 28 OmniVoice FLEURS corpora, this one omission was the single largest source of
     * false "unreadable" verdicts on ordinary native vocabulary:
     *
     *     de  nicht, nacht   `cht` looked like a 3-consonant run; ⟨ch⟩ is /x/, so it is C+C
     *     ga  bhfuil         `bhf` likewise; ⟨bh⟩ is one lenited phoneme
     *     ca  anys           `nys` likewise; ⟨ny⟩ is /ɲ/
     *     cs  jejich         coda `ch` is /x/ — one phoneme, so not a cluster needing a licence
     *     ca  lloc           onset `ll` is /ʎ/
     *     cy  nhw            onset `nh` is the nasal mutation of /n/
     *
     * A declared digraph does three things: it collapses to a single consonant before the run test, and it
     * counts as automatically legal in onset and coda position — because a single phoneme needs no cluster
     * licence. So `legalOnsets`/`legalCodas` stay lists of genuine two-PHONEME clusters, which is what they
     * were always meant to be.
     */
    public IReadOnlySet<string>? Digraphs { get; init; }
}

public static class Initialisms
{
    /**
     * Combining marks that genuinely attach to LATIN — the diacritic blocks and their supplements.
     *
     * ⚠ `\p{M}` IS TOO BROAD FOR A BOUNDARY ON A LATIN RUN. Hebrew `UTCּ+1` carries a HEBREW POINT DAGESH
     * (U+05BC) stuck to the end of a Latin `UTC` — a stray from the source text, not a diacritic on the ⟨C⟩ —
     * and a blanket `\p{M}` lookaround refuses the whole run, so it falls through to the OOV g2p and reads
     * as the word *ˈaᶷt͡ʃ*. A Hebrew point, an Arabic harakat or a Devanagari matra after Latin letters is
     * ADJACENT, not attached. A decomposed `MRI`+U+0301 is still refused, which is the case the boundary
     * exists for.
     */
    public const string LATIN_MARK = "\\u0300-\\u036F\\u1AB0-\\u1AFF\\u1DC0-\\u1DFF\\uFE20-\\uFE2F";

    /**
     * PERSONAL INITIALS — `J. S. Bach`, `George W. Bush`. A single capital plus a period, which the all-caps run
     * below cannot claim because it requires two letters, so the bare letter reaches the g2p as an unpronounceable
     * consonant plus a spurious phrase break (es `w .`, pt `v .`, ru `u .`, de `f .`).
     *
     * ⚠ THE DISAMBIGUATION IS CONTIGUITY, and that is what makes this safe. A run of two or more is unambiguous —
     * no abbreviation appears twice in a row — so it is claimed outright. A LONE initial is genuinely ambiguous
     * with a real abbreviation (German `S.` is *Seite*, and `S. 42` must stay that), so it is claimed only when it
     * sits BETWEEN two capitalised words. That excludes the dangerous case, a sentence ending in a single capital
     * before a new one ("…ist A. Der Rest…"), because there the preceding word is lowercase.
     *
     * The periods are consumed, since they are abbreviation dots rather than sentence ends.
     *
     * ⚠ KNOWN FALSE POSITIVE: a sentence that ENDS in a lone capital followed by a new capitalised sentence has
     * the same shape, so "Vitamin C. It helps" loses its sentence boundary. The fix would be a list of
     * sentence-opening function words, which is language-specific lexical knowledge and does not belong in shared
     * code — a language that finds this costly can pre-empt it in its own normalize.ts.
     */
    /** An all-caps run, or a caps run glued to digits (`A380`), bounded by letters and Latin diacritics only. */
    private static readonly JsRe RUN_OR_CODE = JsRegex.Compile(
        "(?<![\\p{L}" + LATIN_MARK + "])\\p{Lu}{2,}(?![\\p{L}" + LATIN_MARK + "])"
        + "|(?<![\\p{L}" + LATIN_MARK + "])\\p{Lu}+(?=\\d)", "gu");
    private static readonly JsRe INITIAL_RUN =
        JsRegex.Compile("(?<![\\p{L}" + LATIN_MARK + "])(?:\\p{Lu}\\.[  ]*){2,}", "gu");
    private static readonly JsRe LONE_INITIAL =
        JsRegex.Compile("(?<=\\p{Lu}\\p{L}*[  ])(\\p{Lu})\\.(?=[  ]+\\p{Lu}\\p{Ll})", "gu");

    private static readonly JsRe UPPER = JsRegex.Compile("\\p{Lu}", "gu");
    private static readonly JsRe LOWER_TEST = JsRegex.Compile("\\p{Ll}", "u");
    private static readonly JsRe SPACE_TEST = JsRegex.Compile("\\s", "u");
    /** JS `String.prototype.trim` trims the ECMAScript WhiteSpace+LineTerminator set (U+FEFF included,
     *  U+0085 excluded) — not .NET's `Trim()` set. Routed through the translator so the two agree. */
    private static readonly JsRe JS_TRIM = JsRegex.Compile("^\\s+|\\s+$", "gu");

    /**
     * Build the text→text initialism pass.
     *
     * ⚠ ORDERING CONSTRAINT FOR THE CALLER, and it bites: Roman numerals are all-caps letter runs too, so this
     * pass MUST run AFTER the language's Roman-numeral rules, or it spells `Louis XIV` as EX-EYE-VEE. Likewise it
     * must run after abbreviation expansion, or French `MM.` becomes EM-EM.
     */
    public static Func<string, string> MakeInitialismNormalizer(InitialismData d)
    {
        // See `InitialismData.lower`. Every `.toLowerCase()` in this file used to be written out inline; they
        // are all the same decision and are all routed through here so a language cannot fix one and miss another.
        var lower = d.Lower ?? (s => s.ToLowerInvariant());
        string SpellInitials(string run) =>
            string.Join(" ", UPPER.Matches(run).Select(m => d.LetterName(lower(m.Value)) ?? m.Value));

        string Inner(string text)
        {
            // Gated on the text containing lowercase: in an all-caps DOCUMENT the capitals carry no signal
            // and spelling out every word would be absurd. A lone all-caps token is exempt — there is no
            // shouting document to misread, and it is the "user typed an acronym" case.
            if (!LOWER_TEST.IsMatch(text) && SPACE_TEST.IsMatch(JS_TRIM.Replace(text, ""))) return text;
            // Two shapes. A free-standing all-caps run of 2+ letters is the ordinary initialism. A run
            // ATTACHED TO DIGITS is an alphanumeric code (CG4684, A380, B747, X5) and needs claiming
            // separately, because there is no word boundary between the letters and the digits for `\b` to
            // find — so those letters reached the g2p raw and came out as an unpronounceable cluster ([kɡ])
            // or, in French, with a letter silently DROPPED. A single letter counts in the attached case only:
            // `A380` must be the letter name, and English read the bare `A` as the reduced article [ə].
            // Boundaries are explicit lookarounds, NOT `\b`: `\b` is defined on ASCII word characters, so it
            // finds no boundary against Cyrillic (or Greek, Armenian, Georgian …) and the whole pass silently
            // did nothing for them — США came out as the cluster [sʂa]. Russian was the first non-Latin script
            // to reach this pass and exposed it.
            // ⚠ Bounded by `LATIN_MARK`, not `\p{M}` — see that declaration for why a Hebrew point following
            // a Latin run is adjacent rather than attached.
            return RUN_OR_CODE.Replace(text, m =>
            {
                var tok = m.Value;
                var low = lower(tok);
                var spelled = SpellOut(low, d.LetterName);
                if (tok.Length < 2) return spelled ?? tok; // attached code: a letter, never a word
                if (d.AcronymLetters.Contains(low)) return spelled ?? tok; // lexical: a listed exception
                if (d.IsRecorded(low)) return tok; // lexical: the dictionary owns it
                if (d.IsUnreadable(low)) return spelled ?? tok; // OOV: nothing else could be said
                return tok; // OOV but pronounceable — the OOV g2p reads it as a word
            });
        }

        return rawText =>
        {
            // Initials are resolved BEFORE the all-caps rule, so `J. S.` is never seen as two separate
            // one-letter tokens, and after the caller's abbreviation pass for the usual reason.
            var text = LONE_INITIAL.Replace(
                INITIAL_RUN.Replace(rawText, m => SpellInitials(m.Value) + " "),
                m =>
                {
                    var letter = m.Groups[1].Value;
                    return d.LetterName(lower(letter)) ?? letter;
                });
            return Inner(text);
        };
    }

    /** Letter-by-letter reading, or undefined if any character has no letter name — so the caller leaves the
     *  token alone rather than emitting a partial reading with characters silently missing. */
    private static string? SpellOut(string lower, Func<string, string?> letterName)
    {
        var names = Js.CodePoints(lower).Select(letterName).ToList();
        return names.All(n => n is not null) ? string.Join(" ", names) : null;
    }

    /**
     * ⚠ THE DEFAULT LIQUID SET IS SCRIPT-AWARE BECAUSE THE ASCII ONE WAS SILENTLY OFF FOR A WHOLE SCRIPT.
     * This was `/[lr]/u`, so Cyrillic ⟨л⟩ and ⟨р⟩ never matched and signal 2 — "a 3+ consonant run with no
     * liquid" — could not be satisfied by any Cyrillic word. That is playbook trap 1's family: a guard written
     * for one writing system is blind in another, and the direction of the error is always MORE spelling-out.
     *
     * Measured before changing it, over the all-caps tokens of the six Cyrillic corpora that wire this test
     * (ky mk mn ru tg uk) — those are the only strings the initialism pass ever inspects:
     *
     *     ky  109 caps tokens   2 verdicts flip   ТҮРКСОЙ · ОСФСР
     *     mn  122              1                 ХӨГЖЛИЙН
     *     tg  135              4                 АЖРВТ · РХФЮ · РСФЮ · ҶФШСР
     *     mk / ru / uk  20 each  0
     *
     * Seven strings, and they split two ways, which is the whole reason signals 3 and 4 exist behind this one:
     * `ХӨГЖЛИЙН` is an ORDINARY WORD inside a shouted title and `ТҮРКСОЙ` is an organisation said as a word —
     * both were being spelled letter by letter and now are not. The remaining five ARE Soviet-era initialisms
     * and must still be spelled out; they are, because their illegal onset or coda catches them one signal
     * later. Verified string by string rather than assumed.
     */
    public static readonly JsRe LIQUIDS = JsRegex.Compile("[lrлр]", "u");

    private static readonly JsRe LETTER_TEST = JsRegex.Compile("\\p{L}", "u");
    /** Strips the outer brackets off a declared vowel class so its body can compose into a negated one. */
    private static readonly JsRe CLASS_BRACKETS = JsRegex.Compile("^\\[|\\]$", "g");

    /**
     * Build a "can this letter string be read as a word at all" test for one language.
     *
     * Deliberately conservative — it reports unreadable only on high-confidence violations, so a plausible
     * string stays readable. Signals, in order of confidence:
     *   1. NO VOWEL LETTER at all: nothing can be syllabified (SNCF, TGV, PDG, NHS, MP, GDP, DVD).
     *   2. A consonant run of 3+ with no liquid to break it up.
     *   3. An illegal word-INITIAL cluster (French TVA has no /tv/ onset; English WTO no /wt/).
     *   4. An illegal word-FINAL cluster (French RATP /tp/, EDF /df/; English UTC /tc/).
     *
     * ⚠ DIGRAPH ORTHOGRAPHIES MUST FOLD FIRST. This test counts raw LETTERS, so a language whose orthography
     * writes one sound with two letters looks like it has an illegal consonant run: Hungarian `ENSZ` is e-n-sz,
     * three sounds, but reads here as a 3-consonant cluster and would be spelled out where it is actually said as
     * the word *ensz*. Wrap the call in a fold from digraphs to single placeholder letters before passing the
     * token in, as the Hungarian engine does.
     *
     * ⚠ KNOWN LIMIT: READABILITY IS NOT CONVENTION. `ONG`, `PIB`, `RER`, `US`, `UK` are all readable yet spelled
     * out in speech, which is exactly why `acronymLetters` exists — no phonotactic test can derive a lexical
     * convention.
     */
    public static Func<string, bool> MakeUnreadableTest(PhonotacticsData d)
    {
        var consonantRun = JsRegex.Compile("[^" + CLASS_BRACKETS.Replace(d.Vowels.Source, "") + "]{3,}", "u");
        bool IsConsonant(string ch) => LETTER_TEST.IsMatch(ch) && !d.Vowels.IsMatch(ch);
        var digraphs = d.Digraphs;
        /**
         * Rewrite each declared digraph to a single placeholder consonant, so the run test counts PHONEMES.
         * The placeholder is ⟨ẋ⟩ — a consonant in no language's vowel set and in no liquid set, so it neither
         * satisfies the vowel test nor accidentally licenses a run. Longest-first, so a language declaring both
         * `ng` and `ngh` collapses the longer one.
         */
        string Collapse(string w)
        {
            if (digraphs is null || digraphs.Count == 0) return w;
            var outp = new System.Text.StringBuilder(w.Length);
            for (var i = 0; i < w.Length; )
            {
                var hit = false;
                for (var n = 3; n >= 2; n--)
                {
                    if (i + n > w.Length) continue; // JS slice clamps; a short tail is simply not a digraph
                    if (digraphs.Contains(w.Substring(i, n)))
                    {
                        outp.Append('ẋ');
                        i += n;
                        hit = true;
                        break;
                    }
                }
                if (hit) continue;
                outp.Append(w[i]);
                i += 1;
            }
            return outp.ToString();
        }
        var liquids = d.Liquids ?? LIQUIDS;
        return word =>
        {
            var w = word.ToLowerInvariant();
            if (!d.Vowels.IsMatch(w)) return true;
            // ⚠ The run test sees the COLLAPSED form. Counting letters here is what made `nicht` (de) and
            // `bhfuil` (ga) look unsyllabifiable — see `digraphs`.
            var run = consonantRun.Match(Collapse(w));
            if (run.Success && !liquids.IsMatch(run.Value)) return true;
            // A digraph in onset or coda position is ONE phoneme, so it needs no cluster licence.
            var head = w.Length < 2 ? w : w[..2];
            if (
                w.Length >= 2 && IsConsonant(w[0].ToString()) && IsConsonant(w[1].ToString()) &&
                !d.LegalOnsets.Contains(head) && digraphs?.Contains(head) != true
            )
                return true;
            var tail = w.Length < 2 ? w : w[^2..];
            if (
                tail.Length == 2 && IsConsonant(tail[0].ToString()) && IsConsonant(tail[1].ToString()) &&
                !d.LegalCodas.Contains(tail) && digraphs?.Contains(tail) != true
            )
                return true;
            return false;
        };
    }
}
