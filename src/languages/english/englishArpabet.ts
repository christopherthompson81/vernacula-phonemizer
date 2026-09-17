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
): (phones: string[], word?: string) => string {
    const { map, conditionalVowels: cv } = def;
    /** The TRUE diphthongs, for the clash exception above — NOT `OW`/`EY`, which CMUdict writes as a 2°
 *  on an ordinary unstressed final syllable (`zorro`, `aalto`, `adolfo`, `airplane`). */
const DIPHTHONG = new Set(["AY", "OY", "AW"]);
const VOWELS = new Set(def.vowels);
    /** Convert a CMUdict ARPABET phone list → canonical IPA (before-nucleus stress + cleanroom GenAm allophony). */
    return function arpabetToIpa(phones: string[], word = ""): string {
        const P = phones.map(split);
        demoteFinalIy2(P, word);
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
                // ⚠ EXCEPT A CLOSED FINAL SYLLABLE ON A TRUE DIPHTHONG, which is the compound's second
                // element and does carry a beat. Reported as `profile` sounding like "pro-fil": CMUdict
                // writes `P R OW1 F AY2 L`, the clash fired, and the AY came out with NO mark at all —
                // not reduced, just unmarked, which the TTS then renders as reduced. The A/B preferred
                // the marked reading, and the marked reading is what the dictionary already said.
                //
                // ⚠ ALL THREE CONDITIONS ARE LOAD-BEARING, and each was added because the version
                // without it was measurably wrong (`en_rebuild_lexicon.mts --diff`, rows changed):
                //   · every diphthong, any position   13,189 rows — far past the reported shape
                //   · +final nucleus only              2,684 rows — but `zorro`→zˈɔːɹˌoᶷ, `aalto`,
                //                                      `adolfo`: CMUdict writes OW2 on an ordinary
                //                                      final -o, and marking it over-articulates
                //   · +true diphthongs (AY/OY/AW)      1,113 rows — but `a priori`→pɹaᶦˈɔːɹˌaᶦ, an OPEN
                //                                      final syllable, which broke an existing test
                //   · +closed syllable                 1,024 rows — clean, whole suite green
                // What survives is compounds whose second element genuinely takes a beat: `skylines`,
                // `breakout`, `graveside`, `birthrights`, `yuletide`, `zeitgeist`, `textile`.
                let mark = stress === 1 ? "ˈ" : stress === 2 ? "ˌ" : "";
                if (
                    stress === 2 &&
                    primaryNi >= 0 &&
                    Math.abs(ni - primaryNi) === 1 &&
                    !(
                        DIPHTHONG.has(base) &&
                        ni === nucleiIdx.length - 1 &&
                        i < P.length - 1
                    )
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
                    out += nextIsR
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
            if (
                base === "N" &&
                i + 1 < P.length &&
                (P[i + 1]!.base === "K" || P[i + 1]!.base === "G")
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
