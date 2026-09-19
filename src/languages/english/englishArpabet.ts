/**
 * English-native canonical converter: CMUdict ARPABET → canonical IPA (the en divestment convention).
 * Cleanroom GenAm allophony (flapping, aspiration, dark-l, offglides, weak-vowel ᵻ, reduction), before-
 * nucleus stress. This is the single source of truth for the en canonical convention: the compile-time
 * pronunciation-lexicon build (build-en-cmudict.ts) and the runtime OOV G2P (englishG2p.ts) both use it,
 * so dict words and G2P'd words share one convention with no seam.
 */

/** The ARPABET→IPA correspondence DATA (from english.jsonc's `arpabet` block). The allophony ALGORITHM
 *  below reads these values; a different English variety supplies its own `map` / `conditionalVowels`. */
export interface ArpabetDef {
    /** ARPABET phone → IPA: consonants + simple (unconditional) vowels. */
    map: Record<string, string>;
    /** The ARPABET vowel bases (a fixed property of the notation) — used to locate nuclei. */
    vowels: string[];
    /** Vowels resolved by stress (AH, ER) or a following R (IY, UW). */
    conditionalVowels: {
        AH: { unstressed: string; stressed: string };
        ER: { unstressed: string; stressed: string };
        IY: { beforeR: string; unstressed: string; stressed: string };
        UW: { beforeR: string; default: string };
    };
}

/** One CMUdict phone (e.g. "AH0", "T", "ER1") → {base, stress}. */
function split(phone: string): { base: string; stress: number } {
    const m = /^([A-Z]+)([0-2])?$/.exec(phone);
    return { base: m?.[1] ?? phone, stress: m?.[2] ? Number(m[2]) : -1 };
}

/** The sibilants, before which the `-es` suffix takes an epenthetic vowel at all. */
const SIBILANT: ReadonlySet<string> = new Set(["S", "Z", "SH", "ZH", "CH", "JH"]);

/**
 * Is the `R` after this `IY` the ONSET of a following element rather than a coda on the same syllable?
 *
 * ⚠ THE `beforeR` LAXING IS RIGHT FOR A CODA AND WRONG ACROSS A MORPHEME BOUNDARY. `career` is kɚˈɪɹ, but
 * `copyright` is copy + right and its IY belongs to `copy` — laxing it gave kʰˈɑːpɪɹˌaᶦt, "copperite". The
 * rule fired on the R alone, which cannot tell the two apart.
 *
 * ⚠ AND PREVOCALIC-R IS NOT THE DISCRIMINATOR, which is why this is a morphological test and not a
 * phonological one. Measured against misaki gold over every dict row with IY immediately before R: gold
 * writes `ɪɹ` on 28 of 28 codas AND on 20 of 34 ONSETS — `careerism`, `experience`, `serious` are all lax
 * across an onset r. The 14 it writes `iɹ` on are ALL a productive prefix or compound-initial element
 * ending in /iː/ before an ⟨r⟩- or ⟨wr⟩-initial base: copy|right, copy|writer, deoxy|ribonucleic,
 * de|regulation, pre|record, pre|requisite, re|route, re|running, re|written, re|wrote.
 *
 * ⚠ THE ⟨wr⟩ HALF IS LOAD-BEARING: `rewriting` has no ⟨r⟩ after the prefix at all, because ⟨wr⟩ spells /r/.
 * Testing only for ⟨r⟩ misses `rewrite`, `rewrote`, `rewritten`, `copywriter`.
 *
 * ⚠ THE TEST IS ON THE WHOLE WORD, SO IT EXEMPTS EVERY `IY`-BEFORE-`R` IN A MATCHING WORD, not only the
 * one at the morpheme boundary. That is safe today and measured: of the 37 dict rows the guard fires on,
 * NONE has a second IY-before-R site. A word that had one would need this tightened to locate the boundary
 * rather than test the spelling once.
 *
 * Scored over the 62 gold-covered rows: 14 correct, 0 missed, 0 false positives, 48 correctly silent. It
 * then generalises to 22 more dict rows gold does not cover (`rerouted`, `rewrite`, `deregulated`,
 * `copyrights`, `prerequisites`), which is why this is a rule and not the 14-word list it was nearly
 * written as.
 */
const IY_PREFIX_BEFORE_R = /^(?:copy|deoxy|re|pre|de)(?:r|wr)/u;

/** Should this unstressed vowel-phone at index `vi` (nucleus number `ni`) surface as the weak vowel ᵻ?
 *  Cleanroom weak-vowel-merger rule from the WORD's morphology (public GenAm phonology). */
