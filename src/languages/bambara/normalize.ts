/**
 * Bambara / Bamanankan (bm) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is
 * not already a pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * ⚠ THERE IS NO FLEURS FOR BAMBARA. The evidence is `tools/corpus/mined/bm.jsonc` (dump-sourced, so its
 * `sample` tier IS the real distribution) plus a fresh bm.wikipedia dump — 2,359 lines / 430,646 characters
 * after `wikidump-to-text.py`, which is the WHOLE of the Bambara wiki. Every count below is over that dump
 * unless it says otherwise. Full log: `docs/investigations/bm_normalization_investigation.md`.
 *
 * ⚠ BOTH REGISTERED SCRIPTS REACH THIS LAYER, AND ONLY ONE OF THEM IS WRITTEN. bm is catalogued Latin/N'Ko
 * and the engine accepts both (`bambara.ts`'s TOKEN admits `Nko`, and N'Ko digits ߀–߉ fold to ASCII in
 * `numbers.ts`). But the corpus is Latin: N'Ko letters occur in the whole wiki only inside the word ߒߞߏ
 * itself, in the article ABOUT the script. So every rule here is written for the Latin orthography, and
 * none of them keys on a character N'Ko uses — the N'Ko path passes through untouched and still reaches the
 * same g2p it did before.
 *
 * ⚠ AND THE CORPUS IS CODE-MIXED AND ORTHOGRAPHICALLY MIXED. A Bambara wiki carries French bibliographies,
 * French sentences, English citation furniture and — separately — a large body of text in a NON-STANDARD
 * oral-transcription spelling (`u'be`, `i'b'a`, `côngôn`, `sôrô`) beside the standard one. So a raw count is
 * a lead about the FILE, not about the language, and every number quoted below was read back to its
 * instances. Where a class is foreign-text-only the comment says so.
 *
 * WHAT THE ENGINE DID BEFORE THIS LAYER, on real corpus shapes — this is the defect list, not an
 * assumption about it:
 *
 *     40%              → binaani                                the sign is SILENT (×45)
 *     k'a / b'a / y'a  → k a  /  b a  /  j a                    a BARE CONSONANT as a word (×1218)
 *     114.983          → kɛmɛ ni tã ni naani . kɛmɛ …          grouping dot → a SENTENCE BREAK
 *     1,200 million    → kelẽ , kɛmɛ fila milliõ                grouping comma → a PAUSE, wrong number
 *     241 038 km2      → …kelẽ bisaba ni seeɡĩ km fila         space grouping → 2 numbers, km raw, `2` read
 *     7,62 / 1.8       → wolõwula , biwɔɔrɔ ni fila / kelẽ . seeɡĩ   a comma PAUSE and a SENTENCE BREAK
 *     619,745 km²      → …ni duuru km                           unit raw as [km], exponent gone
 *     1965-1969        → two cardinals, no connective           (×76 hyphen pairs)
 *     A.R.P. bangera   → a . r . p . bãɡera                     3 spurious clause breaks
 *     304 K.Ɲ.         → kɛmɛ saba ni naani k . ɲ .            2 more, plus an unreadable [kɲ]
 *     ISBN 978-84-…    → four separate CARDINALS               a catalogue number spoken as arithmetic
 *     $4  /  S&P       → nothing at all
 *
 * ── WHAT IS DELIBERATELY NOT DONE, each with the check that refused it ────────────────────────────────
 *
 * ⚠ NO DECIMAL-POINT WORD. `sources.ts` reports `[NONE] decimal-point` and espeak does not ship Bambara at
 *   all, so there is no phonetic fallback either. `attest.ts` against bm.wikipedia: `wirigili` ×0,
 *   `pwen` ×0, and `tomi` ×1 is a TREE in a list of trees (`mangoro pegun tomi balansan nɛrɛ`). So the
 *   fractional digits are read one at a time with NO separator word — what `sources.ts` itself prescribes
 *   for this case, and the Lingala precedent. The defect being fixed is the spurious PAUSE and the mis-read
 *   tail, not the missing word.
 *
 * ⚠ NO CUBE WORD, WHICH IS WHY `m³` (×2) STAYS UNREAD. `kube` IS attested ×2 and both hits mean CAPITAL
 *   CITY — "Kɔnakry kɛli a faaba (kube) ye", "Jine kube n'a Kubeso lu" — and `kubu` is ×0. The corpus's one
 *   glossed instance writes raw French (`metre cube 135 000 m³`). Shipping `kube` would be the Fula
 *   `hakkunde` failure with a citation that looks right; the square word `kɛnɛ` below is attested in
 *   exactly the slot and the cube word simply is not.
 *
 * ⚠ NO MINUS WORD, AND THIS ONE IS KNOWN-WRONG RATHER THAN ACCEPTABLE. Omitting a plus is lossless;
 *   omitting a minus INVERTS. The whole corpus has THREE leading minuses and all three are in ONE sentence,
 *   both of them BCE years: "Julius Caesar (bangera san -100 - ka sa kalo san -44)". No Bambara word for a
 *   negative number is attested anywhere, and the language's own era convention is the K.Ɲ. marker at step
 *   3 rather than a signed year — so rewriting `-100` as an era phrase would be an inference about the
 *   author, not a reading of the text. ⚠ SO IT IS NOT IN `ACCEPTED_SILENT` EITHER, and `review.ts --lang
 *   bm` stays red on it: an accepted silence claims the drop is correct, and this one is not.
 *
 * ⚠ NO `=` `×` `<` `>`. `=` counts 40 and NONE is arithmetic: EasyTimeline markup residue that survived
 *   extraction (`ImageSize = width:420`, `DateFormat = yyyy`, `Period = from:0 till:2000000`), linguistic
 *   glosses in the grammar articles (`ba = ma`, `ka ji Bɔn = jibɔn`), and `E=mc^2`. `×` counts 3 and every
 *   one is a CARTRIDGE DIMENSION (`7,62 × 39 mm`, `7.62 ×33 mm`, `7,62x41`), which is "by" and not "times".
 *   `<` and `>` are ×0. A reading built on that evidence would be worse than silence.
 *
 * ⚠ NO CLOCK. The colon-clock shape `\d{1,2}:\d{2}` occurs **ZERO** times in the entire bm wiki. (The
 *   committed artifact carries one, `07:37:40 PST (UTC+8)`, from an older dump.) There is nothing to
 *   measure a reading against and no Bambara reading of a digital time is attested.
 *
 * ⚠ NO INITIALISMS AS LETTER NAMES. `core/initialisms.ts` exists and ~30 languages wire it, but it is a
 *   NO-OP without a `letterName` table, and `sources.ts` reports `[NONE] letter-names — espeak does not
 *   ship this language at all`. That is the fleet-wide 94-language sourcing block, not a coding one (trap
 *   16 checked: the seam exists, the DATA does not). Step 3 therefore only removes the DOTS from `A.R.P.`,
 *   which is a pause defect, and leaves the reading of the letters exactly where it was.
 *
 * ⚠ NO ORDINAL RULE. The Bambara ordinal suffix is `-nan` and the corpus writes it glued to digits
 *   (`16nan`, `18nan`, `100nan` — ×50). The engine's TOKEN already splits the digit run from the letters,
 *   so `16nan` reads *tã ni wɔɔrɔ nã* today; welding it (`wɔɔrɔnã`) changes only a word boundary and no
 *   phoneme. ⚠ ONE KNOWN GAP RECORDED RATHER THAN GUESSED: Bambara's "first" is suppletive `fɔlɔ` (×131),
 *   not `kelennan`, so a `1nan` would read wrong — the corpus writes it once, already spaced
 *   (`ka sa kalo 1 nan tle 18`), and one instance is not enough to build a suppletion table on.
 *
 * ⚠ THE `abbrev` CELL (×787 in the artifact) IS NOT ABBREVIATIONS. Its selector is
 *   `\p{L}{1,4}\.(?=\s+\p{L})` — a short word, a period, a space, a letter — and Bambara sentences end in
 *   short words constantly (`… ye.`, `… don.`, `… la.`). Every instance read is a sentence-final period.
 *   Claiming any of them would delete a real pause, which is trap 4 from the other direction.
 *   The same applies to `letter-name` (×575: the pronoun `A`) and `latin-in-native` (×1517: the language
 *   is written in Latin, so the cell matches every word).
 *
 * ── AND ONE FINDING THIS LAYER RAISED AND `numbers.ts` SETTLED ────────────────────────────────────────
 *
 * `numbers.ts` was verified word by word against the dump rather than assumed. Ten of its fifteen literals
 * are confirmed in running Bambara text — `fu` ×2, `kelen` ×210, `fila` ×77, `saba` ×46, `naani` ×19,
 * `duuru` ×19, `wɔɔrɔ` ×8, `wolonwula` ×6, `kɔnɔntɔn` ×4, `tan` ×45, `mugan` ×20, `kɛmɛ` ×45, and the
 * bi- tens `bisaba` ×2 / `binaani` ×15 / `biduuru` ×3 / `biwɔɔrɔ` ×1 / `biwolonwula` ×1. FIVE WERE NOT,
 * and each was then adjudicated against Bamadaba (Bailleul/Vydrin) rather than against the wiki alone —
 * see `numbers.ts`'s header and investigation Runs 5–9. THREE of the five moved, ONE was refused:
 *
 *     seegin  → segin   (8)    Bamadaba \lx ségin, \va séegin. The corpus's 24 bare `segin` are 23 of the
 *                              VERB sègin 'revenir' (`ka fanga segin`) — trap 37 — and one numeral, inside
 *                              the spelled-out year `san ba kelen keme segin ani biwolofila ni kononto` (1879).
 *     biseegin → bisegin (80)  Bamadaba \lx bíségin, no seegin variant. Neither form occurs in the corpus.
 *     bikɔnɔntɔn        (90)   REFUSED — kept. All four lexica keep the medial ⟨n⟩; the corpus's
 *                              `bikɔnɔtɔn` ×2 are the same percent-gloss construction twice, and the same
 *                              corpus writes the UNIT `kɔnɔntɔn` ×4 WITH the ⟨n⟩.
 *     waga    → ba     (1000)  Bamadaba has no numeral `waga` at all (wàga = brousse). The corpus agrees:
 *                              `ba kelen keme segin …`, `san ba 2 fo 3`, `kilomɛtɛrɛ ba 7`, and the wiki's
 *                              own gloss `tone ba kɛmɛ fila (200 000 tonnes)`.
 *     milyɔn  → miliyɔn        Bamadaba \lx míliyɔn; the corpus writes `miliyɔn` ×27, `milyɔn` ×0.
 *
 * Nothing below rests on any of it: this layer emits DIGITS wherever a number is involved and lets the
 * engine's own number path speak them. Recorded so the measurement is re-runnable in one grep.
 */
