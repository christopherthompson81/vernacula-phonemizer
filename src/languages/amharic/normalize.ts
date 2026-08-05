/**
 * Amharic (am) text normalization (#562) — pure text→text, run inside `text()` before tokenization.
 *
 * EVIDENCE. Counts are over the 1,922 unique FLEURS `am_et` transcripts, column 3 (the cased, punctuated
 * original). 399 of them (20.8%) contain digits.
 *
 *   ፡፡  (U+1361 ×2, the typewriter sentence terminator)   74   62 utterance-final, 12 interior — ALL are
 *                                                              sentence boundaries, and 60 utterances use
 *                                                              ፡፡ *instead of* ። entirely. Dropped silently.
 *   dotted abbreviations (ኪ.ሜ, እ.ኤ.አ., ኤፍ.ቢ.አይ.)        ~60   every interior dot became a full STOP
 *   grouped thousands (5,000)                             43   read as "አምስት , ዜሮ" — pause + a bare zero
 *   ordinals (19ኛ, 15 ኛ, 190ኛ, 11ኛው)                     37   "አስራ ዘጠኝ" + a stranded ኛ
 *   decimals (6.34)                                       26   the dot became a full STOP
 *   ኪ.ሜ / ኪሜ (kilometre)                                 35   read as the letter-run "kime"
 *   ፡ alone (colon / time separator)                      20   dropped silently
 *   clock (10:08, 07:19, 11፡00)                           21   the colon became a COMMA pause
 *   ranges after ከ ("from X to Y")                          5   the hyphen was dropped, numbers ran together
 *   ኪ.ሜ² / ኪ.ሜ2                                            3   the exponent was stranded, then dropped
 *   °                                                       3   dropped silently
 *   %                                                       4   already correct (በመቶ, postposed)
 *   $ ¥ £                                                  14   already correct; magnitudes added below
 *
 * NEGATIVE RESULTS, recorded so nobody repeats the search:
 *
 *   · **Ethiopic punctuation is NOT swallowed by the TOKEN letter class.** The known hazard (a raw block
 *     range eating the script's own punctuation, as in Burmese and Khmer) does not apply: `[ሀ-ፚ]` is
 *     U+1200–U+135A, and ። ፣ ፤ ፥ ፦ ፧ ፨ are U+1362–U+1368 — above the range. All 3,391 of them already
 *     reached the punctuation branch. `clausePunctuation` values are unpadded and `number()` leaks no
 *     digits. Nothing to fix outside this layer.
 *   · **Ethiopic numerals ፩፪፫…፻፼ (U+1369–U+137C) do not occur in the corpus at all** (0 instances), so no
 *     additive-numeral reader was built. They would be a real defect if they appeared — they fall inside
 *     `[ሀ-ፚ]`… no: they are U+1369+, so they are dropped entirely by TOKEN and phonemize to the empty
 *     string (verified: "፩፪፫" → ""). `foldNativeDigits` cannot help — the system is additive with no zero.
 *     Reported, not built, per "do not invent data".
 *   · **ብር (birr) ×74 is almost entirely a false positive** — ብርሃን "light", መቃብር "grave", ክብር "honour".
 *     No standalone currency use. No birr rule.
 *   · **The Ethiopian calendar and the 6-hour clock offset are NOT applied.** The corpus writes European
 *     digits with ኤ.ኤም / ፒ.ኤም / GMT markers ("ሰኞ 10:08 ፒ.ኤም", "07:19 ኤ.ኤም."), i.e. already in the
 *     European frame; nothing in the text settles which frame a bare time is in, so converting would be
 *     guessing. Likewise ዓ.ም / እ.ኤ.አ. are left as letter-runs rather than resolved to a calendar.
 *   · **ሚሜ (millimetre) ×10 is left alone.** ኪ.ሜ is expanded because the corpus itself writes ኪሎ ሜትር and
 *     ኪሎሜትሮች in full; ሚሜ has no such in-corpus or espeak attestation, and a wrong expansion is worse
 *     than the written abbreviation.
 *
 * `\b` is ASCII-defined and matches nothing against Ethiopic — every boundary here is an explicit
 * `(?<![\p{L}\p{M}])` / `[ሀ-ፚ]` lookaround.
 */