function isBarredI(
    word: string,
    P: { base: string; stress: number }[],
    vi: number,
    ni: number,
    nucleiCount: number,
): boolean {
    const { base, stress } = P[vi]!;
    // ⚠ KNOWN LIMIT: `stress > 0` also refuses a SECONDARY-stressed suffix vowel, which CMUdict writes for
    // two rows (`axes AE1 K S IH2 Z`, `pisses P IH1 S IH2 Z`) — they keep `ɪ` where the family has `ᵻ`.
    // Loosening the guard here would loosen it for the four rules below too, which is not worth two rows.
    if (stress > 0 || (base !== "IH" && base !== "AH")) return false;
    // -ed / -ted / -ded after an alveolar stop (started, wanted, united, decided → ᵻd)
    if (
        /(ed|es)$/.test(word) &&
        ni === nucleiCount - 1 &&
        vi + 1 < P.length &&
        vi > 0 &&
        (P[vi - 1]!.base === "T" || P[vi - 1]!.base === "D")
    )
        return true;
    // -es plural / 3sg after a SIBILANT (services, offices, chances, bridges → ᵻz).
    // ⚠ THE POSSESSIVE SPELLING OF THIS MORPHEME IS NOT HANDLED HERE, and an `'s` arm in this test would be
    // DEAD CODE: `english.ts` strips the clitic and looks up the STEM, so the word that reaches this rule
    // never carries the apostrophe. That half lives in `sibilantAllomorph`, which is where it is fixed. The epenthetic vowel of
    // this suffix is the weak vowel, not schwa, and the referees say so in the one comparison that is a test
    // rather than a count: bucketed by WHICH SYMBOL WE WROTE in a slot, the en-US referee writes `ɪ` in
    // 70.4% of our ᵻ slots and 7.1% of our word-final ə slots — it discriminates — and in this environment
    // it writes `ɪ` 100% (5/5 en-US, and 94.0% of 133 en-GB rows).
    // ⚠ THE GREEK /iːz/ PLURALS NEED NO EXCLUSION, though they look like they should: `crises`, `analyses`,
    // `hypotheses` are written with IY in CMUdict, and the stress/base test above already refuses anything
    // that is not IH or AH. The source data separates the two morphemes before this rule ever sees them.
    if (
        /es$/.test(word) &&
        ni === nucleiCount - 1 &&
        vi > 0 &&
        vi + 1 < P.length &&
        P[vi + 1]!.base === "Z" &&
        SIBILANT.has(P[vi - 1]!.base)
    )
        return true;
    // -est superlative (weakest, finest, largest → ᵻst). The SAME weak vowel as the -es/-ed arms above,
    // and both references agree it is: misaki's gold writes `ᵻ` on 101 of the 111 it covers (91%) and the
    // en-GB referee — which has no `ᵻ` and so says "not a schwa" by writing `ɪ` — writes `ɪ` on 26 of 41
    // (63%) against `ə` on 13. 207 dictionary words.
    // ⚠ NOT AN `ɪ` VIA `rebaseSuffixIh`, WHICH IS THE OTHER HALF OF THIS FAMILY. That function exists for
    // the endings where gold writes a FULL `ɪ` (`-ist`, `-is`, `-age`); `-est` is one where gold reaches
    // for `ᵻ` instead, exactly as it does for `-es`/`-ed`, so this belongs here. The two are told apart by
    // asking gold which symbol it used, not by which looks similar.
    // ⚠ SIX LEXICAL `-est` WORDS ARE NOT SUPERLATIVES, and they are ordinary enough to matter: `forest`,
    // `harvest`, `honest`, `modest`, `tempest`, `interest` — plus `deforest`, `rainforest`, `dishonest`
    // and the rest, which the word-final match covers for free. gold writes a plain schwa on exactly
    // these ten of the 111 `-est` words it carries, and on no others.
    // ⚠ A STEM TEST DOES NOT SEPARATE THEM and was tried first: stripping `est` and looking the remainder
    // up — as-is, +e, undoubled, i→y, which are the four shapes a real superlative takes — finds a
    // dictionary word for EIGHT of the ten (`for`, `hone`, `mode`, `tempe`, `intere`…). The morphology is
    // not recoverable from the spelling, so the list is explicit.
    // ⚠ AND THE STRESS GUARD DOES THE REST OF THE WORK, which is why the list is only six long: every
    // other `-est` noun and verb carries a STRESSED final syllable in CMUdict and never reaches here —
    // `manifest` EH2, `protest` EH2, `request` EH1, `conquest` EH0, `midwest` EH1, `budapest` EH2. Only
    // the six with an unstressed AH0 needed naming. Residue: `arbalest` and `doest`, both rare.
    if (
        /est$/.test(word) &&
        !/(forest|harvest|honest|modest|tempest|interest)$/.test(word) &&
        ni === nucleiCount - 1 &&
        vi + 2 === P.length - 1 &&
        P[vi + 1]?.base === "S" &&
        P[vi + 2]?.base === "T"
    )
        return true;
    // -ity/-ety/-ities/-ility (university, quality, security → ᵻti); the vowel before the final -t- cluster
    if (
        /(it|iti|ities|ety|ities)y?$/.test(word) &&
        P[vi + 1] &&
        P[vi + 1]!.base === "T"
    )
        return true;
    // -ible (possible → ᵻbəl)
    if (/ibl[ey]?$/.test(word) && vi + 1 < P.length && P[vi + 1]!.base === "B")
        return true;
    // Latinate reduced prefix be/de/re/se/pre + consonant (believe, decide, review, security → ᵻ)
    if (ni === 0 && /^(be|de|re|se|pre)[^aeiouy]/.test(word)) return true;
    return false;
}