import { makeBareUnitNormalizer } from "../../core/normalizeSymbols.ts";

/** ⚠ THE UNIT NOUN COMES BEFORE THE NUMBER IN BAMBARA, which is why units are local and not the shared
 *  tier's — `normalizeSymbols` can only POSTPOSE (playbook §47 reason 2, the Oromo case). Measured over the
 *  dump: unit-word-then-digits ×32 against digits-then-unit-word ×2. `A ni Sikaso cɛ ye kilomɛtɛrɛ 10`,
 *  `A ni Bamako cɛ ye bamɛtɛrɛ 60`, `a janya ye mɛtɛrɛ 3776 ye`, `milimɛtɛrɛ 7,62`, `yaada 1–4 (mɛtɛrɛ 1–4)`,
 *  `Jamana fensen ye bametri kene 916 445`. The SYMBOL is nevertheless written after the figure
 *  (`637,657 km²`, `34km2`, `5-10 cm`), so the rewrite reorders.
 *
 *  THE SPELLINGS ARE THE CORPUS'S OWN, and there are two competing series for the kilometre: the loan
 *  `kilomɛtɛrɛ` ×22 (plus `kilometiri` ×7, `kilomɛtrɛ` ×3, `kilomɛtri` ×2) and the native calque
 *  ba-mɛtɛrɛ "thousand-metre" — `bametri` ×19, `bamɛtri` ×6, `bamɛtrɛ` ×4, `bamɛtɛrɛ` ×1, ×30 in total but
 *  split four ways. `kilomɛtɛrɛ` is the single most frequent form AND the one the abbreviation `km`
 *  transparently matches, and the corpus itself offers the pair in one breath — `bamɛtri/Kilomɛtri kɛnɛ
 *  103 000 km2`. The calque is recorded here rather than lost. `mɛtɛrɛ` ×6, `milimɛtɛrɛ` ×5,
 *  `santimɛtɛrɛ` ×2.
 *
 *  ⚠ THE SQUARED WORD IS `kɛnɛ`, POSTPOSED AFTER THE UNIT NOUN, and the BARE COUNT IS THE WRONG MEASURE
 *  (trap 37). Whole-word `kɛnɛ` is ×36 and the residue is ordinary Bambara — `kɛnɛ kan` "in public",
 *  `mɔgɔ 1000 fana man kɛnɛ` "a thousand people are unwell". The COLLOCATION `<metre-noun> kɛnɛ` is ×17 and
 *  every single instance glosses a `km²` figure in a country article: `637,657 km² (bametri kɛnɛ)`,
 *  `30355 km2 (bametri kɛnɛ)`, `118000 km2 (bametri kɛnɛ)`, `bameteri kene 27750`. That fixes the word AND
 *  its position in one measurement.
 *
 *  ⚠ NO ONE-LETTER KEYS, MEASURED RATHER THAN ASSUMED (traps 28/46). Digit-adjacent bare `m` is ×4 in the
 *  whole wiki and ALL FOUR are inside `m³`; bare `l` is ×1 and it is the elision `2007 l’a ye`, not a
 *  litre. `kg`, `ha`, `t`, `g` as a Bambara unit word: ×0 attested. Declaring any of them would be pure
 *  exposure with nothing bought.
 *  ⚠ `kg` WAS RE-OPENED AND RE-REFUSED ON BETTER EVIDENCE, because the corpus DOES write it — `bagani foro
 *  tari kelen be se ka KG 1500 walima 2000 dii`, a yield in kilograms, in ordinary Bambara prose and with
 *  the symbol BEFORE the figure exactly as this language orders its unit nouns. So the shape is real and
 *  the reading is missing. What is still absent is a word: `kilogaramu` and `kilogram` are both ×0 on
 *  bm.wikipedia, and the one candidate that is attested — `kilo`, 5 tokens / 3 articles — SPLITS ITS SENSE.
 *  Read: `a kilo be daminɛ binani ni saba la` (cotton, priced per kilo) and `cory kilo san mugan ni wɔrɔ`
 *  are the WEIGHT; `Bamakɔ ni Dakar … tiɛ kilo ba kɛlɛ (1 000)` and `Bamako-Sénou kilo tan ni duru` are
 *  DISTANCES, i.e. kilometres clipped to `kilo`. Three of five hits are the wrong unit, so `kilo` cannot be
 *  keyed to `kg` and cannot be keyed to `km` either — this is trap 37's shape with the bare count replaced
 *  by a read one, and the honest outcome is that `kg` keeps leaking VISIBLY.
 *
 *  ⚠ `m²`/`m2` ARE ×0 IN THIS CORPUS and are declared anyway, because they are the compositional neighbour
 *  of the `km²` the corpus writes ×13 and trap 8 says a table is correct exactly where you looked. Both
 *  keys are two characters, so neither is the one-letter hazard above. */
