import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";

/**
 * Māori (mi) TEXT NORMALIZATION (#586) — the pre-tokenizer pass. Pure text→text, no IPA. Runs inside
 * maori.ts's `text()`, before the tokenizer.
 *
 * ⚠ THIS LAYER IS THE SYMBOL TIER AND NOTHING ELSE YET. Māori had no normalization of any kind — `text()`
 * ran the tokenizer straight over raw input — so this file starts where the fleet's shared tier can reach,
 * and the number-FORMATTING half is still open. The counts for that work are recorded at the bottom.
 *
 * The tokenizer's classes are letters, digits and clause marks, so `%`, `$` and every unit abbreviation
 * were DELETED outright before this: `88%` read as bare *waru tekau mā waru*.
 *
 * Every word below is from mi_nz, counted over the 1,994 UNIQUE utterances (FLEURS repeats each one per
 * speaker, so the raw counts are ~2.5× these):
 *   ōrau ×8      "i piki ake ki te 8 ōrau"            ← percent, POSTPOSED
 *   tāra ×6      "te tāra $5 me te $100 hou o Kānata"   pauna ×5  "te utu ko te 27 miriona pauna"
 *   kiromita ×34 "he taone 50 kiromita (31 maero)"      mita ×28  "He 15 mita te poutū"
 *   pūrua ×18    "755,688 kiromita pūrua (291,773 maero pūrua)"   ← squared, POSTPOSED
 *   pūtoru ×3    "I te Luno ētahi 120-160 mita pūtoru o te kora"  ← cubed, POSTPOSED
 *   ia ×6        "240 kiromita ia hāora", "1.5 kiromita ia hēkona"  ← the rate connective
 *
 * ⚠ `tapawhā` ×12 AND `tapatoru` ×5 ARE THE SHAPES, NOT THE POWERS, and both counts beat the words that are
 * right: tapawhā is a square as in a PLAZA — "St. Pita Tapawhā", St Peter's Square — and tapatoru is a
 * triangle ("ngā tapatoru hāngai", right triangles). Same split as fr carré, tr kare, gu વર્ગ (trap 37).
 *
 * ⚠ `m/h` IS MILES PER HOUR HERE, so it is declared as its own unit KEY rather than left to the rate path.
 * The corpus writes "35-40 m/h (56-64 km/h)" and "300m/h" — the km/h gloss settles it — and with only `m`
 * declared plus an `h` denominator the tier would have read mph as *metres* per hour, a confidently wrong
 * reading where a raw letter was merely a silent one. A slashed key sorts before the bare `m` because
 * `unitAlt` is longest-first, which is how French's `km/h` key already works.
 * (The spelling is `maero` ×30, the corpus's dominant form; the two rate instances write `mairo`.)
 *
 * NOT DECLARED, deliberately:
 *   · `mm` — ×15 in the corpus ("35 mm", "3136 mm2") but NO word for it: manomita and mirimita are both ×0
 *     here and mi.wikipedia offers nothing, so the abbreviation still leaks rather than be invented.
 *   · `t`/`kg` — no word attested, and `t` is the trap: a digit-adjacent `t` in this corpus is `1,400
 *     tāngata` ("1,400 PEOPLE"), which an ASCII-classed guard would not reject because `ā` is not [a-zA-Z].
 *
 * STILL UNTREATED, and this tier does not pretend otherwise — the number-FORMATTING half is a #585 pass of
 * its own, since the tokenizer's `(\d+)` stops at a comma and `,` is a clause mark:
 *   comma-grouped ×50 (`19,500` reads "nineteen, PAUSE, five hundred") · decimals ×38 · ranges ×18 ·
 *   clock ×12 · and the corpus's one `km₂` (U+2082 SUBSCRIPT two, in "19,500 km₂"), which is bad notation
 *   rather than orthography — `CO₂` in lb is the only correct subscript in any of the 67 corpora, so nothing
 *   fleet-wide should learn this one, and it is left for that local pass to fold if it wants to.
 */
const SYMBOLS = makeSymbolNormalizer({
    // #586 `multiply` — this language had NO word for the sign at all. ⚠ STANDARD MATHEMATICAL REGISTER, not a
    // corpus attestation: the sweep's plausible hits were homographs of PREPOSITIONS (es `por` ×23, it `per` ×25,
    // ru `на` ×31 are all the preposition), the same trap that defeated the exponent sourcing. One word, so `by`
    // defaults to it — this language does not split dimension from product.
    multiply: { times: "whakarea" },
    percent: ["ōrau"],
    // The PREFIXED forms are declared as their own keys, longest-first, exactly as Gujarati's table does:
    // this corpus writes `AUD$45 miriona` and `US$14.7 piriona`, and with only a bare `$` the letters were
    // read as a word ("au …") and the sign dropped. `£` earns its place on the WORD, pauna ×5 ("ngā pauna
    // Peretānia"), rather than on a sign this corpus never writes.
    // ⚠ `NZ$` IS NOT ATTESTED HERE — the string "NZ" is ×0 in mi_nz — and is declared anyway, stated rather
    // than left to look sourced like its two neighbours. The justification is not corpus frequency: it is
    // that the New Zealand dollar is te reo Māori's OWN currency, `tāra` is the attested word for a dollar
    // (×6), and the alternative is that the commonest sign this language will ever be handed reads its
    // letters as a word. If that argument is ever judged too thin, delete the key — the reading of the
    // other four does not depend on it.
    currency: { "US$": ["tāra"], "AUD$": ["tāra"], "NZ$": ["tāra"], $: ["tāra"], "£": ["pauna"] },
    // A MAGNITUDE MUST BE DECLARED OR THE CURRENCY WORD LANDS INSIDE THE NUMBER. Without these, `$2.3
    // piriona` read "rua . toru TĀRA piriona" — the sign is adjacent to the digits, so the word was emitted
    // there and the magnitude stranded behind it. The corpus writes the magnitude FIRST and takes no
    // connective, which is the shape the tier's hop produces: `piriona tāra` ×1 ("kei ōna piriona tāra te
    // nui"), `miriona tāra` ×1 ("ngā tini tekau miriona tāra ia tau"), and `27 miriona pauna`.
    // miriona ×27 · mano ×18 · piriona ×4.
    magnitudes: ["miriona", "piriona", "mano"],
    units: { km: ["kiromita"], m: ["mita"], "m/h": ["maero ia hāora"] },
    unitPer: "ia",
    rateDenominators: { h: "hāora", s: "hēkona" },
    exponentWords: { squared: ["pūrua"], cubed: ["pūtoru"], position: "after" },
});