/** Ethiopic syllabary letters, EXCLUDING the punctuation and numeral sub-blocks (U+135F and up). */
const FID = "[\\u1200-\\u135A]";

/** Amharic decimal point. Source: espeak-ng `dictsource/am_list` line 33, `_dpt  _n'@t`yb` — näṭəb, which
 *  round-trips through this repo's own fidel g2p to nətʼɨb, matching espeak's skeleton n-tʼ-b. */
const POINT = "ነጥብ";

/** Range connective. Corpus-sourced: 70 instances of እስከ, including the explicit "ከ 06:30 እስከ 07:30" and
 *  "ከ 100 እስከ 250 ሜትር" that the hyphenated form abbreviates. */
const UNTIL = "እስከ";

/**
 * ORDINALS. Amharic forms the ordinal on the LAST word of the cardinal with the suffix ኛ, and a
 * consonant-final (6th-order, ɨ) cardinal takes its 1st-order counterpart before it: አንድ→አንደኛ (ድ→ደ),
 * ሁለት→ሁለተኛ (ት→ተ), ዘጠኝ→ዘጠነኛ (ኝ→ነ), አስር→አስረኛ (ር→ረ). Vowel-final cardinals just suffix: ሃያ→ሃያኛ.
 *
 * EVERY entry for 1–10 and 20 is attested in this corpus's own running text (አንደኛ ×6, ሁለተኛ ×26, ሦስተኛ ×6,
 * አራተኛ ×6, አምስተኛ ×6, ስድስተኛ ×4, ሰባተኛ ×2, ስምንተኛ ×1, ዘጠነኛ ×4, አስረኛ ×2 + ዐሥረኛ/አሥረኛ spelling variants ×2,
 * ሃያኛ ×1) — so this table is corpus-sourced, not invented. The teen composition is confirmed by
 * በአስራስድስተኛው ("in the 16th"): አስራ + the unit's ORDINAL. 30–90, መቶ and ሺ are unattested as ordinals but are
 * vowel-final and take the bare suffix by the same regular rule that ሃያኛ demonstrates.
 */
const ORDINAL: Record<string, string> = {
    "አንድ": "አንደኛ", "ሁለት": "ሁለተኛ", "ሦስት": "ሦስተኛ", "አራት": "አራተኛ", "አምስት": "አምስተኛ",
    "ስድስት": "ስድስተኛ", "ሰባት": "ሰባተኛ", "ስምንት": "ስምንተኛ", "ዘጠኝ": "ዘጠነኛ", "አስር": "አስረኛ",
    "ሃያ": "ሃያኛ", "ሰላሳ": "ሰላሳኛ", "አርባ": "አርባኛ", "ሃምሳ": "ሃምሳኛ", "ስልሳ": "ስልሳኛ",
    "ሰባ": "ሰባኛ", "ሰማንያ": "ሰማንያኛ", "ዘጠና": "ዘጠናኛ",
    "መቶ": "መቶኛ", "ሺ": "ሺኛ", "ሚሊዮን": "ሚሊዮንኛ", "ቢሊዮን": "ቢሊዮንኛ", "ዜሮ": "ዜሮኛ",
};

/**
 * Build the Amharic normalizer.
 *
 * `numberToText` is injected rather than imported so that normalize.ts and amharic.ts do not form an
 * import cycle: amharic.ts owns the number composer and hands it over here.
 *
 * `symbols` is the shared `makeSymbolNormalizer` pass (%, currency). It is threaded THROUGH this function
 * instead of wrapping it, because the ordering is load-bearing in both directions — see step 9.
 */