const UNITS: readonly (readonly [string, string])[] = [
    // longest key first — `km²`/`km2` must be tried before `km`, or the exponent is orphaned as a number.
    ["km²", "kilomɛtɛrɛ kɛnɛ"], ["km2", "kilomɛtɛrɛ kɛnɛ"],
    ["m²", "mɛtɛrɛ kɛnɛ"], ["m2", "mɛtɛrɛ kɛnɛ"],
    ["km", "kilomɛtɛrɛ"], ["cm", "santimɛtɛrɛ"], ["mm", "milimɛtɛrɛ"],
];

/** THE SAME SYMBOLS STANDING ALONE. Every arm of the unit step needs a numeral, so a bare `km` — a caption,
 *  a table header, or a figure whose numeral a bracket or an `&nbsp;` put out of reach — went to the phoneme
 *  sink as raw ASCII, which in a Latin-script language no leak gate can see. The guards are the shared ones
 *  (core/normalizeSymbols.ts): multi-letter vowel-free keys only, so the exponent keys and any one-letter
 *  hazard are excluded automatically; exact case; and never beside a numeral, a rate slash or an exponent. */
const BARE_UNITS = makeBareUnitNormalizer(UNITS);

/** A MAGNITUDE WORD MAY STAND BETWEEN THE FIGURE AND ITS UNIT, and the unit rule has to hop it or the
 *  adjacency it matches on is not there. The corpus writes `A boya bɛse 30.2 million km² (11.7 million sq
 *  mi)` — 1 of the 13 `km²`/`km2` instances — and without the hop that one leaves `km` raw in the IPA.
 *  These are LEFT IN PLACE, not consumed: they are already ordinary words the tokenizer speaks. The
 *  spellings are the corpus's own (`miliyɔn` ×27 is the Bambara form; `million`/`milion`/`miliyon` and
 *  `miliyar`/`milyar` occur in the French-influenced text). */
const MAG = "million|milion|miliyon|miliyɔn|milyɔn|miliyar|milyar";