/**
 * CMUdict WRITES `AH0` WHERE THE VOWEL IS `/ɪ/`, in three suffixes. Re-base those to `IH0`.
 *
 * ⚠ `-ism` IS NOT HERE, though it looks like it belongs: its vowel is `IH2 Z AH0 M`, so the S is voiced
 * to Z and the schwa before the M is a real schwa. Including it in the spelling test only ever produced
 * false fires (`Protestantism` re-based `-testant-`).
 *
 * `activist` is `AE1 K T AH0 V AH0 S T` — both unstressed slots are `AH0`, and the second one is not a
 * schwa: it is the `-ist` vowel. Rendering it through `cv.AH.unstressed` gives *ˈæktəvəst, and the
 * dictionary contradicts itself about it — `abolitionist` came out `…ʃənəst` and `abortionist`
 * `…ʃənɪst`, the same suffix spelled two ways.
 *
 * ⚠ RE-BASED TO `IH`, NOT ROUTED THROUGH `isBarredI`, and the difference is the symbol. `isBarredI`
 * yields the weak vowel `ᵻ`, which is right for the INFLECTIONAL `-es`/`-ed` — and misaki's gold agrees
 * there, writing `ᵻ` itself (`Christmases` `kɹˈɪsməsᵻz`, 2,154 entries use it). Gold has that symbol
 * available and deliberately does NOT use it for `-ist`: it writes a full `ɪ`. Building this as an
 * `isBarredI` arm was tried and measured at **−486 exact against gold with 0 gained**, because words
 * that already read `ɪ` were pulled to `ᵻ`. The two families are different, and the reference keeps
 * them apart.
 *
 * Referee evidence per family (en-GB wikipron, which has no `ᵻ` and so writes `ɪ` or `ə`):
 *
 *     -ist           ɪ 131 / 135  (97.0%)     -is    ɪ  44 /  48  (91.7%)
 *     -age           ɪ  85 /  95  (89.5%)
 *
 * ⚠ `-is`, NOT `-sis`. The first version of this rule tested `/sis$/` and missed every other spelling of
 * the same ending — `-itis`, `-tis`, `-nis`, `-ris` — so `mastitis` read *mæstaɪtəs against the referee's
 * mæstaɪtɪs while `analysis` was correct one row away. Measured separately, the part `/sis$/` missed is
 * the STRONGER half: 35 of 36 referee rows `ɪ` (97.2%) with ZERO `ə`, against 9 of 12 (75%) for `-sis`
 * itself. The phone guard does the discriminating, not the spelling — `this` (DH IH1 S) and `his`
 * (… Z) are refused by the stressed-vowel and final-S tests, and `axis`, `tennis`, `Paris` are all
 * correctly caught.
 *
 * ⚠ AND `-ness` / `-less` ARE NOT IN THIS SET, which is the whole reason it stops where it does. Gold
 * writes `ɪ` in both — 375 `-ness` words and 34 `-less` words diverge from us on exactly that, and they
 * are the LARGEST family in the class, so following the reference would have looked like the obvious win:
 *
 *     -ness   referee ɪ  14 / 100  (14.0%)   ə  81 (81.0%)
 *     -less   referee ɪ  10 /  43  (23.3%)   ə  32 (74.4%)
 *
 * The schwa we already write there is right and gold is wrong. The en-GB referee leans TOWARD `ɪ` by
 * construction — the weak-vowel merger is less advanced in RP — which makes an 81% `ə` reading stronger
 * rather than weaker. Adding them on the reference's say-so would have regressed 409 words.
 */
function rebaseSuffixIh(
    P: { base: string; stress: number }[],
    word: string,
): void {
    // ⚠ THE SUFFIX'S OWN VOWEL, LOCATED FROM THE END — not "the last vowel", and not every AH0 that
    // happens to precede an S. Scanning all of them fired on the PREFIX (`assist`, AH0 S IH1 S T,
    // became *ɪsˈɪst; `aphesis` marked both slots). Taking the last VOWEL instead missed the plural:
    // `package` → pʰˈækɪd͡ʒ while `packages` (P AE1 K AH0 JH AH0 Z) stayed *pʰˈækəd͡ʒᵻz, because the
    // -age vowel is no longer final once the inflection is on. That split a singular from its own
    // plural, which is the two-spellings-per-morpheme defect `en_rebuild_lexicon.mts` warns about.
    const n = P.length;
    const at = (i: number): string => P[i]?.base ?? "";
    const unstressedVowel = (i: number): boolean =>
        P[i] !== undefined && P[i]!.stress === 0;
    let vi = -1;
    if (/ists?$/.test(word)) {
        // … AH0 S T  ·  … AH0 S T S (plural)
        if (at(n - 2) === "S" && at(n - 1) === "T") vi = n - 3;
        else if (at(n - 3) === "S" && at(n - 2) === "T" && at(n - 1) === "S") vi = n - 4;
    } else if (/is$/.test(word)) {
        if (at(n - 1) === "S") vi = n - 2;                       // … AH0 S
    } else if (/ages?$/.test(word)) {
        if (at(n - 1) === "JH") vi = n - 2;                      // … AH0 JH
        // … AH0 JH <epenthetic vowel> Z — the plural, where the inflection sits past the -age vowel
        else if (at(n - 3) === "JH" && at(n - 1) === "Z" && unstressedVowel(n - 2)) vi = n - 4;
    }
    const p = P[vi];
    if (p && p.base === "AH" && p.stress === 0) p.base = "IH";
}