export function makeAmharicNormalizer(
    numberToText: (n: number) => string,
    symbols: (text: string) => string,
): (text: string) => string {
    /** Spell one integer string; falls back to the digits when out of the composer's range. */
    const words = (digits: string): string => {
        const n = Number(digits);
        return Number.isSafeInteger(n) && n >= 0 && n < 1e12 ? numberToText(n) : digits;
    };
    /** Digits read one at a time — the fractional tail of a decimal. */
    const eachDigit = (digits: string): string =>
        [...digits].map((d) => numberToText(Number(d))).join(" ");
    /** Ordinal: compose the cardinal, then inflect only its FINAL word. */
    const ordinal = (digits: string): string => {
        const w = words(digits).split(" ");
        const last = w[w.length - 1]!;
        const o = ORDINAL[last];
        if (o === undefined) return "";
        w[w.length - 1] = o;
        return w.join(" ");
    };

    return (input: string): string => {
        let s = input;

        // 1. ፡፡ → ። . TWO U+1361 ETHIOPIC WORDSPACE is the typewriter/keyboard substitute for ። (አራት ነጥብ),
        //    and this corpus uses it as its ONLY sentence terminator in 60 utterances. It is not in
        //    `clausePunctuation` and was reaching no branch of TOKEN, so 74 sentence boundaries — 62 of them
        //    utterance-final — produced no pause at all. FIRST, so step 4 sees only lone ፡.
        s = s.replace(/፡፡/gu, "።");

        // 2. ፡ used as a TIME separator (11፡00, 9፡30, 11፡29). Folded to ASCII ':' so the single clock rule
        //    in step 5 covers both spellings. BEFORE step 4, which claims every remaining lone ፡.
        s = s.replace(/(\d)፡(\d)/gu, "$1:$2");

        // 3. DOTTED ABBREVIATIONS. Amharic writes initialisms and unit abbreviations with ASCII dots between
        //    Ethiopic letters (ኤ.ኦ.ኤል, አር.ኤስ.ፒ.ሲ.ኤ, ኤፍ.ቢ.አይ., እ.ኤ.አ., ፒ.ኤም, ኪ.ሜ). Each interior dot was
        //    mapped by `clausePunctuation` to a full STOP, so a single initialism shattered its sentence
        //    into up to six phrases. Removing the dots leaves a fidel run, which IS the spelled reading —
        //    ኤ.ኦ.ኤል is already A-O-L written out in Ethiopic letters.
        //
        //    MULTI-DOT FIRST (the standing ordering rule), and the multi-dot form also loses its TRAILING
        //    dot. That is safe here on tabulated evidence, not assumption: all 22 multi-dot abbreviations in
        //    the corpus are mid-sentence, none is utterance-final, and Amharic terminates sentences with ።
        //    (2,053) rather than with an ASCII dot. ZERO sentence-final pauses are lost.
        s = s.replace(new RegExp(`(?:${FID}{1,5}\\.){2,}${FID}{0,5}\\.?`, "gu"), (m) => m.replace(/\./gu, ""));
        //    Then the single INTERIOR dot (ኪ.ሜ, ዓ.ም, ፒ.ኤም). Bounded by a fidel on BOTH sides, so it cannot
        //    touch 1.5, 802.11a, or a genuine trailing period after a word.
        s = s.replace(new RegExp(`(?<=${FID})\\.(?=${FID})`, "gu"), "");
        //    A trailing dot on a SINGLE-dot abbreviation (ወዘተ. ×2, ቁ., ምሳ., ኮ., ቪ., ሰዓ.) is deliberately
        //    LEFT: that shape is indistinguishable from a word plus a sentence period, and there are only 7.

        // 4. Any remaining lone ፡ is a clause colon — it introduces a list in all 14 residual instances
        //    ("ሁለት ነገሮች ላይ ይወዳደራሉ፡ አልጋ አገልግሎት እና ቁርስ"). Mapped to ASCII ',' which `clausePunctuation`
        //    already carries, so TOKEN needs no change. AFTER step 2, which took the time separators.
        s = s.replace(/፡-?/gu, ",");

        // 5. DIGIT DE-GROUPING, before anything reads a comma as punctuation (the standing first coupling).
        //    "5,000" was read as "አምስት , ዜሮ" — a phrase break plus the word for zero. The corpus writes
        //    grouping only with commas in 3-digit blocks (43); it never uses the period for grouping (0).
        s = s.replace(/(\d),(?=\d{3}(?!\d))/gu, "$1");
        s = s.replace(/(\d),(?=\d{3}(?!\d))/gu, "$1"); // second pass for 5,000,000

        // 6. CLOCK, before any rule that could claim a bare number, and before decimals — the corpus's
        //    sports splits are "4:41.30", where the clock must take 4:41 and leave .30 to step 10.
        //    The colon was becoming a COMMA, so "10:08" read as "አስር , ስምንት".
        //
        //    Only the separator is resolved. NO ሰዓት/ደቂቃ is inserted: the text already supplies the frame
        //    ("ከቀኑ 10:00 ሰዓት", "ከሌሊቱ 11:35 ሰዓት", "07:19 ኤ.ኤም."), and adding the word would double it —
        //    exactly the duplicate-الساعة failure the playbook records for Arabic. The Ethiopian 6-hour
        //    offset is likewise NOT applied; see the header.
        //    The optional `.SS` tail is consumed HERE rather than left to step 10, because step 10's decimal
        //    pattern needs digits on BOTH sides of the dot and the clock rewrite has just removed them —
        //    "4:41.30" would have stranded ".30" and the bare dot became a sentence STOP. Found by probing
        //    the corpus's three sports splits, not by inspection.
        s = s.replace(/(?<!\d)(\d{1,2}):([0-5]\d)(?:\.(\d+))?(?!\d)/gu,
            (_m, h: string, mi: string, frac: string | undefined) => {
                // :00 is the whole hour and is read as the bare hour, not as "…zero".
                const hm = Number(mi) === 0 && frac === undefined ? words(h) : `${words(h)} ${words(mi)}`;
                return frac === undefined ? ` ${hm} ` : ` ${hm} ${POINT} ${eachDigit(frac)} `;
            });

        // 7. A clock written with a DOT and an explicit timezone ("ከቀኑ 12.00 GMT", "(15.00 ዩቲሲ)"). Without
        //    this the decimal rule in step 10 would read it as "twelve point zero zero". Guarded by the
        //    timezone token, so it cannot claim an ordinary decimal. 2 instances.
        s = s.replace(/(?<!\d)(\d{1,2})\.00(?=\s*(?:GMT|UTC|ዩቲሲ|ጂኤምቲ))/gu, (_m, h: string) => ` ${words(h)} `);

        // 8. RANGES, restricted to the ከ ("from") frame — "ከ120-160 ሜትር" → "ከ 120 እስከ 160 ሜትር". The corpus
        //    spells this out 70 times with እስከ, so the connective is its own. The restriction matters: of the
        //    19 hyphenated number pairs, 14 are SPORTS SCORES or bracketed year spans ("7-2", "26 – 00",
        //    "(1644-1912)"), which must NOT become "from…to". Those 14 are left as two adjacent numbers,
        //    which is what they already were — the hyphen is dropped by TOKEN and no pause was ever emitted.
        s = s.replace(/(?<![\p{L}\p{M}])ከ\s?(\d[\d.]*)\s?[-–—]\s?(\d[\d.]*)/gu,
            (_m, a: string, b: string) => `ከ ${a} ${UNTIL} ${b}`);

        // 8b. TWO LOCAL WORKAROUNDS for the shared currency tier, both measured on this corpus. Reported as
        //     core limitations rather than fixed there; a `core/` change would touch all 191 languages.
        //
        //     (i) The tier's `CUR` key is guarded by `(?<![\p{L}\p{M}])`, so a LETTER-CODE PREFIX blocks it:
        //     "US$14.7", "US$11,000", "ዩኤስ$30" and "AUD$45" — 4 of this corpus's 10 `$` instances — matched
        //     nothing and the sign was dropped outright. Detaching the sign lets the tier see it. The code
        //     itself is left where it was.
        s = s.replace(/(?<=[A-Za-zሀ-ፚ])(?=\$\s?\d)/gu, " ");
        //     (ii) The tier's "the text already says it" guard is a PREFIX test against the declared noun,
        //     which does not survive Amharic plural morphology: ዶላሮች is not a prefix of ዶላር, because the
        //     plural shifts the final 6th-order ር to the 7th-order ሮ before ች. "$100 ዶላሮች" therefore read
        //     "መቶ ዶላር ዶላሮች". Dropping the now-redundant sign here is equivalent and keeps it local.
        s = s.replace(/\$\s?(\d[\d.,]*)(\s+(?:ሚሊዮን|ቢሊዮን|ቢልየን|ትሪሊዮን))?(?=\s*ዶላ[ርሮ])/gu,
            (_m, n: string, mag: string | undefined) => `${n}${mag ?? ""}`);

        // 9. SHARED SYMBOL TIER (%, $, ¥, £) runs HERE, in the middle: after de-grouping and the clock (so
        //    "$11,000" and "10:08" are already settled) but BEFORE decimals, because the tier's own NUM
        //    pattern matches "14.7" as one number and a decimal rewrite would destroy the currency
        //    adjacency — "US$14.7 ቢሊዮን" must reach it intact to come out "14.7 ቢሊዮን ዶላር".
        s = symbols(s);

        // 10. DECIMALS. Integer part as a number, ነጥብ, then the fraction ONE DIGIT AT A TIME. After the
        //     clock (step 6/7) and after the symbol tier (step 9); the abbreviation dots are long gone.
        s = s.replace(/(?<![\d.])(\d+)\.(\d+)(?![\d.])/gu,
            (_m, i: string, f: string) => ` ${words(i)} ${POINT} ${eachDigit(f)} `);

        // 11. ORDINALS. "19ኛ" / "15 ኛ" / "11ኛው" — the ኛ was a separate token and the cardinal kept its
        //     un-inflected final syllable ("አስራ ዘጠኝ" + "ኛ"). Any definite/feminine tail (ው/ዋ) is preserved.
        //     After de-grouping (step 5) so "1000ኛ" is a single numeral.
        s = s.replace(/(?<![\d.])(\d+)\s*ኛ([ውዋ]?)(?![ሀ-ፚ])/gu, (m, d: string, tail: string) => {
            const o = ordinal(d);
            return o === "" ? m : ` ${o}${tail} `;
        });

        // 12. SQUARED AREA, before the plain ኪ.ሜ expansion in step 13 (which would otherwise strand the
        //     exponent, as it did before: "3,850 ኪ.ሜ²" lost the ² entirely). ካሬ PRECEDES the unit, which is
        //     the corpus's own convention — it writes "300,948 ካሬ ኪ.ሜ." and "783,562 ስኩዌር ኪ.ሜ." in full,
        //     ካሬ ×10. Note the dots are already stripped by step 3, so the key here is the bare ኪሜ.
        s = s.replace(/(?<![ሀ-ፚ])ኪሜ\s?[²2](?![\d\p{L}])/gu, "ካሬ ኪሎ ሜትር");

        // 13. ኪ.ሜ / ኪሜ → ኪሎ ሜትር (35). Corpus-sourced: the same corpus writes "ሰባ ኪሎ ሜትር" and
        //     "50 ኪሎሜትሮች" in full, so the spoken form is the expansion, not the letter-run "kime" the
        //     fidel g2p was producing. Unconditional (not routed through the shared unit tier) because it
        //     also occurs with no adjacent number — "ኪ.ሜ በ ሰዓት". ሚሜ is NOT expanded; see the header.
        s = s.replace(/(?<![ሀ-ፚ])ኪሜ(?![ሀ-ፚ])/gu, "ኪሎ ሜትር");

        // 14. ° → ዲግሪ ("+30°C", "35 °W"; 3 instances). ዲግሪ is attested spelled out in this corpus. Only the
        //     sign is resolved — the Latin scale letter after it (C, W) is out of TOKEN's alphabet and is
        //     dropped as it always was, and no Amharic spelling of "Celsius" is sourceable here.
        s = s.replace(/°/gu, " ዲግሪ ");

        // 15. THE PLUS SIGN → ፕላስ, SOURCED FROM THE CORPUS'S OWN AUDIO. The sign was DROPPED outright, so the
        //     corpus's `(UTC+1)` lost it entirely. No text tier could supply the word: `concept.ts` returns the
        //     bare character `+` as Amharic's own label for "plus sign", and prose writes the glyph, so there is
        //     nothing to probe for.
        //
        //     Decoded with facebook/wav2vec2-xlsr-53-espeak-cv-ft, a PHONEME recognizer — its vocabulary holds
        //     no `+` and no digits, so unlike a text ASR it cannot echo the orthography back at you. Over
        //     am_et/train:
        //       UTC+1   →  m j uː t iː s iː  p l a s  w a n   ·   w eɪ m y t i s i  p l a s  w a n   (2 of 3;
        //                  the third skips the parenthetical, the reader behaviour also seen in ta, en and zu)
        //       +30°C   →  s a l a s a d i ɡ l i s e d i s j o s   ·   s a l a s a d i ɡ r i s l i ʃ e ts j o
        //                  — ሰላሳ ዲግሪ, thirty degrees, with NO plus phones, 2 of 2
        //
        //     ⚠ TEXT ASR GOT THIS WRONG IN BOTH DIRECTIONS AND MUST NOT BE USED FOR IT. MMS-1b-all (amh
        //     adapter) transcribes this corpus accurately but emits `utc+1` — the SIGN — because its vocabulary
        //     is orthographic; and on the control languages it silently DROPPED a demonstrably spoken plus
        //     (hi's `प्लस`, ta's `பிளஸ்`). A `+` in a text ASR's output is not evidence that a word was said.
        //     The phoneme model was validated on hi, where the answer was already known: 4 of 4 correct,
        //     including reproducing the SILENCE before the temperature.
        //
        //     Both arms, so the sign is read glued to a label or opening the quantity. The measurement position
        //     is voiced too: both am speakers omit it there, but for a TTS target a reader skipping a character
        //     the author typed is evidence about reading habit, not licence to delete content — and omitting a
        //     plus is lossless where omitting a minus inverts.
        s = s.replace(/(\S)\+[  ]?(?=\d)/gu, "$1 ፕላስ ");
        s = s.replace(/(^|[  ])\+[  ]?(?=\d)/gu, "$1ፕላስ ");

        // THE RELATIONAL AND DIVISION SIGNS (#654), sourced ENTIRELY from am_et — and Amharic needs a rule shape
        // no other language in this issue has used.
        //
        // ⚠ THE STANDARD OF COMPARISON TAKES A PREFIX, NOT A POSTPOSITION. Amharic marks it with ከ- on the front
        // of the operand and puts the comparative after it, so `A < B` is "A ከB ያነሰ" — the corpus shows this on
        // a numeric operand directly: "ለትንሽ ከ40,000 ያነሰ የህዝብ ቁጥር" (a population of FEWER THAN 40,000).
        // core/postposedSign.ts cannot express that: it appends words after the operand and never modifies it.
        // The division is the same shape with በ-: FLEURS's parallel sentence writes "በአስራ ሁለት በመክፈል"
        // ("by dividing by twelve"), i.e. በ + operand + በመክፈል.
        //
        //   `ያነሰ`    ×11 token  ·  `የበለጠ` ×71 token  ·  `በመክፈል` ×3  ·  `እኩል` ×2 token
        //
        // `እኩል` reads infix, as the equality words do elsewhere ("እኩል ቅሬታዎች" — equal complaints).
        //
        // ⚠ THE PREFIX IS WRITTEN FUSED TO THE DIGIT AND ENDS UP AS ITS OWN TOKEN, which is a known limitation
        // rather than the intent. `ከ6` is emitted fused — the orthographic form — but the number path then
        // replaces the digit with its word, leaving ከ as a separate token: `6 > 5` reads *kə sɨdɨst* where
        // ከስድስት would be one word. The PHONES are identical either way (/kə/ + /sɨdɨst/), so this is the same
        // prosodic imperfection ta's accusative ஐ and ml's -എക്കാൾ carry, for the same reason — fusing properly
        // needs the numeral spelled in this rule, which is tr's and ko's machinery.
        s = s.replace(/(\S+)\s*<\s*(\S+)/gu, "$1 ከ$2 ያነሰ");
        s = s.replace(/(\S+)\s*>\s*(\S+)/gu, "$1 ከ$2 የበለጠ");
        s = s.replace(/(\S+)\s*÷\s*(\S+)/gu, "$1 በ$2 በመክፈል");
        s = s.replace(/\s?=\s?/gu, " እኩል ");

        return s.replace(/[  ]{2,}/gu, " ");
    };
}