/** ⚠ ASCENDING PAIRS ONLY, and the guards are what make this rule survivable. `\d+ ?[-–] ?\d+` matches 76
 *  times in this corpus; most are genuine spans but the exceptions are the whole design:
 *
 *  · a hyphen-digit on EITHER side rejects the ISBN chains (`978-84-8168-394-3`, ×5) — the pair must be the
 *    whole thing. Step 4 claims ISBNs outright as well, so this guard is the second of two;
 *  · NON-ASCENDING is left as the bare juxtaposition it already was (the Swahili/Lingala precedent). That
 *    test alone rejects `1911-5 June 2004` (a birth–death pair split across a month name), the equal-ended
 *    `9500- 9500` and `8000- 8000` residue of a French passage, and `(san 40 - 10 ɲɔgɔnna Krisita tile ɲɛ)`
 *    — 40 BC to 10 BC, which ASCENDS in time while descending in figures, so declining it is right;
 *  · the leading `[.,:]` exclusion keeps the rule out of a decimal's or a clock's tail.
 *
 *  ⚠ THE TRAILING GUARD REJECTS A COMMA AND NOT A DOT, WHICH IS NOT A TYPO — it is the same asymmetry step 6
 *  spells out one screen below ("a trailing guard excludes a following separator+digit, NOT a clause mark"),
 *  and this rule did not have it. `(?![\d.,…])` declined every span that ENDS A CLAUSE: `1954 -1981.` and
 *  `86–99.` — both of this corpus's clause-final spans, both at a reference's page range — came back
 *  untouched and read as two juxtaposed cardinals with `fo` gone at exactly a sentence end (playbook trap 58,
 *  reported by `review.ts`'s `clause-final` check). The COMMA STAYS, because Bambara writes a decimal comma
 *  ×42 (`7,62`, `0,3`, `15,3`) and a trailing `,` can therefore open the right operand's fractional part. A
 *  trailing DOT can too, but step 11 still reads it: `10-15.5` is claimed as `10 fo 15` and `15.5` reaches
 *  the decimal rule whole, so the operand is not damaged. The dot has no defence left; the comma has one.
 *
 *  ⚠ NO SPACED-SINGLE-DIGIT ARM IS NEEDED HERE, and that is measured: `\d - \d` with single digits on both
 *  sides is ×0 in this corpus, so the football-score hazard Lingala had to guard does not exist for bm.
 *
 *  The connective is `fo`, and its BARE count of 53 is the wrong measure (trap 37) — most of those are the
 *  verb `fɔ` "to say" spelled without the accent (`Maninka-kan be fo Jine`). Digit-flanked `fo` is ×19 and
 *  every one is a genuine span with both operands bare: `san ba 2 fo 3`, `san 1712 fo ka se san 1861`,
 *  `dɔgɔkun 1 fo dɔgɔkun 8`, `10 fo 15 dɔrɔn %`, `1969 … fo 1992`, `304 K.Ɲ. fo san 232 K.Ɲ.`. */
const RANGE = /(?<![\d.,:\p{L}\p{M}-])(\d+)\s?[-–—]\s?(\d+)(?![\d\p{L}\p{M}-]|,\d)/gu;

/** THE ELISION APOSTROPHE, and it is this layer's largest class by an order of magnitude.
 *
 *  Bambara writes a vowel-elided proclitic with an apostrophe — `k'a` = *ka a*, `n'o` = *ni o*, `y'a` =
 *  *ye a* — and the tokenizer splits on it, so the consonant reaches the phoneme stream AS ITS OWN WORD:
 *  `k'a` → *k a*, `b'a` → *b a*, `y'a` → *j a*. A bare oral stop is not a possible Bambara word (the
 *  language is open CV), which is what makes this a defect and not a preference.
 *
 *  ⚠ CONSONANT + APOSTROPHE + VOWEL ONLY, AND THE NARROWING IS THE RULE. `\p{L}['’]\p{L}` matches 1484
 *  times; the C'V subset is 1218. The other 266 are a DIFFERENT USE OF THE SAME MARK: a large body of this
 *  wiki is written in a non-standard oral transcription that apostrophises a PRONOUN off the following
 *  WORD — `u'be taa` (u bɛ), `u'ka kan` (u ka), `i'b'a fɛ` (i b'a), `a'l'i` — and there the mark is a word
 *  boundary, so gluing would fuse two words into one. Every one of those has a VOWEL on the left, and
 *  every genuine elision has a CONSONANT, so the vowel test separates them exactly.
 *  ⚠ `N'ko` (the script's own name, ×33 as `N'k`/`n'k`/`N'K`) is C'C and therefore untouched.
 *
 *  Frequency of the shapes claimed: k'a ×232, n'a ×202, b'a ×158, y'a ×157, n'o ×56, k'u ×50, n'u ×45,
 *  n'i ×28, y'i ×25, k'i ×24, and a long tail through t'a, c'a, s'a, m'a, f'i. The French `d'`/`l'` (×82)
 *  is the same shape in a borrowed name and glues correctly too (`d'Ivoire` → *dIvoire*). */