/**
 * CMUdict's final `-y` is `IY0` 7,219 times and `IY2` 198 times, in the same slot. Demote the 198.
 *
 * `city` is `S IH1 T IY0` and `ability` is `AH0 B IH1 L AH0 T IY2` — the same unstressed FLEECE vowel,
 * same environment, different digit. It is upstream noise rather than a convention, and the reference
 * agrees with the 97%: of the 123 `-y`-spelled `IY2` rows misaki's gold covers, it leaves **121
 * unstressed**. Fixing it here rather than in `g2p-dict.tsv` because the dict is REGENERATED from
 * upstream by `en_g2p_ngram.ts --emit` (which is what `g2p-curated.tsv` exists to record), and because
 * the n-gram and the BiLSTM predict the same digit from the same training data — a per-row edit would
 * leave the OOV path saying `IY2` for an unlisted word in the identical environment.
 *
 * ⚠ ONLY `IY`, AND ONLY ON A `-y` SPELLING. Both narrowings are load-bearing, measured against gold:
 *   · other final vowels    a blanket rule is WRONG — gold KEEPS the 2° on 94–100% of final
 *                           `EY`/`AY`/`OY`/`AW` (`airway`, `alibi`, `aircrew`, `afterglow`), and on
 *                           50.5% of final stress-2 rows overall. `OW` is genuinely mixed (69%)
 *   · the `-y` spelling     final `IY2` NOT spelled `-y` is only 67% unstressed in gold, because those
 *                           are `-ee` compounds and loans whose last syllable is a free morpheme —
 *                           `bumblebee`, `carefree`, `jubilee`, `filigree`, `oversee`, `divorcee`
 *
 * ⚠ AND THE OBVIOUS EXCEPTION GATE IS A TRAP. The only two `-y` words gold stresses are `latchkey` and
 * `turnkey`, so "unless it ends `-key`" looks right. But 17 of the 198 rows end `-key` and 15 are
 * SURNAMES (`starkey`, `markey`, `pankey`, `whipkey`…), while CMUdict writes `IY0` on 100 of the 121
 * `-key` words including the identical `berkey`, `blakey`, `buckey`. Gating on `-key` would hold the
 * stress on 15 surnames whose twins are unstressed — re-creating this very inconsistency, on the side
 * with less evidence.
 *
 * ⚠ AND IT WOULD BUY NOTHING. Both words carry the `IY2` on the syllable ADJACENT to the primary
 * (`L AE1 CH K IY2`, `T ER1 N K IY2`), so the older secondary-stress clash rule drops the mark before
 * this rule is reachable — `latchkey` rendered `lˈæʧki` before this change and renders `lˈæʧki` after,
 * byte-identical. An exception would restore `stress = 2` and the clash rule would drop the mark
 * anyway. They are missed against gold, but they were missed before this and for another reason.
 *
 * This also unblocks the flap, which reads the digit directly: `ability` was `əbˈɪlᵻtˌi` because a
 * stressed vowel takes a real onset, and is now `əbˈɪlᵻTi` — gold `əbˈɪləTi`.
 *
 * Not applied when `word` is absent, which is the COMPOUND path deliberately withholding it — and a
 * compound's final element is precisely where a free morpheme does carry its own beat.
 */
function demoteFinalIy2(P: { base: string; stress: number }[], word: string): void {
    const last = P[P.length - 1];
    if (word.endsWith("y") && last?.base === "IY" && last.stress === 2)
        last.stress = 0;
}

/**
 * A WORD HAS EXACTLY ONE PRIMARY STRESS. Demote every primary but the LAST to secondary.
 *
 * ⚠ THIS WAS ENFORCED ON THE OOV PATHS AND NOT ON THE DICTIONARY, which is why it is here and not only in
 * `englishG2p.ts`. 1,029 `g2p-dict.tsv` rows carry more than one stress-1 nucleus, because CMUdict declines
 * to resolve prefixed forms, compounds and initialisms (`AA1 R CH B IH1 SH AH0 P`, `N AY1 N T IY1 N`,
 * `EY1 B IY1 EH1 S`), and the flat lexicon rendered them verbatim — so **372 words came out with two or
 * three primary marks inside one group**, which is not a transcription of anything. `enforceSinglePrimary`
 * had always run on the n-gram and tagger output, which is exactly why it never showed there: the guard
 * existed on one path and not its twin. Here it cannot be bypassed.
 *
 * ⚠ THE LAST, AND THIS IS THE ONLY PLACE THE CHOICE IS MADE. `enforceSinglePrimary` no longer demotes at
 * all, so the predictor and the dictionary cannot disagree — a demotion in both places made the SAME
 * ARPABET read two ways depending on which path delivered it (`AA1 R CH B IH1 SH AH0 P` → `ˈɑːɹt͡ʃbɪʃəp`
 * via the predictor, `ˌɑːɹt͡ʃbˈɪʃəp` via the dictionary), which is the seam the curation gate exists to
 * catch. Splitting them scored +147 with zero regressions and was rejected for that reason.
 *
 * Gold resolves CMUdict's unresolved rows to the LATER element — 81:24 on the 150 prefixed rows, and
 * unanimously on the teen numerals, which are the frequent case in real text:
 *
 *     nineteen  nˌIntˈin      thirteen  θˌɜɹtˈin      fourteen  fˌɔɹtˈin      eighteen  ˌAtˈin
 *
 * Over 89,411 words against gold: **+341 / −106, net +235**; keeping the first is +37 / −0.
 *
 * ⚠ THE 106 ARE REAL AND NAME THE NEXT REFINEMENT. They are fore-stressed COMPOUNDS — `Afrobeat`,
 * `Twitterverse`, `Antabuse`, `allemande` — plus short proper nouns (`Attu`, `Padang`, `Sauria`) and the
 * `-ean` pair `Humean`/`Lockean`. So the real discriminator is not which path the phones came from, it is
 * PREFIXED (stem keeps the primary) versus COMPOUND (fore-stressed), which needs a morphological inventory
 * this module does not have. Measured: prefixed rows go to the last 81:24, compound rows to the first
 * 37:31. Those 106 words are that refinement's evidence set.
 *
 * ⚠ AND THE CEILING IS NOT HERE. A demoted mark that lands next to the primary is then deleted outright by
 * the secondary-stress CLASH RULE below — `archbishop` → `ˈɑːɹt͡ʃbɪʃəp`, `nineteen` → `nIntˈin` where gold
 * has `nˌIntˈin`. Half of the 311 gold-covered rows match neither policy for that reason; with the clash
 * rule off, agreement on the stress PATTERN goes 120 → 175 of 311. That rule is the next thing to look at,
 * and it now blocks two fixes rather than one.
 */