/**
 * The Māori normalization pass. Currently the shared symbol tier alone — there is no language-local rule
 * yet, and this is the file the number-formatting work belongs in when it happens (see the header).
 */
export function normalizeMaori(input: string): string {
    // 1) HTML ENTITY, then the bare ampersand → `me` ("and", ×726 in the corpus). The entity must go first or
    //    `&amp;` would become "me amp ;". The corpus's two instances are the fleet's usual pair, `B&B` and
    //    `Arts & Sciences`; before this the sign was dropped outright and `B&B` read as two bare consonants.
    //    Spaced on both sides deliberately — `B&B` is two initialisms, and joining them would make one token.
    let s = input.replace(/&amp;/giu, "&").replace(/&/gu, " me ");
    // 1b) ⚠ THE PLUS IS ATTESTED AND DELIBERATELY NOT SHIPPED, WHICH IS A DIFFERENT LIMIT FROM "UNSOURCED".
    //     The corpus's `(UTC+1)` and `+30°C` both drop the sign. The audio ANSWERS what the readers say —
    //     decoded with facebook/wav2vec2-xlsr-53-espeak-cv-ft over mi_nz/train:
    //       UTC+1  →  `… j y t i s i  p l a s w a n  k i w aɪ t h o l …`   1 of 3 (two skip the parenthetical)
    //       +30°C  →  `… a k e i t e  p l a s  θ ɛ t i  t a k i r i s i …`  BOTH speakers — mi voices the
    //                 MEASUREMENT plus, like ta and gu and unlike en/hi/vi/te/xh/am
    //     So the word is known: the speakers use the English "plus".
    //
    //     ⚠ AND THIS ENGINE CANNOT SAY IT. Māori has no /l/ and no /s/, so the g2p drops both letters:
    //     `plus` → [pu], `plas` → [pa]. There is NO Māori spelling that reproduces the attested phones, and
    //     emitting [pa] for a plus sign would be a confidently wrong syllable where there is currently silence
    //     — the one outcome this repo ranks below a missing reading. (The same inventory gap already shows in
    //     `Whitehall` → [ɸiteha].)
    //     A native maths word was NOT substituted: the recordings say the readers use the loan, so choosing a
    //     different word because it happens to be pronounceable would be inventing a reading the evidence
    //     contradicts. Recorded here so the next pass does not re-derive the sourcing and reach for [pa].
    // 1b) THE RELATIONAL AND DIVISION SIGNS (#654), sourced ENTIRELY from mi_nz — and unlike the plus above,
    //     ⚠ ALL FOUR READINGS ARE NATIVE MĀORI WORDS THIS ENGINE CAN ACTUALLY SAY. That is the whole reason they
    //     can be shipped where the plus cannot: the note above records that the plus is a LOAN in the recordings
    //     (`plas`), and Māori having no /l/ and no /s/ means the g2p would emit [pa] — a confidently wrong
    //     syllable. Here the corpus supplies words made of Māori phonemes, so there is nothing to approximate:
    //
    //       `rite ki`     ×43 phrase   "tana ōrite ki ngā raiona" — its EQUIVALENCE TO lions
    //       `iti iho`     ×40 phrase   "he iti iho te wā hanimuni" — the honeymoon period is LESS
    //       `nui ake`     ×100 phrase  "te taipitopito nui ake" — GREATER detail
    //       `whakawehe`   ×15 token    and FLEURS's parallel division sentence, "te whakawehe ki te tekau mā rua"
    //                                 ("dividing by twelve")
    //
    //     ⚠ ALL FOUR ARE INFIX, which is not what a VSO language would suggest and is a fact about the
    //     constructions: the comparative takes `i` as its "than" and the standard follows it
    //     ("he iti iho te wā X i te Y"), so `A < B` is "A iti iho i B" with the operands in written order. Same
    //     for the equality (`rite ki`) and the division (`whakawehe ki`), both of which take their preposition
    //     before the second operand. So no reordering is needed — the ja/ko/fa problem does not arise here.
    //
    //     Māori is the fleet's most extreme routing case (#663): a word it cannot spell goes to the English
    //     reader. These words are all spellable, so they stay on the native branch and phonemize natively.
    s = s.replace(/\s?=\s?/gu, " rite ki ");
    s = s.replace(/\s?<\s?/gu, " iti iho i ");
    s = s.replace(/\s?>\s?/gu, " nui ake i ");
    s = s.replace(/\s?÷\s?/gu, " whakawehe ki ");

    // 2) The shared symbol tier. Everything else this language needs is declared data, not a local rule.
    return SYMBOLS(s);
}