const ELISION = /(?<![\p{L}\p{M}])([bcdfghjklmnprstwyzɲŋ])['’ʼ]([aeɛiɔou])/giu;

/**
 * Expand an abbreviation whose OWN trailing dot is ambiguous with the sentence period.
 *
 * Taken from the Lingala/Swahili layer. `body` is the abbreviation WITHOUT its final dot; the dot is
 * consumed only when the sentence visibly continues, and kept when what follows is the end of the input or
 * a capital — so a real pause is never deleted.
 */
function expandDotted(s: string, body: string, word: string): string {
    const atEnd = new RegExp(`(?<![\\p{L}\\p{M}])${body}\\.(?=[ \u00a0]*(?:$|\\p{Lu}))`, "gu");  // space, NBSP
    const inline = new RegExp(`(?<![\\p{L}\\p{M}])${body}\\.`, "gu");
    return s.replace(atEnd, `${word}.`).replace(inline, word);
}

/**
 * HOMOGLYPHS FOR BAMBARA'S FOUR NON-ASCII LETTERS — the largest single defect this layer has left, and the
 * one no leak class could name, because the damage it does is a DELETION.
 *
 * Bambara's alphabet needs ⟨ɛ⟩ U+025B, ⟨ɔ⟩ U+0254 and ⟨ɲ⟩ U+0272, none of which is on a French AZERTY
 * keyboard. So the wiki's writers reach for whatever look-alike their input method offers, and a census of
 * every non-ASCII character in the artifact says exactly which ones:
 *
 *     ɛ U+025B  2910   ← correct        ε U+03B5 GREEK SMALL LETTER EPSILON            179
 *     ɔ U+0254  2461   ← correct        ԑ U+0511 CYRILLIC SMALL LETTER REVERSED ZE      26
 *     ɲ U+0272   265   ← correct        ᴐ U+1D10 LATIN LETTER SMALL CAPITAL OPEN O       9
 *                                       ɳ U+0273 LATIN SMALL LETTER N WITH HOOK          8
 *
 * ⚠ THE READING IS UNAMBIGUOUS IN EVERY INSTANCE, checked rather than inferred from the code chart. `bε`
 * `tε` `kεra` `cε` `Sεbεnna` `Ntεnεndon` are bɛ, tɛ, kɛra, cɛ, Sɛbɛnna, Ntɛnɛndon; `fᴐ` `sᴐrᴐ` `kᴐnᴐ`
 * `ɲᴐgᴐn` `bᴐra` are fɔ, sɔrɔ, kɔnɔ, ɲɔgɔn, bɔra; `boɳa` is boɲa ("size", in `A boɳa bɛ 241 038 km2`).
 * ⚠ ԑ AND ᴐ ARRIVE TOGETHER, in the same articles and often the same word — `bԑ fᴐ`, `sԑbԑn sᴐrᴐ`,
 * `Kԑnyԑrԑye` — i.e. one author's substitution set, not four independent typos.
 *
 * ⚠ WHAT THE ENGINE DID WITH THEM IS NOT A MIS-READING, IT IS AN AMPUTATION. None of the four is in this
 * g2p's grapheme table and none is ASCII, so the tokenizer ends the word at the character and the letter is
 * DROPPED; the word comes out in fragments:
 *
 *     Ntεnεndon ne bε Taa           → nt n ndõ ne b taa            (the day of the week, in three pieces)
 *     sԑbԑn sᴐrᴐ ka baara kԑ        → s b n sr ka baara k
 *     A boɳa bɛ …                   → a boa bɛ …                   (the ɲ silently gone)
 *
 * ⚠ AND THAT IS WHY IT REACHED THIS BRIEF AT ALL. Three of the fragments — `nt` (Ntɛnɛndon), `nw` ×2
 * (labɛnw, ɲɔgɔnnafɛnw) — are vowelless ASCII runs, so the raw-Latin gate reports them, while the far
 * larger silent-deletion population (`boɳa` → *boa*) is invisible to every counter in the tree. The three
 * hits are the symptom; the 222 characters are the defect.
 *
 * ⚠ NOT DONE GLOBALLY, AND THAT IS THE CORRECT LAYER. `core/unicode.ts`'s `foldLatinConfusables` already
 * folds Greek/Cyrillic look-alikes inside a Latin word, but it folds toward the ASCII letter a reader of
 * ANY Latin orthography would see — ε would have to become `e`, and `e` and `ɛ` are two different Bambara
 * phonemes (/e/ vs /ɛ/). The right target is knowable only from the alphabet of THIS language, which is
 * exactly the case the registry's header reserves for a per-language fold.
 *
 * ⚠ ⟨ʃ⟩ U+0283 IS DELIBERATELY LEFT ALONE. It is ×3 and its target is genuinely uncertain — `ʃi fɔcogo`,
 * `ʃyanw`, `Taamaʃyɛn` could be ⟨s⟩ or the digraph ⟨sh⟩ (which this g2p does read, as /ʃ/), and the
 * corpus offers no pair that settles it. Three instances is not enough to guess a phoneme with.
 */
const HOMOGLYPH: Readonly<Record<string, string>> = { "ε": "ɛ", "ԑ": "ɛ", "ᴐ": "ɔ", "ɳ": "ɲ" };
const HOMOGLYPH_RE = new RegExp(`[${Object.keys(HOMOGLYPH).join("")}]`, "gu");

/** Every rule here emits DIGITS wherever a number is involved and lets the engine's own number path speak
 *  them, so this layer carries no number words of its own — which is why the `waga`→`ba`
 *  correction in the header was orthogonal to it. */
export function normalizeBambara(input: string): string {
    // 1) NFC at the entry, so a literal in this file matches whichever normalization the corpus used.
    //    Bambara's own letters (ɛ ɔ ɲ ŋ) do not decompose, but the wiki's non-standard orthography is full
    //    of `è ò ô é` — which do — and the era literal `K.Ɲ.` is keyed on one of the letters that does not,
    //    beside text that does. Trap 11 in a Latin script. The g2p lowercases and matches single characters
    //    downstream, so NFC costs nothing there.
    let s = input.normalize("NFC");

    // 2) HTML ENTITIES AND ZERO-WIDTH MARKS, first — a dump carries `&nbsp;` and `&#…;` and both must go
    //    BEFORE the ampersand rule at step 12, or `&nbsp;` is read as the word "and" followed by the
    //    letters n-b-s-p. The artifact's `zero-width` cell is ×2; a rendering hint is not speech.
    s = s.replace(/&nbsp;|&#(?:x[0-9a-f]+|\d+);/giu, " ").replace(/[​‌‍⁠﻿]/gu, "");

    // 2b) HOMOGLYPHS FOR ɛ ɔ ɲ — see HOMOGLYPH. Immediately after NFC and the entity strip, and before ANY
    //     rule that inspects a letter: the ELISION rule at step 3 has ⟨ɛ ɔ⟩ in its vowel class and the unit
    //     and range rules read letter boundaries, so a word still carrying a Greek epsilon is invisible to
    //     all of them in the same way it is invisible to the tokenizer.
    s = s.replace(HOMOGLYPH_RE, (c) => HOMOGLYPH[c]!);

    // 3) THE ELISION APOSTROPHE — see ELISION. Placed here because it is orthographic rather than numeric
    //    and touches no character any later rule inspects, and BEFORE step 4 so that a name like `d'A.R.P.`
    //    cannot present the dotted rule with a stray consonant token. ×1218.
    s = s.replace(ELISION, "$1$2");

    // 4) ERA MARKER, then DOTTED INITIALISMS — before anything can read an interior dot as a phrase break,
    //    and before step 6, which is the other rule in this file that looks at dots. (In practice they
    //    cannot collide, since these bodies are letters, but the ordering is the one that stays correct if
    //    either widens — trap 39.)
    //
    //    ⚠ `K.Ɲ.` = *Krisita ɲɛ*, "before Christ", and the corpus glosses this whole family of abbreviations
    //    ITSELF, which is the strongest form of attestation there is: `san 800 Krista bange kɔ (KK)`,
    //    `san 900 KB (Krista Bangelen)`, `san 10000 kakɔn Yesu Krista ka wati (KYW)`, and the unabbreviated
    //    phrase `Krisita tile ɲɛ` ×3 (`kabini san 12 000 ni kɔ Krisita tile ɲɛ`, `san kɛmɛ 5nan daminɛ na
    //    Krisita tile ɲɛ`). ⚠ NEGATIVE RESULT KEPT: one of the five instances applies it to a CE span
    //    (`Wagadu c. 200–1240 K.Ɲ.`), so the SOURCE TEXT is itself inconsistent about the era. This rule
    //    reads the abbreviation the author wrote; it does not adjudicate the century.
    s = expandDotted(s, "K\\.Ɲ", "Krisita ɲɛ");

    //    ⚠ AND THE GENERIC RULE ONLY REMOVES THE DOTS. `A.R.P.` (×3), `U.S.A.` (×2), `A.Ş.` (×3) and the
    //    one-off name initials (`J.G.`, `E.E.`, `A.R.`, `W.I.B.`) were each producing one spurious CLAUSE
    //    BREAK per interior dot — `A.R.P. bangera` read *a . r . p . bãɡera*. Reading the LETTERS is a
    //    different problem and is blocked at the data layer (see the header: no letterName table exists for
    //    bm), so this rule fixes the pause and leaves the letters exactly where they were.
    //    ⚠ CAPPED AT FOUR GROUPS, WITH A LOOKAHEAD THAT REFUSES A LONGER RUN. The corpus contains one
    //    27-group line — the Bambara alphabet listed as `A.B.C.D.E.Ɛ.F.…Z.` — and a `{2,4}` without the
    //    lookahead would eat its first four letters and leave the remaining 23 dots as pauses, which is
    //    worse than leaving it alone. With the lookahead every start position inside that run is rejected
    //    (the ones after the first are rejected by the lookbehind as well), so the line is untouched.
    //    ⚠ THE FINAL DOT SURVIVES WHEN THE SENTENCE ENDS. Same argument as `expandDotted`: `U.S.A. Awa
    //    katti` keeps its period, `A.R.P. bangera` does not.
    s = s.replace(/(?<![\p{L}\p{M}.])((?:\p{L}\.){2,4})(?!\p{L}\.)(?![\p{L}\p{M}])/gu,
        (whole: string, _g: string, off: number, all: string) => {
            const body = whole.replace(/\./gu, "");
            const rest = all.slice(off + whole.length);
            return /^[ \u00a0]*(?:$|\p{Lu})/u.test(rest) ? `${body}.` : body;  // space, NBSP
        });

    // 5) ISBN, before every numeric rule — an identifier is read DIGIT BY DIGIT, not as a quantity. ×5, all
    //    of the shape `ISBN 978-84-8168-394-3.`, and each was reading as FOUR SEPARATE CARDINALS (*kɛmɛ
    //    kɔnɔntɔn ni biwolonwula ni segin, bisegin ni naani, …*) — a catalogue number spoken as
    //    arithmetic. ⚠ MUST PRECEDE THE RANGE RULE. RANGE's chain guard already rejects these, but claiming
    //    the identifier whole removes the question rather than resting it on one lookahead.
    s = s.replace(/(?<![\p{L}\p{M}])(ISBN(?:[- ]1[03])?)\s*:?\s*(\d[\d– -]*[\dXx])/gu,
        (_m, tag: string, body: string) => `${tag} ${[...body.replace(/[– -]/gu, "")].join(" ")}`);

    // 6) DIGIT DE-GROUPING, before every other numeric rule — a grouping mark is otherwise read as clause
    //    punctuation and the tail as a separate number (`1,200` → *kelẽ , kɛmɛ fila*; `114.983` → a
    //    SENTENCE BREAK). The Bambara wiki uses all three separators:
    //
    //        space  241 038 / 1 010 407 / 17 364      ×38   the dominant form
    //        dot    114.983 / 1.231.238 / 18.690.000  ×22
    //        comma  619,745 / 710,000,000 / 1,200     ×9
    //
    //    ⚠ EXACTLY THREE DIGITS PER GROUP is the whole discriminator, because BOTH marks are also this
    //    corpus's decimal separators — dot-decimal ×38 (`1.8 milion`, `50.5%`, `30.2 million`) and
    //    comma-decimal ×42 (`7,62`, `0,3`, `15,3`). Every `\d{1,3}[.,]\d{3}` instance in the dump was read
    //    back: all of them are groupings (`114.983(san 2009) jon yooro` is a population, `619,745 km²` an
    //    area, `1,200 million` a headcount) and NONE is a three-decimal quantity. The cost of the rule on
    //    this corpus is therefore zero, which is the number to state alongside the benefit.
    //
    //    ⚠ THE TRAILING GUARD EXCLUDES A FOLLOWING SEPARATOR+DIGIT, NOT A CLAUSE MARK. A plain `(?![\d.,])`
    //    refuses to de-group a number followed by its own sentence comma, which would split off the last
    //    group and speak it as zero.
    s = s.replace(/(?<![\d.,])(\d{1,3})((?:,\d{3})+)(?![\d]|,\d)/gu, (w) => w.replace(/,/gu, ""));
    s = s.replace(/(?<![\d.,])(\d{1,3})((?:\.\d{3})+)(?![\d]|\.\d)/gu, (w) => w.replace(/\./gu, ""));
    //    The SPACE form additionally has to reject a bare adjacency that is really two numbers in a list.
    //    Requiring every group to be exactly three digits does that: `san ba 2 fo 3` has no 3-digit group,
    //    and `tle 26 san 2008` is not `\d{1,3}( \d{3})+` because 2008 is four.
    s = s.replace(/(?<![\d.,])(\d{1,3})((?:[ \u00a0\u202f\u2009]\d{3})+)(?![\d]| \d)/gu, (w) => w.replace(/[ \u00a0\u202f\u2009]/gu, ""));  // space, NBSP, NNBSP, thin space

    // 7) UNITS, before decimals — the number-unit adjacency a unit rule matches on is destroyed the moment
    //    a decimal is rewritten into spaced digits (playbook step 4's standing coupling), and after
    //    de-grouping so `103 000 km2` and `17 364 km2` are already one token. The rewrite REORDERS, because
    //    Bambara puts the unit noun first; see UNITS for the sourcing, the `kɛnɛ` collocation and why no
    //    one-letter key is declared.
    //
    //    ⚠ CASE-INSENSITIVE, AND THAT IS MEASURED (trap 7). The corpus writes `13000 Km2 (bametri kene)`
    //    with a capital K — a case-sensitive class would have dropped exactly the instance the rule exists
    //    for, which is the Uzbek `16-Noyabr` failure in a different alphabet.
    //    ⚠ THE TRAILING GUARD IS `(?![\p{L}\p{M}\d])` AND THE LEADING ONE REJECTS A DOT. Without the first,
    //    `km` bites into a longer token; without the second, a dotted designation (`802.11m`) can start a
    //    match inside its fractional part — trap 28's lookbehind, which a lookahead alone cannot supply.
    //    This corpus contains ZERO dotted designations, so that half is robustness for plausible input
    //    rather than a measured repair; it matters that step 6 has spent every GROUPING dot but not the
    //    decimal one, so the character the guard inspects still exists at this point (trap 39).
    //    ⚠ THE OPERAND MUST INCLUDE ITS OWN DECIMAL TAIL, or the rule matches the FRACTIONAL part and cuts
    //    the number in half — the Lingala `0,44 km²` lesson, and this corpus offers `30.2 million km²`.
    //    ⚠ A SPAN TAKES ITS UNIT ONCE, IN FRONT. `5-10 cm` and `185–190 cm` are ONE measurement with two
    //    endpoints; without this arm the single-operand rule reaches the SECOND operand alone and strands
    //    the unit inside the span. It must run HERE rather than after step 8, because step 8 would already
    //    have spent the dash — and the corpus's own shape for a span is unit-once-in-front
    //    (`yaada 1–4 (mɛtɛrɛ 1–4)`).
    for (const [sym, word] of UNITS) {
        const key = sym.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
        s = s.replace(
            new RegExp(`(?<![\\d.,:\\p{L}\\p{M}-])(\\d+)\\s?[-–—]\\s?(\\d+)\\s?${key}(?![\\p{L}\\p{M}\\d])`, "giu"),
            (whole: string, a: string, b: string) => (Number(a) < Number(b) ? `${word} ${a} fo ${b}` : whole),
        );
        // ⚠ AND THE SINGLE-OPERAND ARM MUST REFUSE A SPAN'S SECOND HALF, which is the defect above stated
        // as a guard: a descending or chained span the arm just declined must reach RANGE whole, not with
        // its tail already rewritten.
        s = s.replace(
            new RegExp(
                `(?<![\\p{L}\\p{M}\\d.,])(?<!\\d\\s?[-–—]\\s?)(\\d+(?:[.,]\\d+)?)(\\s+(?:${MAG}))?\\s?${key}`
                + `(?![\\p{L}\\p{M}\\d])`,
                "giu",
            ),
            (_m: string, n: string, mag: string | undefined) => `${word} ${n}${mag ?? ""}`,
        );
    }
    // …and the ones with NO numeral at all — see BARE_UNITS. Last, so the counted arms above keep every
    // match they can make and only what they could not reach is left for this.
    s = BARE_UNITS(s);

    // 8) RANGES, before percent — a range OF percents must be claimed while both operands are still bare
    //    digits, since once step 9 has inserted `kɛmɛsarada` between them there is no pair left to match.
    //    After de-grouping, so a grouped endpoint is one token. See RANGE for the guards and for why
    //    non-ascending pairs are deliberately left alone.
    s = s.replace(RANGE, (whole, a: string, b: string) => (Number(a) < Number(b) ? `${a} fo ${b}` : whole));

    // 9) PERCENT — ×45, and the sourcing is the corpus glossing its own symbol, five separate sentences in
    //    four articles: `40% (binani kɛmɛsara)`, `90% (bikɔnɔtɔn kɛmɛ sarada)`, `40% (biinaani
    //    kɛmɛsarada)`, `Gambia jamanaden bikɔnɔtɔn kɛmɛsarada 90%`, and once with no sign at all —
    //    `Masuruyala, binani kɛmɛsarada jamana la ye Sahara cencen ye`. The number precedes the word in
    //    every one, which settles the POSITION as well as the word. `attest.ts` confirms it independently:
    //    4 token hits in 4 bm.wikipedia articles, 0 substring-only, every example a percentage.
    //    Spellings over the dump: `kɛmɛsarada` ×4, `kɛmɛ sarada` ×3, bare `kɛmɛsara` ×1 — take the
    //    plurality. It is transparently `kɛmɛ` (100, and the engine's own number word) + `sara`, i.e.
    //    composed from attested pieces rather than asserted, which is the Fula `e teemedere` shape.
    //    ⚠ THE SIGN IS DROPPED, NOT READ, WHEN THE WORD IS ALREADY THERE (trap 12). `bikɔnɔtɔn kɛmɛsarada
    //    90%` states the percentage twice; the guard looks left for the word, with an optional magnitude
    //    between, and emits the bare figure when it finds one.
    //    ⚠ ONE WORD MAY STAND BETWEEN THE FIGURE AND THE SIGN, and this arm is COUNTED rather than assumed
    //    (trap 9). `\d+ \p{L}+ ?%` matches 10 times in the dump against 35 bare, and all ten were read
    //    back: `A ka san bonya hakɛ ye 2,3 ye %`, `nɛgɛ hakɛ ye 52 ye %`, `ni nɛgɛ hakɛ bɛ se 69 ma %`,
    //    `Macron ye se sɔrɔ ni 66,1 ye %`, `a bɛ 50 Sɔrɔ % jamanadenw na`, `10 fo 15 dɔrɔn %`,
    //    `ka 0,3 dafa %`. The intervening token is always a copula/postposition (`ye`, `ma`) or a quantity
    //    adverb (`dɔrɔn` "only", `dafa` "full"), never an unrelated word — 10 true positives, 0 false. The
    //    gap is capped at ONE token for the same reason: a wider hop would let a `%` reach back past a
    //    quantity it does not belong to.
    //    ⚠ THE SIGN WAS ALSO A TOKEN BOUNDARY, SO THE REPLACEMENT HAS TO SUPPLY ONE. The corpus writes the
    //    percentage hard against the following word — `a 10%ye bagangena`, `ni 65% yɛ`, `Bambanan (28%)u lu`
    //    — and re-emitting the word alone welded it to that letter: `10%ye` read *tã kɛmɛsaradaje*, one
    //    token where the text has two. Trap 18/26 in a replacement rather than in a probe, and it applies to
    //    the redundant branch too, where the figure itself would otherwise fuse with the next word.
    const PCT_NAMED = new RegExp(`(?:kɛmɛ ?sarada?)(?:\\s+(?:${MAG}))?\\s*$`, "iu");
    s = s.replace(/(\d+(?:[.,]\d+)?(?:\s\p{L}+)?)\s?%/gu, (whole: string, n: string, off: number, all: string) => {
        const next = all[off + whole.length];
        const gap = next !== undefined && /[\p{L}\p{M}\p{Nd}]/u.test(next) ? " " : "";
        return PCT_NAMED.test(all.slice(0, off)) ? `${n}${gap}` : `${n} kɛmɛsarada${gap}`;
    });

    // 10) CURRENCY. `dolar` ×4 in the dump and ×4 in 4 bm.wikipedia articles, sense-checked and monetary in
    //     every one: `dolar wari 1.25`, `dolar wari US$ 1.25`, `dolar miliyar $4`, `dolar wari $56065245`.
    //     Unit-first, like every other measure noun in this layer and like the corpus's own word order.
    //     ⚠ ALL FOUR CORPUS INSTANCES ALREADY NAME THE CURRENCY, so trap 12 applies to every one of them
    //     and this rule fires on NONE of them — it exists so the class is readable at all (`$5` → *dolar
    //     5*), which is what separates a permissible drop from a swallowed sign. The guard looks left for
    //     `dolar`/`wari` with an optional magnitude between, because the corpus writes `dolar miliyar $4`
    //     with the magnitude in the way.
    //     ⚠ `US$` IS THE SAME CURRENCY NAMED TWICE. The code is left to be read as it was; only the sign is
    //     consumed, so a spoken "US" is not doubled by a spoken "dolar" that the text already supplied.
    //     ⚠ ONLY `$`. `€`, `£` and `¥` are ×0 in the entire wiki and no Bambara name for any of them is
    //     attested anywhere; declaring one would be invention of exactly the kind the Fula `tere` lesson
    //     forbids.
    const CUR_NAMED = new RegExp(`(?:dolar|dollars?|wari)(?:\\s+(?:${MAG}|wari))*\\s*$`, "iu");
    s = s.replace(/(?<![\p{L}\p{M}])(US\s?)?\$\s?(\d)/giu,
        (_m: string, us: string | undefined, d: string, off: number, all: string) =>
            // ⚠ THE CODE KEEPS ITS BOUNDARY. `US$` writes the code hard against the sign, so re-emitting the
            // capture verbatim welded it to whatever followed — `US$ 1.25` read *usdolar kelẽ fila duuru*,
            // one token where the text has two. Trap 18's shape in a replacement rather than a probe.
            `${us === undefined ? "" : "US "}${CUR_NAMED.test(all.slice(0, off)) ? "" : "dolar "}${d}`);

    // 11) DECIMALS, after every rule that needs the number intact. The separator becomes NOTHING and the
    //     fractional digits are spaced apart so the number path speaks them one at a time — see the header
    //     for why there is no point word to insert. What this fixes is the spurious CLAUSE BREAK and the
    //     mis-read tail: `7,62` was *wolõwula , biwɔɔrɔ ni fila* ("seven, sixty-two") and `1.8` was a full
    //     SENTENCE BOUNDARY mid-number.
    //     ⚠ THE TRAILING GUARD EXCLUDES A FURTHER SEPARATOR as well as a letter. Without the separator
    //     half, a dotted DATE (`2013.07.29`, which the mined artifact carries from a reference list) would
    //     have its first field claimed and its second left as a pause; without the letter half, a dotted
    //     designation (`802.11a`) would be. Both are the same one-character fix and both are cheap.
    s = s.replace(/(?<![\d.,])(\d+)[.,](\d+)(?![\d.,\p{L}\p{M}])/gu, (_m, int: string, frac: string) =>
        `${int} ${[...frac].join(" ")}`);

    // 12) THE AMPERSAND — ×6, and every instance is a bibliographic or corporate "and" between two names
    //     ("S&P Global Market Intelligence", "Faransi banki Rothschild & Cie"), i.e. foreign text inside
    //     Bambara prose. `ani` is the language's ordinary conjunction, ×962 in the corpus, so this needs no
    //     sourcing argument at all.
    //     ⚠ SPACED ON BOTH SIDES DELIBERATELY. `A&B` deletes to `AB`, which is ONE token instead of two —
    //     trap 18/26 — so the replacement must insert the boundary the sign was supplying.
    s = s.replace(/\s?&\s?/gu, " ani ");

    return s;
}