export function singlePrimary(phones: string[]): string[] {
    let lastPrimary = -1;
    for (let i = 0; i < phones.length; i++) if (/1$/.test(phones[i]!)) lastPrimary = i;
    // ⚠ ALWAYS A FRESH ARRAY, including the no-primary case. `enforceSinglePrimary` writes into the array it
    // gets back, so returning the input here would mutate a caller's phones in place.
    return phones.map((p, i) => (lastPrimary >= 0 && i !== lastPrimary && /1$/.test(p) ? p.replace(/1$/, "2") : p));
}

/**
 * Prefixes ending in a spelled ⟨n⟩ whose boundary BLOCKS velar assimilation — see the rule below.
 *
 * ⚠ THE OUTER PREFIX IS OPTIONAL BECAUSE A DERIVED FORM MUST NOT CONTRADICT ITS OWN STEM. Anchored with
 * no outer group, `engage` was ɛnɡˈeᶦd͡ʒ while `disengage` was dɪsɪŋɡˈeᶦd͡ʒ, and `incline` — a heteronym
 * corrected for exactly this — was ɪnklˈaᶦn while `disincline` was dˌɪsɪŋklˈaᶦn. Measured over the 867
 * nasal+velar words the Moby referee covers: 591 → 597.
 */
const TRANSPARENT_PREFIX = /^(?:dis|re|mis|over|under|pre|post)?(?:un|in|non|con|en|syn|down|trans)/u;

/** Build the ARPABET→IPA converter from a correspondence def. The allophony (flap/aspirate/dark-l/ŋ/ʲ,
 *  stress marking, weak-vowel merger) is the shared engine; `def` supplies the variety-specific IPA values. */
export function makeArpabetToIpa(
    def: ArpabetDef,
    /**
     * Word → the indices of its ARPABET phones that are a SYLLABIC consonant's schwa slot
     * (`en-syllabic.tsv`). Passed in rather than loaded here, because this module is DATA-FREE on
     * purpose — a different English variety supplies its own `def`, and would supply its own table.
     * Omitted (the OOV tagger's path) means no word has syllabic slots, which is the prior behaviour.
     */
    syllabic: ReadonlyMap<string, readonly number[]> = new Map(),
    /**
     * Word → the indices of its ARPABET phones that are an `N` before a `K`/`G` at a COMPOUND SEAM,
     * where the velar assimilation below must not fire (`en-nasal-seam.tsv`). Injected for the same
     * reason `syllabic` is: this module is data-free, and the fact is lexical.
     * ⚠ A TABLE AND NOT A RULE, MEASURED. See the velar-assimilation comment below and Run 27 of
     * docs/investigations/en/en_moby_source_audit_investigation.md — two discriminators were built from
     * 1,130 referee-labelled sites and both misfire on `benghazi`/`pangloss`/`pancreas`.
     */
    nasalSeam: ReadonlyMap<string, readonly number[]> = new Map(),
): (phones: string[], word?: string) => string {
    const { map, conditionalVowels: cv } = def;
    /** The TRUE diphthongs, for the clash exception above — NOT `OW`/`EY`, which CMUdict writes as a 2°
 *  on an ordinary unstressed final syllable (`zorro`, `aalto`, `adolfo`, `airplane`). */
/** The vowels gold marks on an OPEN final syllable next to the primary — see the clash rule below.
 *  Measured, not chosen: of the 330 such sites gold covers, it marks OY 10/10, AW 8/8, EY 65/71,
 *  AY 11/12, AO 10/11 and UW 22/33, against OW 22/104, IY 9/55 and AA 5/15.
 *  ⚠ `UW` AND `AO` ARE THE MARGINAL MEMBERS and were tested rather than assumed: dropping UW costs 8
 *  words (87.82% → 87.79%) and AO another 9. Both stay, but they are the ones to drop first. */
const STRONG_OPEN_FINAL = new Set(["EY", "AY", "OY", "AW", "AO", "UW"]);

/**
 * DIPHTHONGS THAT TAKE AN R-COLOURED OFFGLIDE — the `-ower`, `-ire`, `-ayer`, `-oer` nucleus. ARPABET
 * writes these as TWO nuclei (`AW2 ER0`), so the clash rule below counted the site as "not the final
 * syllable" and dropped its mark; phonetically it is one syllable, and gold says so:
 *
 *     AY+ER0  bonfire, backfire      29 sites   gold marks 28   97%
 *     AW+ER0  horsepower, coneflower 20 sites   gold marks 20  100%
 *     OW+ER0  filmgoer, flamethrower  8 sites   gold marks  8  100%
 *     EY+ER0  bricklayer, minelayer   7 sites   gold marks  7  100%
 *                                    ── 64 sites, 63 marked, 98% ──
 *
 * against 60% (1,225 of 2,038) at every other clash site, which is why the blanket rule drops them.
 * Reported as `horsepower` sounding like "horse-pour": HH AO1 R S P AW2 ER0 lost the beat on `-power`
 * and the compound flattened, where `lighthouse` (L AY1 T HH AW2 S) kept it — the AW2 there IS the final
 * nucleus, so the existing final-syllable exemption already covered it.
 *
 * ⚠ THE MONOPHTHONGS ARE NOT IN THIS SET AND MUST NOT BE. `IY+ER0` and `UW+ER0` are the same shape on
 * paper — `nonlinear` nɑnlˈɪniəɹ, `rescuer` ɹˈɛskjuəɹ — and gold marks neither. It is the DIPHTHONG that
 * makes the pair one syllable. ⚠ `OY` is here on phonetic grounds with no evidence either way: the
 * dictionary has no OY2+ER0 clash site at all.
 */
const R_OFFGLIDE_DIPHTHONG = new Set(["AY", "AW", "OW", "EY", "OY"]);
const VOWELS = new Set(def.vowels);
    /** Convert a CMUdict ARPABET phone list → canonical IPA (before-nucleus stress + cleanroom GenAm allophony). */
    return function arpabetToIpa(phones: string[], word = ""): string {
        // ⚠ WHICH PHONES THE DEMOTION TOUCHED, because the clash rule below must not delete those marks.
        // It exists to drop a 2° CMUdict WROTE on an ordinary syllable next to the primary (`zorro`,
        // `aalto`); a 2° this engine just created from a 1° is the opposite case — the dictionary called
        // that syllable strong, and deleting the mark leaves `nineteen` as `naᶦntˈiːn` with nothing on
        // `nine` at all, where gold has `nˌIntˈin`.
        const resolved = singlePrimary(phones);
        const demoted = new Set<number>();
        for (let i = 0; i < phones.length; i++) if (phones[i] !== resolved[i]) demoted.add(i);
        const P = resolved.map(split);
        demoteFinalIy2(P, word);
        rebaseSuffixIh(P, word);
        // The slots whose schwa is NOT a schwa but the sonorant after it being syllabic.
        const sylSlots = syllabic.get(word);
        let pendingSyllabic = false;
        const nucleiIdx = P.map((p, i) => (VOWELS.has(p.base) ? i : -1)).filter(
            (i) => i >= 0,
        );
        const nucleusNum = new Map(nucleiIdx.map((vi, ni) => [vi, ni]));
        const primaryNi = nucleiIdx.findIndex((vi) => P[vi]!.stress === 1);

        let out = "";
        for (let i = 0; i < P.length; i++) {
            const { base, stress } = P[i]!;
            const nextIsR = i + 1 < P.length && P[i + 1]!.base === "R";
            const nextIsV = i + 1 < P.length && VOWELS.has(P[i + 1]!.base);
            // REDUCED SLOT — misaki writes `ᵊ` here and we write one of TWO things, because `ᵊ` is
            // not one phonological fact. Measured over the 3,264 slots this table marks: in 2,647
            // (81%) the sonorant is in the CODA and genuinely carries the syllable (`able`, EY1 B
            // AH0 L, [ˈeɪbl̩]); in 617 (19%) it is the ONSET of the next syllable and cannot be
            // syllabic at all (`accompany`, gold `əkˈʌmpᵊni`, where the n starts `ni`).
            //
            // ⚠ SO `ᵊ` IS A REDUCED SCHWA, NOT A SYLLABICITY MARK, and conflating the two would put
            // a false claim in the canonical IPA to win a true token downstream. Canonical IPA has
            // both: the syllabic diacritic for the first, and the EXTRA-SHORT breve for the second.
            // `KokoroFormat` maps each to `ᵊ`, so Kokoro sees what misaki gave it either way.
            if (VOWELS.has(base) && sylSlots?.includes(i)) {
                const son = i + 1;
                const sonIsOnset = son + 1 < P.length && VOWELS.has(P[son + 1]!.base);
                if (sonIsOnset) {
                    out += "ə\u0306";   // extra-short schwa: reduced, but the sonorant is an onset
                    continue;
                }
                pendingSyllabic = true;
                continue;
            }
            if (VOWELS.has(base)) {
                const ni = nucleusNum.get(i)!;
                // Secondary-stress clash: drop a 2° whose syllable is ADJACENT (consecutive nucleus) to the 1°.
                //
                // ⚠ EXCEPT ON THE FINAL SYLLABLE, which is the compound's second element and does carry
                // a beat. Reported as `profile` sounding like "pro-fil": CMUdict writes `P R OW1 F AY2 L`,
                // the clash fired, and the AY came out with NO mark at all — not reduced, just unmarked,
                // which the TTS then renders as reduced. The A/B preferred the marked reading, and the
                // marked reading is what the dictionary already said.
                //
                // ⚠ THE EXCEPTION WAS RE-MEASURED AGAINST GOLD AND WIDENED. It used to require a TRUE
                // diphthong (AY/OY/AW) AND a closed syllable, which was tuned on "rows changed" and on
                // not breaking tests — never against the reference. Asking misaki's gold what it does at
                // each clash site, over 31,760 words whose alignment was validated first:
                //
                //   final syllable, CLOSED    gold marks it  1,849 / 1,973   94%   → exempt, any vowel
                //   final syllable, OPEN      gold marks it    167 /   330   51%   → exempt by VOWEL
                //   NOT the final syllable    gold marks it    918 / 1,973   47%   → keep dropping
                //
                // The open-final half is not a coin flip once split by vowel: OY 10/10, AW 8/8, EY 65/71,
                // AY 11/12, AO 10/11, UW 22/33 against OW 22/104, IY 9/55, AA 5/15. That split IS the
                // `airway` (EH1 R W EY2, gold `ˈɛɹwˌA`) versus `zorro` (Z AO1 R OW2) distinction the
                // original narrowing was reaching for — CMUdict writes OW2 on an ordinary final -o, and
                // marking it over-articulates, but a final EY/AY/OY/AW is a real beat.
                //
                // Whole per-nucleus stress patterns matching gold, by variant:
                //   as it was (true diphthong + closed)          83.32%
                //   no clash rule at all                         86.63%   ← the rule DOES do work
                //   any vowel, closed final                      87.50%
                //   + open final on the strong vowels            87.82%   ← this, +1,430 words
                //   + also exempting non-final sites             86.88%   ← worse; non-final stays dropped
                //
                // ⚠ AND `a priori` MOVES, which the old comment recorded as the reason not to widen. The
                // test that pinned it was titled "an open final syllable is not marked" and was pinning a
                // design choice rather than a reported misreading; `priori` is `P R AY0 AO1 R AY2`, an
                // open final AY, and gold marks open-final AY 11 times out of 12. The blanket claim is
                // now measured to be wrong, so the test records the vowel split instead.
                let mark = stress === 1 ? "ˈ" : stress === 2 ? "ˌ" : "";
                if (
                    stress === 2 &&
                    !demoted.has(i) &&
                    primaryNi >= 0 &&
                    Math.abs(ni - primaryNi) === 1 &&
                    !(
                        ni === nucleiIdx.length - 1 &&
                        (i < P.length - 1 || STRONG_OPEN_FINAL.has(base))
                    ) &&
                    // ⚠ AND NOT AN R-COLOURED OFFGLIDE, which ARPABET spells as two nuclei and is one
                    // syllable — see R_OFFGLIDE_DIPHTHONG for the 64-site measurement against gold.
                    !(R_OFFGLIDE_DIPHTHONG.has(base)
                        && P[i + 1]?.base === "ER" && P[i + 1]?.stress === 0)
                )
                    mark = "";
                out += mark;
                if (
                    base === "AH" &&
                    isBarredI(word, P, i, ni, nucleiIdx.length)
                )
                    out += "ᵻ";
                else if (
                    base === "IH" &&
                    isBarredI(word, P, i, ni, nucleiIdx.length)
                )
                    out += "ᵻ";
                else if (base === "AH")
                    out += stress <= 0 ? cv.AH.unstressed : cv.AH.stressed;
                else if (base === "ER")
                    out += stress <= 0 ? cv.ER.unstressed : cv.ER.stressed;
                else if (base === "IY")
                    out += nextIsR && !IY_PREFIX_BEFORE_R.test(word)
                        ? cv.IY.beforeR
                        : stress <= 0
                          ? cv.IY.unstressed
                          : cv.IY.stressed;
                else if (base === "UW")
                    out += nextIsR ? cv.UW.beforeR : cv.UW.default;
                else out += map[base] ?? base;
                // ʲ-glide hiatus: a high front nucleus (i/iː) directly before another vowel inserts ʲ.
                if (base === "IY" && nextIsV) out += "ʲ";
                continue;
            }
            // SYLLABIC CONSONANT, part 2 of 2 — this sonorant carries the syllable, so it takes the
            // mark and skips the allophony below: the flap rule would look for a following VOWEL that
            // no longer exists, and dark-l is already what a syllabic /l/ is.
            if (pendingSyllabic) {
                pendingSyllabic = false;
                out += `${base === "L" ? "ɫ" : (map[base] ?? base)}\u0329`;
                continue;
            }
            // VELAR ASSIMILATION: /n/ before /k/ or /ɡ/ is [ŋ]. ⚠ IT REPAIRS CMUdict RATHER THAN
            // DUPLICATING IT, which is why it cannot simply be deleted: the dictionary already writes
            // `NG` where the assimilation applies (2,424 rows — `bank`, `uncle`, `anchor`, `finger`) and
            // `N` where it does not (923), but 346 of that second group are slips on tautomorphemic
            // words — `anglophile`, `anglophone`, `ankh`, `ancona`, `agincourt` — which this fixes.
            //
            // ⚠ AND IT MUST NOT CROSS A TRANSPARENT PREFIX BOUNDARY, where assimilation is blocked and
            // CMUdict's `N` is a statement rather than a slip. Unconditioned, it read `unclean` as
            // əŋklˈiːn and `income` as ˈɪŋkˌʌm, overwriting the distinction the lexicon had made. Four
            // independent lines agree on `n` there: the dictionary itself; Moby; the wikipron referee
            // (backs `n` on `unclean`, `unconditional`, `inclination`, `bancroft` — 4 of the 5 it
            // arbitrates); and the RECORDINGS, 15 to 2 (`income` n×4 ŋ×1, `increase` n×4,
            // `uncomfortable` n×2, `increasingly` n×4, `conclude` n×1).
            // ⚠ THE INDEX GUARD IS WHAT MAKES THE SPELLING TEST SAFE: only a nasal inside the prefix
            // itself is exempt (`un` N at 1, `non`/`con`/`down` at 2, `trans` at 3), so a later N+velar
            // in the same word still assimilates.
            // ⚠ THE SPELLING TEST OVER-FIRES ON WORDS THAT MERELY BEGIN WITH THE LETTERS, and those are
            // fixed in the DICTIONARY rather than by narrowing the rule, because narrowing measures
            // WORSE: over the 867 nasal+velar words the Moby referee covers, the full prefix list scores
            // 68.9%, `un|in|non` 65.2%, `un|in` 64.7%, and no rule at all 52.0%. `congruent`,
            // `congruence`, `syncope`, `encore`, `engel` and `increment` were CMUdict slips this rule
            // used to paper over; corrected in g2p-dict.tsv, where the evidence points.
            // ⚠ AND THE PREFIX IS NOT THE ONLY BOUNDARY IT MUST NOT CROSS — a COMPOUND SEAM blocks
            // assimilation too (`pan·cake`, `rain·coat`, `man·kind`, `turn·key`, `Lenin·grad`), and the
            // dictionary already says `N` at every one of them. Measured over 1,130 referee-labelled
            // sites: where the dictionary writes `N`, the referees back it 298 to 33, so this rule is
            // overriding a statement far more often than it is repairing a slip. It still earns its
            // place — the 33 are real (`anglophile`, `ankh`, `gangrene`, `drinkable`, `lancaster`) and
            // turning the rule off ships them wrong — but the seams need `nasalSeam` above.
            // ⚠ THE SEAM IS A TABLE AND NOT A RULE, AND THAT WAS THE EXPENSIVE PART. A splitter (does
            // the word divide into two dictionary words at the boundary?) is 31:2 on the labelled seams
            // and also claims `benghazi`, `hangul`, `pangloss`, `panchromatic`, `vainglorious`; a
            // morpheme list derived from the labelled data has `corn` 3, `green` 3, `pan` 3 and then
            // thirty morphemes with ONE attestation each, and `pan` alone reaches `pancreas`,
            // `pangloss` and `panchromatic`. This is lexis. Run 27 of the audit has the numbers.
            // ⚠ AND A SYMMETRIC GUARD WAS REJECTED. Rewriting `NG`→n at the same boundary would make a
            // stem and its inflection agree (`increment`/`increments`), but it also reaches `congo`,
            // `congress`, `congregate`, `conga`, `english` and `uncle`, which are ŋ for everyone. The
            // ten split families were CMUdict disagreeing with itself, and are fixed there too.
            if (
                base === "N" &&
                i + 1 < P.length &&
                (P[i + 1]!.base === "K" || P[i + 1]!.base === "G") &&
                !(i <= 6 && TRANSPARENT_PREFIX.test(word)) &&
                !nasalSeam.get(word)?.includes(i)
            ) {
                out += "ŋ";
                continue;
            }
            // FLAP (mined t:V_V0=ɾ79 / d:V_V0=ɾ64): t/d intervocalic before an UNSTRESSED vowel → voiced flap.
            //
            // ⚠ THE GUARD IS `=== 0`, NOT `!== 1`. It was `!== 1` — which also admits stress 2 — and the
            // prose above it had been rewritten to match ("a NON-primary vowel"), so the rule documented
            // the code rather than the measurement it came from. `V_V0` is the mined context and the 0 is
            // the ARPABET stress digit: the flap needs the FOLLOWING vowel unstressed. A secondary-stressed
            // syllable takes a real onset, so `acetate` is ˈæsətˌAt, not *ˈæsəTˌAt ("assa-date").
            //
            // ⚠ AND IT READS THE DICTIONARY'S OWN DIGIT, NOT THE STRESS THAT SURVIVES THE CLASH RULE.
            // Reading the post-clash stress was tried, because `thirty` is TH ER1 D IY2 and the clash
            // drops that 2° — so the flap saw a beat the output does not show. It scores marginally
            // better on whole-word exact agreement (+29 of 80,222) and WORSE on the thing this rule is
            // about: 997 words flapped where gold does not against 866, and 917 spurious flap tokens
            // against 796. The clash rule is a decision about where to PRINT a mark, not a claim that a
            // syllable is unstressed, and leaning on it flaps compounds whose second element really does
            // take a beat — `sawtooth` → *sˈɔTuθ, `detox` → *dˈiTɑks. `thirty` is a bad dictionary row
            // (every other decade is IY0, and gold says θˈɜɹɾi); it is fixed in g2p-dict.tsv where it
            // belongs, not by bending the rule around it.
            //
            // Measured against misaki's us_gold (what Kokoro was trained on), 80,222 words: we emitted a
            // flap immediately before a secondary-stress mark 1,112 times to gold's 47, and on the 1,109
            // words where we did it gold agreed on 4 — 0.4%. The twin guard already existed for primary
            // stress (we never flapped there, 0 occurrences), which is what says this was an oversight
            // rather than a position.
            if ((base === "T" || base === "D") && i > 0 && i + 1 < P.length) {
                const prev = P[i - 1]!,
                    next = P[i + 1]!;
                if (
                    (VOWELS.has(prev.base) || prev.base === "R") &&
                    VOWELS.has(next.base) &&
                    next.stress === 0
                ) {
                    out += base === "T" ? "t̬" : "d̬";
                    continue;
                }
            }
            // ASPIRATE (mined #_V1=ʰ~75, NOT after /s/): p/t/k at a syllable onset before a STRESSED vowel.
            if (base === "P" || base === "T" || base === "K") {
                const prevBase = i > 0 ? P[i - 1]!.base : "#";
                const next = i + 1 < P.length ? P[i + 1]! : null;
                const onset = i === 0 || VOWELS.has(prevBase); // word-initial or after a vowel (starts a syllable)
                if (
                    prevBase !== "S" &&
                    onset &&
                    next &&
                    VOWELS.has(next.base) &&
                    next.stress >= 1
                ) {
                    out += base === "P" ? "pʰ" : base === "T" ? "tʰ" : "kʰ";
                    continue;
                }
            }
            // DARK-L (mined coda l→ɫ): l is velarized in the coda (before a consonant or word-finally).
            if (
                base === "L" &&
                !(i + 1 < P.length && VOWELS.has(P[i + 1]!.base))
            ) {
                out += "ɫ";
                continue;
            }
            out += map[base] ?? base;
        }
        return out;
    };
}
