/**
 * Estonian (et) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into Estonian words the existing pipeline speaks. Pure text→text, no IPA. Runs inside
 * `estonian.ts`'s `text()` BEFORE the shared symbol tier (`makeSymbolNormalizer`), so digits stay digits and
 * the tier can still see number–unit adjacency.
 *
 * ⚠ THE EVIDENCE IS ONE SOURCE, TWICE. There is no FLEURS corpus for Estonian on this machine; the evidence is
 * `tools/corpus/mined/et.jsonc` (1,931,621 paragraphs of the et.wikipedia dump, 464 retained = 264 hard + 200
 * sample) plus `attest.ts` against et.wikipedia — WHICH IS THE WIKI THE ARTIFACT WAS MINED FROM. That is a
 * bigger sample of ONE source and never an independent second tier. What IS independent is espeak-ng's
 * `dictsource/et_list` (380 lines: 32 letter names, the sign readings, ~90 dotted abbreviations) and this
 * repo's referee `et.wikipron-est-broad.tsv` — and the two agree on every letter name they both carry, which
 * is the one place in this file where two tiers cross-check each other.
 *
 * MEASURED OVER THE ARTIFACT. Two figures per class: the artifact's whole-corpus `counts` over 1.93M
 * paragraphs, and the count over the 464 RETAINED segments where a rule needed a context table.
 *
 *   whole corpus:  latin-in-native 1928605 · digit-run 1022415 · year 1019774 · initialism 320493 ·
 *                  ranges 247555 · abbrev 202955 · decimals 91561 · ordinal-latin 80907 · roman 73428 ·
 *                  quote-letter 76869 · clock 41091 · signs 41839 · units 38956 · grouped 31010 ·
 *                  ampersand 29871 · dotted 22956 · percent 22662 · signed-number 18727 · fractions 18278 ·
 *                  exponent 12405 · ordinal-range 9649 · arithmetic 8500 · rate 4207 · degrees 3973 ·
 *                  era-marker 1319 · sports-time 1107 · currency 564 · version-dot 360 · ordinal-caps 169
 *   retained 464:  `N.` ordinal 299 contexts · ranges 103 · decimal comma 91 · percent 90 · space-grouped 48 ·
 *                  `°` 33 · era marker 25 · minus 8 · fractions 8 · plus 7 · `=` 9 · ampersand 4
 *
 * WHAT THE ENGINE DID BEFORE, verbatim — the defect list this file is shaped by:
 *
 *   19. sajandil       → ˈyheksateist . sˈɑjɑndil    a CARDINAL and a spurious sentence PAUSE mid-sentence
 *   1913. aasta        → …kˈolmteist . ˈɑːstɑ         the same, ×299 in 464 segments
 *   74,2%              → …kˈɑks . kˈɑks               the decimal comma read as a PAUSE; % silent
 *   84 000 km²         → kɑheksɑ nˈelisɑdɑ … km       ONE number read as two, `km` raw, ² silent
 *   5–10°C             → vˈiːs kˈymːe                 the span joiner and the whole unit silent
 *   −15 °C             → vˈiːsteist                   ⚠ the sign INVERTS the reading and vanished
 *   322 eKr            → …ˈekr                        a vowel-less cluster where "enne Kristust" belongs
 *   SKP-st             → skpst                        an initialism read as one unpronounceable token
 *   nr 665             → ˈnr kˈuːs…                   a raw ⟨nr⟩ in the phoneme stream
 *   Smith & Wesson     → smit vˈesːon                 & silent, the two names run together
 *   200 kuupmeetrit    → …                            (correct already — the corpus SPELLS this one out)
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────────────
 * ⚠ FINNISH IS THE CLOSEST TREATED SIBLING AND IT IS A HYPOTHESIS, NOT A TEMPLATE (trap 55). Every one of
 * its answers was re-measured against Estonian's own artifact, and five of them come out DIFFERENT:
 *
 *   fi's answer                              | et's answer, on et's corpus
 *   -----------------------------------------|-----------------------------------------------------------
 *   `N.` ordinal: claim before a month or    | claim only before a WHITELISTED head noun, and INFLECT the
 *   any lowercase word; emit the NOMINATIVE  | ordinal to that noun's case — see the next block. Emitting
 *                                            | fi's nominative into `19. sajandil` gives *üheksateistkümnes
 *                                            | sajandil*, which is ungrammatical in Estonian.
 *   RANGES REFUSED — no free joiner word     | CLAIMED. `kuni` is an INFIX in this corpus, three times,
 *   exists, the elative–illative pair is     | between two BARE nominative operands (see RANGE below).
 *   the only reading                         | Finnish genuinely lacks this; Estonian genuinely has it.
 *   the inflectional joint is the COLON      | it is the HYPHEN (`SKP-st`, `USA-sse`, `6000-ni`). Not one
 *   (`YK:n`, `33:s`), never spaced           | colon-joint exists in this corpus; every `N:NN` is a sports
 *                                            | time or a ratio.
 *   `°C` → *astetta*, one word, no scale     | `°C` → *kraadi*, same shape, DIFFERENT WORD — and reached
 *                                            | from et's own corpus (*alla –18 kraadi*), not from fi.
 *   a bare-colon clock rule would fix 3 and  | a bare-colon clock rule would fix 2 and break 10 — the
 *   break 2, so `kello` gates it             | ratio `17:15`, the vote `59,7:40,3` and eight sports times.
 *                                            | Estonian's `kell` marker is ×3, so the whole class is
 *                                            | refused rather than gated.
 *
 * What DID transfer is the procedure and two guards: no comma-grouping arm (measured separately below), and
 * the "keep the digits, insert one word" discipline in the decimal rule that preserves number–unit adjacency.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────────────
 * ⚠ THE BARE `N.` ORDINAL IS THIS LANGUAGE'S LARGEST RULE BY A FACTOR OF THREE, AND IT IS TRAP 4's SHAPE.
 * Counted over the 464 retained segments, `\d{1,4}\.` followed by whitespace and a token:
 *
 *     followed by a LOWERCASE word          299   ⚠ ORDINAL — `1913. aasta`, `19. sajandil`, `9. augustil`
 *     followed by a CAPITAL                  31   ⚠ SENTENCE ENDS — `…aastal 1964. See nägi ette…`
 *     segment-final                          26   ⚠ SENTENCE ENDS — `…Historical Method. New York 1946.`
 *     followed by a DIGIT                     5   a second date — `…9. augustil 1985. 12. detsembril 1985…`
 *     other (`(`, Cyrillic, `№`)              4
 *
 * **THE INVARIANT, STATED AND MEASURED: zero sentence-final pauses are lost.** The rule's lookahead requires
 * a head noun from `CASE_OF` — a closed, lowercase, corpus-derived list — so the 31 capital-followed and 26
 * segment-final periods are outside every pattern in this file by construction, and so are the 5 followed by
 * a digit. That is a stronger guard than fi's "any lowercase word", and it is stronger because it has to be:
 * Estonian needs the noun's IDENTITY, not merely its case, to inflect the ordinal.
 *
 * ⚠ AND THAT IS TRAP 14 ARRIVING AS A REASON TO CONVERT RATHER THAN TO DECLINE. An Estonian ordinal AGREES
 * IN CASE with its head noun, so `19. sajandil` is *üheksateistkümnendAL sajandil* and `1913. aasta` is
 * *tuhande üheksasaja kolmeteistkümnendA aasta*. A digit becomes words in the TOKENIZER, downstream of
 * everything here, so the only way to inflect is to convert the operand to WORDS inside this rule — which is
 * exactly the fix shape trap 14 prescribes, and it is why `ordinal()` below takes a case ENDING.
 *
 * ⚠ …IN EVERY CASE BUT FOUR, AND THE FOURTH-LARGEST ENDING HERE IS ONE OF THEM. Before the TERMINATIVE `-ni`,
 * the essive `-na`, the abessive `-ta` and the comitative `-ga`, an Estonian attribute does NOT agree — it
 * stands in the GENITIVE, so `19. sajandini` is *üheksateistkümnendA sajandini*, with the ending on the head
 * ONLY. This layer shipped `üheksateistkümnendaNI sajandini` for seven corpus contexts and nine ordinals
 * before review, and the shape is trap 56's: a confidently wrong rule stated in the header, pinned by a test,
 * and producing perfectly well-formed Estonian words in the wrong case. See `GENITIVE_ATTRIBUTE` for the
 * probe that separates the two readings — and for why the token counts alone would have confirmed the bug.
 *
 * ⚠ THE COMPOSITION IS ATTESTED DEFINITIONALLY, WHICH IS THE STRONGEST KIND OF SOURCE AND THE KIND A WRITTEN
 * CORPUS ALMOST NEVER YIELDS. et.wikipedia's article on writing numerals states the rule and the reading in
 * one sentence, contrasting the two orders:
 *
 *     *"…üheksasada kakskümmend neli. 'aastal 1924', vrd See juhtus TUHANDE ÜHEKSASAJA KAHEKÜMNE NELJANDAL
 *     AASTAL. '1924. aastal'"*
 *
 * — i.e. `1924. aastal` is read *tuhande üheksasaja kahekümne neljandal aastal*: every component but the LAST
 * in the GENITIVE cardinal, the last as an ORDINAL in the head noun's case. `ordinal()` composes exactly that,
 * and the round trip `ordinal(1924, "l")` reproduces the citation verbatim (pinned in the tests).
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────────────
 * SOURCING. Every word below is a token somebody else wrote; where two tiers disagree the disagreement is
 * recorded rather than resolved silently.
 *
 *   espeak-ng `dictsource/et_list` (380 lines — an INDEPENDENT tier, not derived from et.wikipedia)
 *       the 32 LETTER NAMES (`a aa:` … `ž Zee:`); `_dpt komA1` (the decimal separator); `% prots'ent:i`
 *       and `_% prots'ent:` (percent, both forms); `$ tol:larit` / `_$ tol:lar`, `€ eurot` / `_€ euro`,
 *       `£ nae:la`; `+ plus:`; `(e kr) 'enne||kr'is:tust`, `(p kr) p'&rA1st||kr'istust`,
 *       `(e . m . a) 'enne||m,eije||,ajA1||'ar:vamist`, `(m . a . j) m,eije||'ajA1||'arvam,ise||j'&rgi`;
 *       and the dotted abbreviations `nt n'&iteks`, `nr n'ummber`, `sh s'eal||h,ulgas`, `jm j,a:||m'uu:d`,
 *       `jms j,a:||m'uu:||s'elline`, `jmt j,a:||m'uu:d||t'eised`, `jt j,a:||t'eised`, `vt v'aa:ta`,
 *       `ptk p,ea||t'yk:`, `tlk t'8l^kinud`, `nn n'ii:||n'imet,atud`, `cm s'enti||m,e:trit`,
 *       `kg k,ilO1gr'amm`, `ha h'ek:tarit`, `USA $abbrev $allcaps`.
 *   referee (tools/referee-eval/referees/et.wikipron-est-broad.tsv — Wiktionary-scraped, human, 2,773)
 *       SEVEN letter names with their IPA, and all seven match espeak's spelling exactly:
 *       B `b̥ eː` = bee · C `t s eː` = tsee · T `t eːː` = tee · V `v eːː` = vee ·
 *       W `k ɑ k s i s v eːː` = kaksisvee · X `i k sː` = iks · Y `i ɡ r e k` = igrek.
 *       Plus `WC v eː t s eː` — the referee's own SPELLED reading of an initialism, and the single referee
 *       token this layer touches at all (see the ordering note below; the SCORE does not move).
 *       Plus the ordinals `esimene`, `teine`, `kolmas` as lemmas.
 *   corpus (tools/corpus/mined/et.jsonc, token-matched by corpus-words.ts)
 *       kilomeetrit ×3 · meetrit ×2 · kilogrammi ×1 · kuupmeetrit ×1 · dollarit ×4 · protsenti ×1 ·
 *       kraadi ×3 · ja ×497 · aastal ×86 · sajandil ×14 · kuni ×3 as an INFIX (see RANGE)
 *   et.wikipedia (attest.ts, cached in tools/corpus/attest/et.jsonc — the WEAKER tier, senses READ)
 *       the ORDINAL SERIES in the adessive, every one in the ordinal slot and every sense read:
 *         esimesel · teisel · kolmandal · neljandal · viiendal · kuuendal · seitsmendal ×6/6
 *         (*nädala seitsmendal päeval*) · kaheksandal (*kaheksandal põhjalaiuskraadil*) · üheksandal ·
 *         kümnendal (*Esimest korda on Elejat mainitud kümnendal sajandil*) · üheteistkümnendal ×6/6
 *         (*tee üheteistkümnendal kilomeetril*) · kahekümnendal (*kahekümnendal sajandil*) ·
 *         sajandal (*sajandal sünniaastapäeval*)
 *       the GENITIVE-CARDINAL heads: `tuhande üheksasaja` ×1/1 (the definitional citation above),
 *         `kahe tuhande` ×4/4 (*kahe tuhande aastani*), `kahekümne teisel` ×3/3 (*kahekümne teisel
 *         kilomeetril*) — which attests the tens+unit branch, where only the UNIT inflects
 *       `üheksateistkümnendal sajandil` ×2/2 · `kahekümnendal sajandil` ×1/1
 *       miinus ×43/18 — and the first hit GLOSSES ITSELF: *"Miinus Seitse (ka -7)"*, a vocal ensemble
 *         whose name is written both ways in one sentence; *"alustas hooaega miinus 2 punktiga"*,
 *         *"Miinus 192 meetrit"* (a film title, a depth). The SIGN's reading, three independent frames.
 *       pluss ×77/18 — DEFINITIONAL: *"Pluss ehk plussmärk (+) on märk, mida kasutatakse eeskätt
 *         matemaatikas"*. ⚠ Trap 37 is present and was read past: *Tervis Pluss*, *Mobilitas Pluss* are
 *         proper nouns. The definition is the attestation; the proper nouns are not.
 *       kraadi ×67/20 · protsenti ×76/20 · eurot ×93/12 · naela ×103/20 · hektarit ×101/20 ·
 *         kilomeetrit ×99/19 · sentimeetrit ×35/19 · millimeetrit ×35/20 ·
 *         ruutkilomeetrit ×27/19 (*Ülemjärv – 82 097 ruutkilomeetrit*) · ruutmeetrit ×37/18 ·
 *         kuupmeetrit ×48/18 · kolmandikku ×22/20 (*hõlmates kaks kolmandikku Suurbritannia saare
 *         lõunaosast*) · kuni ×47/20
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────────────
 * ⚠ WHAT IS DELIBERATELY NOT DONE, each with the count and the check that refused it.
 *
 *   · NO CLOCK, AND THIS IS THE `ilo`-vs-`ceb` SHAPE (trap 55) MEASURED ON ESTONIAN. `clock` ×41,091
 *     whole-corpus, and `\d{1,2}:\d{2}` is ×12 in the retained text. Reading all twelve: EIGHT are SPORTS
 *     TIMES (`ajaga 3:41.24`, `maailmarekordi 2:35.16`, `2:35.15`, `2:34.47`, `4x200 m vabaujumises
 *     (7:23.50)`, a track length `– 6:57`), ONE is a parliamentary VOTE RATIO (`häältega 17:15 umbusaldust`),
 *     ONE is a referendum ratio written with decimal commas (`tulemusega (59,7:40,3)`), and TWO are
 *     H:M:S DURATIONS (`Kestus: 00:21:46`) — against exactly TWO genuine times of day, and both of those
 *     carry the marker word `kell` in front (`kell 00:58:53`, `(kell 7:58:53 kohaliku aja järgi)`). A
 *     bare-colon rule would fix 2 and break 10. Gating on `kell` the way fi gates on `kello` would fix
 *     those 2 — and both are H:M:S, a third field no clock reading in this tree handles, so it would need
 *     a seconds arm written for two instances of one sentence. The colon keeps the pause it already was.
 *   · NO FRACTIONS (`fractions` ×18,278 whole-corpus; 8 in the retained text), and the word is NOT the gap
 *     — `kolmandikku` is attested ×22/20 in exactly the slot (*hõlmates kaks kolmandikku Suurbritannia
 *     saare lõunaosast*), and the denominator series composes mechanically off `ordinal()`'s genitive stem
 *     (*kolmanda* → *kolmandik*). What stops it is the SHAPE. The eight are `2/3` ×4, `1/5` ×1 and the
 *     TIME SIGNATURES `3/8`, `5/8`, `10/8`; the same paragraph also writes `$1/$2` (poker blinds),
 *     `1750/1500` (a date range) and `100 Mb/s`, and nothing in the string separates a fraction from a
 *     ratio or a rate. Estonian reads a time signature with the same words as a fraction, so those three
 *     are not the objection — the objection is that admitting `\d/\d` admits the other three too, for five
 *     true positives. Left where they are, and the word is recorded here so it is not re-sourced.
 *   · NO RATE, so no `unitPer` (trap 47's first reason). Estonian does not say "A per B": the denominator
 *     goes into the INESSIVE with no preposition (*kilomeetrit tunnis*, *meetrit sekundis*), and `unitPer`
 *     is one invariant string. Nothing in this corpus would reach a `km/h` key anyway — the rate shapes
 *     are `1000 $/kg`, `10 $/kg`, `3–8 kcal/mol`, `100 Mb/s` and `187,1 in/km²`, where `in` is ENGLISH
 *     (*inhabitants*). `mine.ts scan` keeps reporting `LEAK RAW-LATIN kg ×2` and `km ×6` for exactly those,
 *     which is the `si` line of trap 54: the key is declared and the SHAPE is what fails.
 *   · NO DOTTED DATE. `\d{1,2}\.\d{1,2}\.\d{2,4}` is ×4 and only two are Estonian dates (`6.09.1986`,
 *     `12.10.2014`); the others are `Diogenes Laertios 5.1.10.` and a German programme note
 *     (`vom 21.-27.5.1975`). Step 5's guards already decline all four, and two instances do not buy a rule
 *     that has to tell a date from a classical citation.
 *   · NO BARE EXPONENT. `x³` and `sp³-hübridiseeritud` are this corpus's only powers on a non-unit base,
 *     both inside one chemistry paragraph. The PREDICATE form (*kuubis*, *astmes*) is a different word from
 *     the unit modifier *kuup-* and is attested in no source available here, so `bareExponent` stays
 *     undeclared and `DROP exponent ×5` stays red. The unit exponent IS claimed — `km²` reads
 *     *ruutkilomeetrit* — so the refusal is of the whole match, never half of it (trap 53).
 *   · NO SCALE NAME. `sources.ts` reports `[NONE] scale-names`, and the corpus agrees: neither *Celsiuse*
 *     nor *Fahrenheiti* occurs anywhere. See step 9 — the degree word is read WITHOUT a scale because that
 *     is what this corpus's own spelled-out temperatures do.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────────────
 * ⚠ WHAT THIS LAYER COSTS, MEASURED RATHER THAN OMITTED. Four readings got WORSE or stayed wrong, each
 * found by reading the corpus diff rather than by a probe, and each priced against what it replaced:
 *
 *   · `$110m` → *sada kümme DOLLARITM*, one malformed token. ⚠ THIS IS A SHARED-TIER DEFECT, NOT A LOCAL
 *     ONE, and it is REPORTED rather than fixed because `src/core` is the reviewer's call. The currency arm
 *     of `core/normalizeSymbols.ts` has no right-hand letter guard, so the noun fuses to a trailing
 *     magnitude letter. Reproduced unchanged in every sibling that declares `currency`: fi
 *     *dolːɑriɑm*, de *dˈɔlaɐ̯m*, es *dˈolaɾesm*. English escapes it only because it has a magnitude rule
 *     for `m`. ×1 here, in an English BBC headline this wiki cites; before, the `m` was read alone.
 *   · `10,1 m` → *kümme koma üks MEETER*, the nominative, because the decimal rule leaves the fraction's
 *     last digit adjacent to the unit and the tier counts on it. Inherent to the "keep the digits, insert
 *     one word" discipline that preserves unit adjacency at all, and it misfires only when the last
 *     fractional digit is exactly 1: ×1 in the retained text against 6 correct partitives after a decimal.
 *   · `€2,400` → *2 eurot koma 4 0 0*. The measured cost of having no comma-grouping arm (step 1). ×2, and
 *     both are English-convention figures inside one poker-tournament paragraph (`€2,400`, `R$5,000`);
 *     every Estonian `\d,\d{3}` in this corpus is a real three-place decimal.
 *   · `1 m. o.` → *üks meeter . o .*, ×2. An NMR chemical-shift abbreviation (*miljondikosa*, i.e. ppm) in
 *     one organic-chemistry paragraph, colliding with the tier's one-letter `m` key. See estonian.ts.
 *
 * ⚠ AND ONE CLASS IS UNREACHABLE FROM HERE, WHICH IS A FINDING ABOUT THE REGISTRY SEAM RATHER THAN ABOUT
 * ESTONIAN. `Vittorio Emmanuele III-st` and `Borís I-ks` are REGNAL numbers with a case suffix, and Estonian
 * reads them as ORDINALS — *kolmandast*, *esimeseks*. By the time this file runs they are `3-st` and `1-ks`,
 * because `normalizeRomans` wraps `engine.text()` at the registry's dispatch point and Estonian is not in
 * `ROMAN_NATIVE`. The roman spelling was the only evidence that told a regnal ordinal from a cardinal, and
 * the pass above spent it — the same shape as de-grouping destroying the grouping that told a year from a
 * quantity. Step 6 therefore refuses `-st`/`-ks` and `mine.ts scan` keeps reporting `LEAK RAW-LATIN ks ×2`
 * and `st ×1`. Closing it needs a change at the seam, not here.
 *
 * ⚠ NOT SOURCED, THEREFORE NOT SHIPPED, AND THE GATE STAYS RED FOR IT: `lk` ×2 (*lk 137–151*, *lk 63–64*).
 * `lehekülg` is attested ×33/19 and is the right noun, but every corpus instance is a page RANGE and the
 * expansion would have to be a plural or an adessive (*leheküljed*, *leheküljel*) whose NUMBER cannot be
 * recovered from the abbreviation — fi's `ns.` argument, in Estonian. `mine.ts scan` keeps reporting
 * `LEAK RAW-LATIN lk ×2` and that red line names a real gap. Same for `jpt` ×1 (*ja paljud teised*) and
 * `vkj` ×1 (*vana kalendri järgi*): neither is in espeak's list and neither is attested as a spelled-out
 * phrase, so both keep their raw letters rather than getting a plausible guess.
 */

import { makeInitialismNormalizer, makeUnreadableTest } from "../../core/initialisms.ts";

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// NUMERAL MORPHOLOGY — the genitive cardinal and the ordinal, which is what every date and year rule needs
// ─────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * The GENITIVE of the cardinals 0–9. These are the forms every leading component of a compound numeral takes:
 * `1924.` is *TUHANDE ÜHEKSASAJA KAHEKÜMNE neljandal*, three genitives and one ordinal.
 *
 * ⚠ 8 AND 9 ARE THEIR OWN GENITIVES (*kaheksa*, *üheksa*) and 7 is suppletive-looking (*seitse* → *seitsme*).
 * Both facts are visible in the engine's own cardinal table (`estonian.jsonc`) once you know to look, and
 * both are confirmed by the attested ordinals built on them — *seitsmendal*, *kaheksandal*, *üheksandal*.
 */
const GEN_UNIT: readonly string[] = [
    "nulli", "ühe", "kahe", "kolme", "nelja", "viie", "kuue", "seitsme", "kaheksa", "üheksa",
];

/** The NOMINATIVE ordinals 1–9. `esimene` and `teine` are suppletive; 3–9 are the regular `-s` series, and
 *  `esimene`/`teine`/`kolmas` are all three referee lemmas. */
const ORD_NOM_UNIT: readonly string[] = [
    "", "esimene", "teine", "kolmas", "neljas", "viies", "kuues", "seitsmes", "kaheksas", "üheksas",
];

/**
 * The GENITIVE STEM of the ordinals 1–9 — the form every oblique case is built on, by APPENDING the case
 * ending with no further change (*kolmanda* → *kolmandaL*, *kolmandaST*, *kolmandaKS*, *kolmandaNI*). That
 * regularity is what makes `CASE_OF` below a table of endings rather than a table of forms.
 *
 * ⚠ `esimese` AND `teise` ARE THE TWO IRREGULAR STEMS, and they are irregular in the PLURAL in a way this
 * file cannot compose — the plural of *teine* is *teiste*, not *teise+te*. The plural endings are therefore
 * refused for a numeral whose last component is 1 or 2 (see `ordinal`), which costs nothing measurable: every
 * plural instance in this corpus is a DECADE (`1920. aastatel`, `1860.–1930. aastatel`) and a decade's last
 * component is always a TENS ordinal.
 */
const ORD_STEM_UNIT: readonly string[] = [
    "", "esimese", "teise", "kolmanda", "neljanda", "viienda", "kuuenda", "seitsmenda", "kaheksanda",
    "üheksanda",
];

/** The magnitude formants. The ordinal is the `-s` form; its stem is the `-nda` form, exactly as for the
 *  units — *kümnes* / *kümnenda*, *sajas* / *sajanda*, *tuhandes* / *tuhandenda*. `kümnendal`, `kahekümnendal`
 *  and `sajandal` are all attested on the wiki in the ordinal slot. */
const TEN_NOM = "kümnes", TEN_STEM = "kümnenda", TEN_GEN = "kümne";
const TEEN_NOM = "teistkümnes", TEEN_STEM = "teistkümnenda", TEEN_GEN = "teistkümne";
const HUN_NOM = "sajas", HUN_STEM = "sajanda", HUN_GEN = "saja";
const THO_NOM = "tuhandes", THO_STEM = "tuhandenda", THO_GEN = "tuhande";

/**
 * The GENITIVE CARDINAL of 1…9999 — what every component of a compound numeral takes except the last.
 * `1924` → *tuhande üheksasaja kahekümne nelja*; the caller only ever uses the head of that, because the
 * final component is replaced by an ordinal.
 */
function genCardinal(n: number): string {
    if (n < 10) return GEN_UNIT[n]!;
    if (n === 10) return TEN_GEN;
    if (n < 20) return `${GEN_UNIT[n - 10]!}${TEEN_GEN}`;
    if (n < 100) {
        const t = Math.floor(n / 10), u = n % 10;
        return u === 0 ? `${GEN_UNIT[t]!}${TEN_GEN}` : `${GEN_UNIT[t]!}${TEN_GEN} ${GEN_UNIT[u]!}`;
    }
    if (n < 1000) {
        const h = Math.floor(n / 100), r = n % 100;
        const head = `${h === 1 ? "" : GEN_UNIT[h]!}${HUN_GEN}`;
        return r === 0 ? head : `${head} ${genCardinal(r)}`;
    }
    const th = Math.floor(n / 1000), r = n % 1000;
    const head = `${th === 1 ? "" : `${genCardinal(th)} `}${THO_GEN}`;
    return r === 0 ? head : `${head} ${genCardinal(r)}`;
}

/** The PLURAL endings, kept apart because they attach to the ordinal stem with a `t` the singular lacks
 *  (*kahekümnendaTEL*, not *kahekümnendaL*) and because 1 and 2 are irregular in the plural. `il` is the
 *  short plural adessive the corpus also writes (`1860.–1930. aastail`), and it takes no `t`. */
const PLURAL_ENDINGS: ReadonlySet<string> = new Set(["te", "tel", "test", "il"]);

/**
 * THE ESTONIAN ORDINAL for 1…9999 in a given CASE, or `undefined` outside that range — an unclaimable number
 * keeps its digits and its period rather than getting a guessed ending.
 *
 * `ending` is the case marker appended to the ordinal's genitive stem: `""` is the genitive itself, `"l"` the
 * adessive, `"ni"` the terminative, and so on; `NOMINATIVE` selects the `-s`/`-ne` form instead.
 *
 * ⚠ FIVE BRANCHES, PINNED SEPARATELY IN THE TESTS (trap 13): the sub-ten table, the teens, the tens (with and
 * without a unit — and with a unit ONLY the unit inflects), the hundreds, and the thousands. The corpus
 * exercises the first four heavily through years and centuries but never reaches a bare hundreds ordinal, so
 * that branch is pinned on a case the corpus does NOT contain. And the ladder 1/2/3/9/10/11/19/20/22/100/126/
 * 1000/1913/1924/2000/2011 is pinned as a ladder, because trap 56's worst instance was a silent 10× error at a
 * branch boundary that produced perfectly well-formed words.
 */
export const NOMINATIVE = " nom"; // a sentinel that can never be a case ending

export function ordinal(n: number, ending: string): string | undefined {
    if (!Number.isInteger(n) || n < 1 || n > 9999) return undefined;
    const nom = ending === NOMINATIVE;
    const plural = PLURAL_ENDINGS.has(ending);
    // The last component decides the form, and `esimene`/`teine` have no composable plural (see ORD_STEM_UNIT).
    if (plural && (n % 100 === 1 || n % 100 === 2)) return undefined;
    const put = (nomForm: string, stem: string): string => (nom ? nomForm : `${stem}${ending}`);

    if (n < 10) return put(ORD_NOM_UNIT[n]!, ORD_STEM_UNIT[n]!);
    if (n === 10) return put(TEN_NOM, TEN_STEM);
    if (n < 20) return put(`${GEN_UNIT[n - 10]!}${TEEN_NOM}`, `${GEN_UNIT[n - 10]!}${TEEN_STEM}`);
    // ⚠ THE RECURSION MUST PROPAGATE `undefined`, NEVER INTERPOLATE IT. A non-null assertion here produced
    // `1921. aastatel` → *tuhande üheksasaja kahekümne UNDEFINED*, because the plural refusal above fires on
    // the LAST component and the tens branch reaches it through recursion. That is trap 56's worst shape —
    // every other word in the string is well-formed Estonian, so no leak class, no DROP and no referee could
    // have seen it. Pinned in the tests at each of the three composing branches.
    const compose = (head: string, rest: number): string | undefined => {
        const tail = ordinal(rest, ending);
        return tail === undefined ? undefined : `${head} ${tail}`;
    };
    if (n < 100) {
        const t = Math.floor(n / 10), u = n % 10;
        // ⚠ ONLY THE LAST COMPONENT INFLECTS: 22nd is *kahekümne TEISEL*, never *kahekümnendal teisel*.
        // Attested on the wiki ×3/3 as `kahekümne teisel` (*tee kahekümne teisel kilomeetril*).
        if (u !== 0) return compose(`${GEN_UNIT[t]!}${TEN_GEN}`, u);
        return put(`${GEN_UNIT[t]!}${TEN_NOM}`, `${GEN_UNIT[t]!}${TEN_STEM}`);
    }
    if (n < 1000) {
        const h = Math.floor(n / 100), r = n % 100;
        const g = h === 1 ? "" : GEN_UNIT[h]!;
        if (r !== 0) return compose(`${g}${HUN_GEN}`, r);
        return put(`${g}${HUN_NOM}`, `${g}${HUN_STEM}`);
    }
    const th = Math.floor(n / 1000), r = n % 1000;
    const g = th === 1 ? "" : `${genCardinal(th)} `;
    if (r !== 0) return compose(`${g}${THO_GEN}`, r);
    return put(`${g}${THO_NOM}`, `${g}${THO_STEM}`);
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// THE HEAD-NOUN CASE TABLE — what makes the ordinal rule decidable at all
// ─────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * The head nouns an Estonian `N.` ordinal modifies in this corpus, by their GENITIVE STEM, longest first.
 * A head word is recognised when it is one of these stems plus one of `NOUN_ENDINGS`, and the ordinal then
 * takes THE SAME ending. That is the whole rule: `sajandi`+`l` → the ordinal takes `l`; `aasta`+`tel` → `tel`.
 *
 * ⚠ THE LIST IS EXACTLY WHAT THE 299 CONTEXTS CONTAIN (trap 9 — widen a guard only for a shape you have
 * counted). It covers 292 of the 299; the residue is 5× `ja` and 1× `või` (a coordination, claimed by its own
 * rule below) and 1× a bare `a`. Nothing else is claimed, and an unrecognised head noun leaves the figure and
 * its period exactly as they were.
 *
 * ⚠ MONTHS APPEAR TWICE, AS A GENITIVE STEM AND AS A NOMINATIVE, and the nominative list is consulted FIRST
 * because `mai`, `juuni` and `juuli` are spelt identically in both. `4. mai` in a date list is the nominative
 * *neljas mai*; `9. augustil` is the adessive *üheksandal augustil*.
 */
const NOUN_STEMS: readonly string[] = [
    // The two that carry 143 of the 299 between them.
    "aastatuhande", "sünniaastapäeva", "eluaasta", "aasta", "sajandi", "koha", "järgu",
    // Month genitive stems (nominative + i, except the three that already end in one).
    "jaanuari", "veebruari", "märtsi", "aprilli", "mai", "juuni", "juuli", "augusti", "septembri",
    "oktoobri", "novembri", "detsembri",
];

/**
 * The case endings a HEAD NOUN is recognised with. Only the ten the corpus writes: genitive `""` ×~60,
 * adessive `l` ×~150, elative `st` ×13, terminative `ni` ×7, translative `ks` ×3, partitive `t` ×3, plural
 * adessive `tel` ×7 / `il` ×2, plural genitive `te` ×1, plural elative `test` ×1.
 *
 * ⚠ THIS IS NOT ALSO THE LIST OF ENDINGS THE ORDINAL IS GIVEN, AND CONFLATING THE TWO WAS A DEFECT. Nine of
 * the ten agree; the terminative `ni` does NOT — see `GENITIVE_ATTRIBUTE` immediately below, and `caseOf`,
 * which is where the head's ending is translated into the attribute's.
 *
 * ⚠ THE ALLATIVE `le`, THE INESSIVE `s`, THE ILLATIVE `sse` AND THE COMITATIVE `ga` ARE DELIBERATELY ABSENT.
 * They are ordinary Estonian cases and they would compose correctly, but they are ×0 here — and admitting an
 * ending the corpus never writes after a `N.` widens the head-noun matcher for no measured gain, which is
 * trap 9 in the direction that is easy to talk yourself into.
 */
const NOUN_ENDINGS: ReadonlySet<string> = new Set(["", "l", "st", "ks", "t", "ni", "te", "tel", "test", "il"]);

/**
 * ⚠ THE FOUR CASES WHERE THE ATTRIBUTE DOES **NOT** AGREE, AND `ni` IS THE ONE OF THEM THIS CORPUS WRITES.
 * Estonian's concord rule has a documented exception: before the TERMINATIVE `-ni`, the ESSIVE `-na`, the
 * ABESSIVE `-ta` and the COMITATIVE `-ga`, an attribute stands in the GENITIVE rather than repeating the
 * head's case. So `19. sajandini` is *üheksateistkümnendA sajandini*, never *üheksateistkümnendaNI sajandini*
 * — the ending is on the HEAD only, exactly once. (`na`/`ta`/`ga` are ×0 here and are absent from
 * `NOUN_ENDINGS` for that reason; they are listed here so the next ending admitted to that set arrives
 * already checked against this rule rather than inheriting the agreement by default.)
 *
 * ⚠ THE PROBE SEPARATES THE TWO READINGS AND IT IS THE EXACT FRAME. `attest.ts --lang et` (cached in
 * `tools/corpus/attest/et.jsonc`): `kolmanda sajandini` ×1/1 **attested** — *"…alates teisest sajandist eKr
 * kuni KOLMANDA SAJANDINI pKr."*, the same *kuni …-ni* span this rule feeds — against `kolmandani sajandini`
 * 0/0 and `üheksateistkümnenda sajandini` 0/0, both **absent**.
 *
 * ⚠ AND THE TRAP IS THAT `kolmandani` ITSELF IS ATTESTED — ×2/2, with `neljandani` ×1/1 and `kaheksandani`
 * ×3/3. Every one of the six examples is a HEADLESS substantivised ordinal, the right-hand operand of a span
 * with no noun after it at all (*"esimesest kolmandani"*, *"viiendast kaheksandani"*, *"järjestab
 * võistkonnad esimesest neljandani"*). The form exists; it is not an ATTRIBUTE. That is the Fula
 * `hakkunde` test run on a morphological form instead of a word, and it is why the token counts alone would
 * have confirmed the defect.
 *
 * Scope when this was wrong: 7 corpus contexts, 9 ordinals — `kuni 9. oktoobrini 1933`, `19. sajandini`,
 * `1868. aastani`, `3.–8. sajandini`, `15.–16. eluaastani`.
 */
const GENITIVE_ATTRIBUTE: ReadonlySet<string> = new Set(["ni", "na", "ta", "ga"]);

/** Head nouns that take the NOMINATIVE ordinal. Every one is counted in the 299; the months dominate
 *  (`24. oktoober`, `28. veebruar`, `4. mai` — the date-list style this wiki uses in `== Sündmused ==`). */
const NOUN_NOMINATIVE: ReadonlySet<string> = new Set([
    "jaanuar", "veebruar", "märts", "aprill", "mai", "juuni", "juuli", "august", "september", "oktoober",
    "november", "detsember", "sajand", "koht", "trükk", "ametlik", "valitsus",
]);

/**
 * The ordinal's case ending for a head word, or `undefined` if the word is not a recognised head noun.
 *
 * ⚠ THE ENDING RETURNED IS THE ATTRIBUTE'S, NOT THE HEAD'S, and for `GENITIVE_ATTRIBUTE` the two DIFFER.
 * The head is still recognised by its own ending — `sajandi`+`ni` is a head noun — but the ordinal it
 * governs is emitted in the genitive `""`. See `GENITIVE_ATTRIBUTE` for the concord exception and its probe.
 */
function caseOf(word: string): string | undefined {
    if (NOUN_NOMINATIVE.has(word)) return NOMINATIVE;
    for (const stem of NOUN_STEMS) {
        if (!word.startsWith(stem)) continue;
        const rest = word.slice(stem.length);
        if (NOUN_ENDINGS.has(rest)) return GENITIVE_ATTRIBUTE.has(rest) ? "" : rest;
    }
    return undefined;
}

/** The head-noun lookahead, as a source fragment: any of the stems or nominatives, then Estonian letters. It
 *  deliberately over-matches — `caseOf` is the real gate — because a regex alternation cannot express
 *  "stem plus one of ten endings" without listing 190 forms. */
const HEAD_WORD = "[a-zõäöüšž]+";

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// WORDS
// ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** The decimal separator's name. espeak's `_dpt komA1` declares it; `koma` is the ordinary Estonian noun and
 *  the corpus writes the SYMBOL 91 times without ever spelling it, which is the shape playbook §5e's Igbo
 *  lesson says to expect — a writer types `13,7` and never says how they would read it. */
const DECIMAL_WORD = "koma";

/**
 * The RANGE joiner, and the part-of-speech check that sank Fula's `hakkunde` PASSES HERE — which is why this
 * layer claims the class Finnish refuses.
 *
 * `kuni` is ×47/20 on the wiki, but every wiki hit is the PREPOSITION "until" taking ONE operand
 * (*kuni 1917. aastani*, *kuni aastani 154 eKr*). That alone would be the Fula trap exactly. The corpus is
 * what settles it: three of its own sentences use `kuni` as an INFIX between two operands, and one of them
 * is between two BARE NOMINATIVE numerals — the precise shape this rule emits:
 *
 *   · *"…millest igaüks kestab tavaliselt KAKS KUNI NELI nädalat"*   two → four weeks
 *   · *"Kaks kolmandikku KUNI neli viiendikku pindalast on kaetud mägedega"*
 *   · *"…−2,1 °C (Ransol) KUNI 1,1 °C (Les Escaldes)"*               a temperature span
 *   · and with the operands' own cases spelled: *"18. augustist KUNI 9. oktoobrini 1933"*
 *
 * ⚠ THE OPERANDS STAY NOMINATIVE AND THAT IS THE ATTESTED FORM, not a concession to trap 14. Estonian also
 * writes a span with the elative–terminative pair, and the first two citations show the language does not
 * require it: *kaks kuni neli nädalat* is what a bare-numeral span looks like.
 */
const RANGE_JOINER = "kuni";

/** The degree word. `kraadi` ×3 in the corpus and every one is in this exact slot — *"langeb temperatuur
 *  talvel alla –18 kraadi"*, *"võib õhutemperatuur langeda −26 kraadini"*, *"ulatub temperatuur +26 °C
 *  kraadini"*. ×67/20 on the wiki. See step 9 for why no SCALE name is emitted. */
const DEGREE_WORD = "kraadi";

/**
 * ERA MARKERS. `eKr` ×23 and `pKr` ×2 in the retained text, and the class is invisible to every leak gate —
 * ⟨eKr⟩ has a vowel, so it reaches the g2p as a pronounceable-looking token and comes out *ˈekr*. That is
 * trap 56's silent class, not a RAW-LATIN leak, and nothing in `mine.ts scan` reports it.
 *
 * Both phrases are espeak's, verbatim: `(e kr) 'enne||kr'is:tust`, `(p kr) p'&rA1st||kr'istust`. The two
 * dotted forms are espeak's too and are ×1 each here (`u 1750/1500–500 e.m.a`, `632 m.a.j.`).
 *
 * ⚠ `m.a.j.` MUST BE CONSUMED BEFORE THE SHARED UNIT TIER RUNS, because `m` is a declared one-letter unit key
 * and `632 m.a.j.` would otherwise read as *632 meetrit*. The tier's `NOT_VERSION` guard cannot help: it
 * rejects a dot INSIDE a number, not after a unit. This is trap 39 — a guard's evidence has a lifetime — met
 * from the other side, by spending the ambiguous string before the guardless rule can see it.
 */
const ERA: readonly (readonly [RegExp, string])[] = [
    [/(?<![\p{L}\p{M}])e\.\s?m\.\s?a\.?(?![\p{L}\p{M}])/gu, "enne meie aja arvamist"],
    [/(?<![\p{L}\p{M}])m\.\s?a\.\s?j\.?(?![\p{L}\p{M}])/gu, "meie aja arvamise järgi"],
    [/(?<![\p{L}\p{M}])eKr(?![\p{L}\p{M}])/gu, "enne Kristust"],
    [/(?<![\p{L}\p{M}])pKr(?![\p{L}\p{M}])/gu, "pärast Kristust"],
];

/**
 * DOTLESS ABBREVIATIONS, which is how this corpus writes them — `nt`, `nr`, `vt`, `jt` appear WITHOUT a
 * period in every one of their 24 instances, so a fi-style `\w+\.` pattern would have matched nothing at all.
 * The optional `\.?` is there for the dotted spelling Estonian style guides also allow.
 *
 * Every expansion is espeak's `et_list` entry, and the list is exactly the abbreviations this corpus contains.
 *
 * ⚠ `st` IS DELIBERATELY ABSENT, AND IT IS TRAP 2's SHAPE. espeak carries `st  s'ee:||t'&hendab` ("that is"),
 * and `mine.ts scan` reports `LEAK RAW-LATIN st ×2` — but reading both instances shows neither is the
 * abbreviation: they are `1,5% SKP-st` and `Vittorio Emmanuele III-st`, the ELATIVE case suffix on an
 * initialism and on a Roman numeral. Expanding them would read *"protsenti see tähendab"* mid-sentence.
 *
 * ⚠ `u` ("umbes", approximately) CARRIES A DIGIT LOOKAHEAD AND IT IS DOING REAL WORK. Four occurrences of a
 * free-standing `u` in the retained text: three are the abbreviation (`u 1750/1500–500 e.m.a`, `u 1230 Werna`,
 * `u. 4,8 km Béthune'ist`) and the fourth is the LETTER ITSELF, inside an alphabet listing —
 * *"koosneb 20 tähest: a b c d e g h i ĩ j k m n o r t U ũ w y"*. Only the following digit separates them.
 * `umbes` is ×11 in the corpus's own prose, so the expansion is the corpus's word, not a dictionary's.
 *
 * ⚠ `nr` EXPANDS TO A NOMINATIVE AND THAT IS A CHOICE WITH A COST. `nr 665` is *number 665*, correct; but
 * `1974, nr 1` is a bibliographic field where Estonian would say *numbris 1*. The nominative is what espeak
 * declares and what the shape supports; the inessive would need the sentence's syntax, which this layer
 * cannot see. Recorded rather than guessed.
 */
/**
 * ⚠ THE OPTIONAL DOT MAY NOT EAT A SENTENCE PERIOD, AND ESTONIAN IS A LANGUAGE WHERE THAT IS THE SAME DOT.
 * An abbreviation-final period at the end of a sentence is written ONCE and serves as both: *"…jms. Teise
 * maailmasõja ajal…"* is an abbreviation AND a sentence end. A bare `\.?` consumed it, and the expansion came
 * back as *"…ja muu selline Teise maailmasõja…"* — the clause boundary silently gone, which is the one
 * invariant this layer states in its header ("zero sentence-final pauses are lost"). ×1 in the retained text,
 * fixed because the invariant is the claim, not the count.
 *
 * So the dot is consumed only when it is NOT sentence-final: not before whitespace + a CAPITAL, and not at
 * the end of the input. When it is, the abbreviation still expands and the period stays where it was, so
 * `clausePunctuation` downstream still sees the break. `eKr`/`pKr` never had this bug — the `ERA` patterns
 * carry no `\.?` at all — and `e.m.a`/`m.a.j` are dotted THROUGHOUT, so their final dot is optional for the
 * same reason and is left as it was (both are ×1, mid-sentence).
 */
const ABBREV_DOT = String.raw`(?:\.(?!\s+\p{Lu}|\s*$))?`;
const abbrev = (form: string, phrase: string): readonly [RegExp, string] =>
    [new RegExp(String.raw`(?<![\p{L}\p{M}])${form}${ABBREV_DOT}(?![\p{L}\p{M}])`, "gu"), phrase] as const;

const ABBREV: readonly (readonly [RegExp, string])[] = [
    abbrev("jms", "ja muu selline"),
    abbrev("jmt", "ja muud teised"),
    abbrev("ptk", "peatükk"),
    abbrev("tlk", "tõlkinud"),
    abbrev("nt", "näiteks"),
    abbrev("nr", "number"),
    abbrev("nn", "nii nimetatud"),
    abbrev("sh", "sealhulgas"),
    abbrev("jm", "ja muud"),
    abbrev("jt", "ja teised"),
    abbrev("vt", "vaata"),
    // `u` is the one entry whose gate is a DIGIT lookahead rather than a word boundary (see above), and a
    // sentence cannot begin with the capital that `ABBREV_DOT` tests for, so it keeps its plain `\.?`.
    [/(?<![\p{L}\p{M}])u\.?(?=\s+\d)/gu, "umbes"],
];

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// THE PASS
// ─────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Is one of `needles` written as a WHOLE WORD within 45 characters of the span [start, end)? The trap-12
 * "don't say it twice" guard.
 *
 * ⚠ THREE THINGS THIS GETS RIGHT THAT THE LUGANDA REVIEW FOUND WRONG IN ITS FIRST DRAFT, and each cost a
 * reading there: the needle is matched with explicit letter lookarounds rather than as a bare SUBSTRING (so
 * `kraad` cannot fire inside *põhjalaiuskraadil*, a compound this corpus writes); the match is
 * CASE-INSENSITIVE (Estonian capitalises a sentence-initial noun, and the guard would otherwise double);
 * and the needle is a STEM plus `\p{L}*` rather than one inflected form, because the redundant word appears
 * in whatever case the sentence needs (*kraadi*, *kraadini*).
 */
function saidNear(full: string, start: number, end: number, ...needles: readonly string[]): boolean {
    const alt = needles.map((n) => `${n}\\p{L}*`).join("|");
    return new RegExp(`(?<![\\p{L}\\p{M}])(?:${alt})(?![\\p{L}\\p{M}])`, "iu")
        .test(clauseWindow(full, start, end));
}

/**
 * The ±45-character window of `saidNear`, TRUNCATED AT THE NEAREST CLAUSE BOUNDARY on each side.
 *
 * ⚠ A FLAT CHARACTER WINDOW CROSSES SENTENCES, AND THIS GUARD'S FAILURE MODE IS SILENT DELETION. `saidNear`
 * answers "was the word already said?", and when it answers yes the degree rule emits the FIGURE ALONE —
 * so a needle in the NEXT sentence deletes a unit from THIS one: *"Temperatuur oli 30 °C. Sellest sai kraadi
 * mõõdetud."* dropped the `°C` for a *kraadi* that belongs to a different clause. Nothing downstream can see
 * that: the reading is well-formed Estonian with one noun missing (trap 56's shape, the same one the
 * `undefined` interpolation had).
 *
 * All 33 `°` instances in the retained text are unaffected — no corpus sentence puts the word within 45
 * characters ACROSS a boundary — so this is latent rather than measured, and it is bounded anyway because
 * the bound is one `lastIndexOf`/`search` and the alternative is a class of defect no gate reports.
 *
 * ⚠ THE BOUNDARY SET IS `[.!?…]` AND THE DOTS IT CUTS ON ARE ALREADY SPENT. By step 9 the decimal comma has
 * become a word, the abbreviations and era markers are consumed, and every claimed `N.` ordinal has lost its
 * period — so a `.` still standing at this point is a sentence end or a citation, and cutting at either only
 * makes the guard MORE conservative about claiming a redundancy it cannot see.
 */
function clauseWindow(full: string, start: number, end: number): string {
    const left = full.slice(Math.max(0, start - 45), start);
    const right = full.slice(end, end + 45);
    const cut = left.search(/[.!?…][^.!?…]*$/u);
    const stop = right.search(/[.!?…]/u);
    return left.slice(cut === -1 ? 0 : cut + 1) + full.slice(start, end) + (stop === -1 ? right : right.slice(0, stop));
}

/**
 * Estonian text normalization. A numbered, ORDER-DEPENDENT sequence; each step states its coupling.
 *
 * ⚠ THERE IS NO ENTITY-FOLDING STEP, AND THAT IS A MEASUREMENT. The artifact carries `&nbsp;` ×74 — sitting
 * exactly between a grouped thousand and its unit (`84 000&nbsp;km²`, `29 743&nbsp;km²`) and between a figure
 * and its degree sign (`−7&nbsp;°C`), i.e. precisely where steps 1 and 9 have to see a plain space. But
 * `stripMarkup` (`src/core/markup.ts`) decodes every named entity at the registry's single dispatch point,
 * ABOVE this layer, and it deliberately decodes `&nbsp;` to an ASCII space rather than U+00A0 for this exact
 * reason. Verified by probing: `84 000&nbsp;km²` reaches this function as `84 000 km²`. A local copy would
 * have typechecked, run, and repaired nothing.
 */
export function normalizeEstonian(input: string): string {
    let t = input;

    // 1) SPACE-GROUPED THOUSANDS (31,010 whole-corpus; 48 in the retained text), FIRST — a space is a token
    //    boundary, so `84 000 km²` reached the number path as TWO numerals and `2 831 741` as three. It must
    //    precede every rule that reads a digit run, and it must precede the unit tier, whose key sits
    //    immediately after the last block.
    //    ⚠ EXACTLY THREE DIGITS PER BLOCK **AND A HEAD OF 1–3 DIGITS WITH A NON-ZERO LEAD**, so a digit LIST
    //    is never fused and a leading-zero run is never a grouped thousand.
    //    ⚠ THE HEAD CONSTRAINT WAS IN THIS COMMENT AND NOT IN THE REGEX, WHICH IS THE DEFECT SHAPE A COMMENT
    //    CAN HAVE. The pattern was `(\d)[ ](\d{3})(?!\d)` in a loop — one digit of head, any digit — so it
    //    fused ANY digit run against a following triple: `aastal 1985 200 inimest` became `1985200`, a year
    //    and a count read as one seven-digit number. Grouping only ever leaves 1–3 digits before the first
    //    joint, so anchoring the head is what the comment always claimed and what the shape actually is; all
    //    48 corpus matches are genuine groupings and the corpus diff over all 464 segments is unchanged by
    //    the tightening, so this closes a latent class at zero measured cost.
    //    ⚠ AND THE WHOLE RUN IS TAKEN IN ONE MATCH rather than one joint per pass, so the loop is gone with
    //    it: `28 150 000` has two joints and the old single-joint pattern needed a second pass to reach the
    //    second — which is also what let an anchored head be re-derived from an already-fused prefix.
    //    ⚠ AND THERE IS NO COMMA ARM, WHICH IS THE fi ANSWER REACHED ON et's OWN CORPUS (trap 55). Every
    //    `\d,\d{3}` in the retained text is a genuine three-place DECIMAL — `120,758 miljardit USA dollarit`
    //    is 120.758 billion — against two English-convention groupings quoted from a poker-tournament report
    //    (`€2,400`, `R$5,000`). A comma arm would corrupt the real decimals to fix two foreign figures.
    t = t.replace(/(?<![\d.,])([1-9]\d{0,2})((?:[ ]\d{3})+)(?!\d)/gu, (_m, head: string, rest: string) =>
        `${head}${rest.replace(/[ ]/gu, "")}`);

    // 2) ERA MARKERS (1,319 whole-corpus; 25 in the retained text), before the abbreviations for the usual
    //    reason and — critically — before the shared unit tier, so `632 m.a.j.` cannot read as 632 metres.
    //    See the ERA declaration for that coupling and for both espeak citations.
    for (const [re, phrase] of ERA) t = t.replace(re, phrase);

    // 3) DOTLESS ABBREVIATIONS (202,955 whole-corpus; 24 retained). AFTER the era markers and BEFORE the
    //    initialism pass, which runs on this function's output — otherwise nothing here is at risk from it,
    //    since every abbreviation is lowercase, but the ordering is the fleet's and is kept.
    for (const [re, word] of ABBREV) t = t.replace(re, word);

    // 4) THE ORDINAL COORDINATION AND THE ORDINAL RANGE, BEFORE the single `N.` rule (step 5) and before the
    //    general range rule (step 7). Both exist because their LEFT operand is not followed by a head noun,
    //    so the single rule would strand it as a cardinal with a spurious pause while reading the right one
    //    as an ordinal — a mixed reading, worse than either.
    //
    //    · COORDINATION `N. ja M. <noun>` (6: five `ja`, one `või`) — `7. ja 6. sajandil eKr`. Estonian
    //      inflects BOTH conjuncts to the head noun's case: *seitsmendal ja kuuendal sajandil*.
    //    · RANGE `N.–M. <noun>` (4) — `3.–8. sajandini`, `6.–5. sajandil`, `1920.–1940. aastatel`,
    //      `1860.–1930. aastatel`.
    //
    //    ⚠ THE RANGE'S CONNECTIVE IS REFUSED, AND THAT IS A NARROWER REFUSAL THAN IT LOOKS. Step 7 reads a
    //    plain numeric span with `kuni` on the strength of three corpus infixes between BARE NOMINATIVES.
    //    An ORDINAL span is a different frame: the corpus's own spelled-out instance is
    //    *"18. augustist kuni 9. oktoobrini"* — elative on the left, terminative on the right, i.e. the two
    //    operands take DIFFERENT cases, and this rule has only one head noun to read a case from. Emitting
    //    `kuni` between two same-case ordinals would be a frame the language does not use, so both ordinals
    //    are read and only the connective is dropped — which is fi's shipped answer for the same shape, and
    //    it is exactly what the dash already did.
    const ordCase = (word: string): string | undefined => caseOf(word);
    t = t.replace(
        new RegExp(`(?<![\\d.,:\\p{L}\\p{M}])(\\d{1,4})\\.\\s+(ja|või)\\s+(\\d{1,4})\\.(?=\\s+(${HEAD_WORD}))`, "gu"),
        (m, a: string, conj: string, b: string, head: string) => {
            const e = ordCase(head);
            if (e === undefined) return m;
            const x = ordinal(Number(a), e), y = ordinal(Number(b), e);
            return x !== undefined && y !== undefined ? `${x} ${conj} ${y}` : m;
        },
    );
    t = t.replace(
        new RegExp(`(?<![\\d.,:\\p{L}\\p{M}])(\\d{1,4})\\.\\s*[–—-]\\s*(\\d{1,4})\\.(?=\\s+(${HEAD_WORD}))`, "gu"),
        (m, a: string, b: string, head: string) => {
            const e = ordCase(head);
            if (e === undefined) return m;
            const x = ordinal(Number(a), e), y = ordinal(Number(b), e);
            return x !== undefined && y !== undefined ? `${x} ${y}` : m;
        },
    );

    // 5) THE BARE `N.` ORDINAL — 299 contexts in 464 segments, the largest rule in the file by a factor of
    //    three. See the header for the full context table, for the definitional wiki citation that fixes the
    //    composition, and for the measured invariant that ZERO sentence-final pauses are lost.
    //
    //    ⚠ THE LOOKAHEAD IS A HEAD NOUN, NOT "a lowercase word" (fi's guard), because Estonian needs the
    //    noun's IDENTITY to pick the case. That makes the rule strictly narrower than fi's and it is the
    //    reason the sentence-period invariant holds by construction rather than by measurement.
    //    ⚠ THE LEFT GUARD EXCLUDES A DIGIT, A DOT AND A COMMA, so a citation's inner field cannot start a
    //    match: `Diogenes Laertios 5.1.10.` is rejected at `5` (the next dot is followed by a digit) and at
    //    `1`/`10` (preceded by a dot) — trap 52, where a lookbehind rejects a POSITION and the engine simply
    //    starts later, so the operand is anchored on BOTH edges rather than only the left.
    t = t.replace(
        new RegExp(`(?<![\\d.,:\\p{L}\\p{M}])(\\d{1,4})\\.(?=\\s+(${HEAD_WORD}))`, "gu"),
        (m, n: string, head: string) => {
            const e = ordCase(head);
            return e === undefined ? m : ordinal(Number(n), e) ?? m;
        },
    );

    // 6) THE HYPHEN CASE SUFFIX ON DIGITS (5) — `6000-ni`, `6000-le`, `4-le`, `2-le`. Estonian's inflectional
    //    joint is the HYPHEN, not Finnish's colon, and unlike Finnish this one is fully resolvable for the two
    //    endings the corpus writes: an Estonian cardinal's oblique cases are built on its GENITIVE stem, which
    //    `genCardinal` already composes — `6000-ni` is *kuue tuhandeni*, `4-le` is *neljale*.
    //    ⚠ TRAP 14's FIX SHAPE, AND THE ONLY WAY IT CAN BE DONE: the suffix has to agree with the numeral's
    //    WORDS, which do not exist until this rule converts them, so the operand is worded here rather than
    //    left to the tokenizer. Gluing the written suffix to the digits instead would give *kuus tuhat ni*,
    //    with `ni` as its own bare token — which is what the engine produces today.
    //    ⚠ RESTRICTED TO `-le` AND `-ni` (trap 9). The other 16 digit-hyphen forms in this corpus are
    //    COMPOUNDS, not case suffixes — `63-aastaselt`, `15-aastaste`, `8-klassiline`, `60-protsendilise` —
    //    and chemical locants (`2,6-trimetüül`, `1-tsükloheksen`). Those read correctly as two words already
    //    and must not be touched; the comma in the locants is additionally excluded by the left guard.
    //    ⚠ THE OPERAND IS ANCHORED ON BOTH EDGES so a match cannot begin inside a number: `kella 3.00-ni` is
    //    rejected at `3` (no hyphen follows), at the first `0` (preceded by a dot) and at the second
    //    (preceded by a digit), which leaves the clock refusal of step 7's note intact.
    //    ⚠ AND A CURRENCY SIGN IS IN THE LEFT GUARD, which was found by probing rather than by reasoning.
    //    `$2-le` and `$4-le` (poker blinds, ×3) would otherwise become `$kahele` — a word glued to the sign,
    //    which the shared tier can no longer match, so the `$` would vanish ENTIRELY. Trading a raw suffix
    //    token for a silently dropped currency is a worse reading, so those three are declined whole
    //    (trap 53) and keep exactly the output they had.
    t = t.replace(/(?<![\d.,\p{Sc}])(\d{1,4})-(le|ni)(?![\p{L}\p{M}])/gu, (m, n: string, suf: string) => {
        const v = Number(n);
        return v >= 1 && v <= 9999 ? `${genCardinal(v)}${suf}` : m;
    });

    // 7) RANGES → `N kuni M` (247,555 whole-corpus; 103 in the retained text). See RANGE_JOINER for the
    //    part-of-speech check and the three corpus infixes that break Finnish's refusal for this language.
    //    AFTER steps 4–6, so an ORDINAL span has already been claimed and cannot be read as a quantity span,
    //    and BEFORE step 8, which is the hil coupling (trap 55): with decimals first, `14,5-30 atm` would
    //    become `14 koma 5-30` and this rule would pair `5` with `30`, a backwards span inside one number.
    //    ⚠ A DECIMAL OPERAND ON EITHER SIDE IS DECLINED, and the guards are what decline it: `14,5-30` is
    //    rejected on the left (a comma precedes `5`) and `18–13,7 °C` on the right (a comma follows `13`).
    //    Four spans in this corpus are lost that way and each keeps exactly the reading it had. Claiming them
    //    means re-implementing step 8 inside this rule; the same limit is accepted in the sibling layers.
    //    ⚠ THE `/` IN THE LEFT GUARD is what keeps `1750/1500–500 e.m.a` from pairing `1500` with `500`, and
    //    the ascending test declines the rest of that shape.
    //    ⚠ THE RIGHT GUARD CARRIES NO `.`, AND REMOVING IT WAS MEASURED RATHER THAN ARGUED. It used to, on
    //    the theory that a dot after the right operand meant a dotted number — but the LEFT guard already
    //    rejects a span whose left operand sits inside one (`1750/1500–500` at the `/`, `II.16-17.98b32–34`
    //    at the preceding `.`), so the right-hand `.` had no shape left to protect and was declining a span
    //    for its SENTENCE PERIOD. Differentially over all 464 retained segments with only that `.` removed:
    //    9 segments change, all 9 gain a correct `kuni`, 0 regress — `lk 137–151.`, `1912–1913.`,
    //    `50 000 – 100 000.`, `1993–1996.`, `145–151.`, `24–27.`, `89-93.`, `231–238.`, `1944–1980.`.
    //    ⚠ THE `,` STAYS. It declines a DECIMAL right operand (`5–13,7`), which is a real shape this corpus
    //    writes on the left (`14,5-30`) and the guard's other half already rejects — ×0 on the right here,
    //    and kept because the class exists, not because it fired.
    //    ⚠ ASCENDING ONLY. Non-ascending digit spans in this corpus are a vote ratio (`59,7:40,3` — excluded
    //    by the colon anyway), the descending BC year pairs `3000–2000 eKr`, `330–329 eKr` and `844–832 eKr`,
    //    and the reversed temperature `18–13,7 °C`. ⚠ A BC YEAR SPAN IS DESCENDING BY ARITHMETIC AND ASCENDING
    //    IN TIME, so declining it is a real cost — three spans keep their silent dash. It is taken knowingly:
    //    the alternative is to read the era marker's position, and step 2 has already spent it.
    const NUM = String.raw`\d+`;
    t = t.replace(
        new RegExp(
            String.raw`(?<![-+−–—/\d.,:\p{L}\p{M}])(${NUM})[ ]?[-–—][ ]?(${NUM})(?![-+−/\d:\p{L}\p{M}]|,\d)`,
            "gu",
        ),
        (whole: string, a: string, b: string) =>
            (Number(a) < Number(b) ? `${a} ${RANGE_JOINER} ${b}` : whole),
    );
    //    The ELLIPSIS span (7): `−10...0 °C`, `3000...4000 m`, `200...250 mm`, `40...50 mm`. Three ASCII dots
    //    between digits are not three clause breaks — `clausePunctuation` maps each `.` to a sentence end, so
    //    `3000...4000` came out as two numbers with THREE pauses between them. Same joiner, same evidence.
    t = t.replace(/(?<![\d.,])(\d+)\s*\.\.\.\s*(\d+)(?![\d.,])/gu, `$1 ${RANGE_JOINER} $2`);

    // 8) THE DECIMAL COMMA (91,561 whole-corpus; 91 retained) — the second-largest defect. `clausePunctuation`
    //    maps `,` to a pause, so `74,2%` read *seitsekümmend neli [PAUSE] kaks*: a sentence break inside one
    //    number and no separator word at all.
    //    ⚠ THE FRACTION KEEPS ITS DIGITS AND SO DOES THE INTEGER — the rule inserts ONE word and nothing else.
    //    That is what preserves the number–unit ADJACENCY the shared tier matches on (playbook step 4's
    //    "units before decimals" coupling, and trap 14's last clause): `1,6 cm` becomes `1 koma 6 cm`, so the
    //    tier still sees a digit against `cm`. Wording the operand here would silently drop every unit after
    //    a decimal.
    //    ⚠ AND THERE IS NO DOT ARM, WHICH IS THE MIRROR OF fi's "no comma-grouping arm" AND IS MEASURED THE
    //    SAME WAY. `\d+\.\d+` matches 25 strings in the retained text and TWENTY-TWO are classical citations
    //    — `Diogenes Laertios 5.14`, `Metafüüsika 4.1b25`, `De interpretatione 9.19a30–32` — with two poker
    //    figures quoted from English (`$0.20`, `3.3million`) and exactly ONE real decimal, `63.27%`, in a list
    //    whose other five members are written with commas. A dot arm would put a *koma* into twenty-two
    //    citations to fix one figure the same sentence spells correctly five times over.
    t = t.replace(/(?<![\d.,])(\d+),(\d+)(?![\d,])/gu, (_m, int: string, frac: string) =>
        `${int} ${DECIMAL_WORD} ${[...frac].join(" ")}`);

    // 9) DEGREES (3,973 whole-corpus; 33 retained), AFTER the ranges and the decimals so the operand is
    //    already whole, and BEFORE the sign rules so `−15 °C` still has its digit adjacency.
    //    ⚠ NO SCALE NAME IS EMITTED, AND THAT IS THE CORPUS'S OWN CHOICE RATHER THAN A GAP LEFT OPEN.
    //    `sources.ts` reports `[NONE] scale-names` for Estonian — neither *Celsiuse* nor *Fahrenheiti*
    //    occurs in the corpus, the referee or espeak — but the language's word for the reading IS attested,
    //    in exactly this slot and with the scale left unsaid: *"langeb temperatuur talvel alla –18 kraadi"*
    //    and *"võib õhutemperatuur langeda −26 kraadini"* are both Celsius and neither says so. So `°C` and a
    //    bare `°` get the same word, which is what the corpus does. ⚠ `°F` is ×0 here and is given the same
    //    reading rather than a scale name it cannot source — a reading it is not, so the `F` is consumed
    //    with it rather than left as a bare letter (trap 53: refuse the whole match or claim the whole match,
    //    never half of it).
    //    ⚠ THE COORDINATE FORM IS REFUSED WHOLE. `38°51'`, `41°16'`, `43° 29'`, `46° 37'` — four instances
    //    where an arc-MINUTE follows. `minutit` is unattested in this slot in any source available here, so
    //    reading the degree and leaving the tick would half-close the reading; the lookahead declines the
    //    match instead and those four keep exactly the output they had. The plain latitudes `46° ja 49°
    //    põhjalaiuse` and the angle `109°` are claimed, and *kraadi* is right for both senses.
    //    ⚠ THE TRAP-12 GUARD IS REQUIRED AND THE CORPUS PROVES IT: *"Suvel ulatub temperatuur +26 °C
    //    kraadini"* writes the sign AND the word. Emitting into that would say "degrees" twice. See
    //    `saidNear` for the three ways the equivalent Luganda guard was wrong before review.
    const degree = (w: string, n: string, off: number, all: string): string =>
        saidNear(all, off, off + w.length, "kraad") ? n : `${n} ${DEGREE_WORD}`;
    t = t.replace(/(\d)\s*°\s*[CF](?![\p{L}\p{M}])/gui, degree);
    t = t.replace(/(\d)\s*°(?!\s*\d+\s*['’′])/gu, degree);

    // 10) THE MINUS SIGN (18,727 `signed-number` whole-corpus; 8 in the retained text), AFTER the range rule
    //     so a span's dash has already been spent and cannot be read as a sign.
    //     Every one of the eight is a genuine negative: `−7 °C`, `−15 °C`, `−1 °C`, `−10 ja −5 °C`,
    //     `−10...0 °C`, `–18 kraadi`, `−26 kraadini` and one currency amount, `(-35$ aastas)` — an annual
    //     domain-registration cost. **Omitting a plus is lossless; omitting a minus INVERTS**, which is why
    //     this sign is read even though the plus below is argued separately.
    //     ⚠ THE LOOKBEHIND CARRIES `.`, `,` AND THE DASHES themselves as well as letters and digits, so a
    //     span this file declined (`18–13,7`, `1920.–1940.`) cannot have its leftover dash re-read as a
    //     negative. Zero false positives over the retained text.
    //     `miinus` is attested ×43/18 and the first hit glosses itself — *"Miinus Seitse (ka -7)"*.
    t = t.replace(/(?<![\p{L}\p{M}\d.,–—-])[-−–](?=\d)/gu, "miinus ");

    // 10b) THE PLUS SIGN (7), argued SEPARATELY and never on the minus's citation (the hi mistake). Read,
    //     because all seven instances take it: `+26 °C` (the Estonian weather register says *pluss*), the
    //     phone country code `+376`, the seat/score infixes `€315+35`, `(156+27)`-shaped `"9+1"`, and the
    //     arithmetic `sin(x) + x³`. None can misfire — `+` is not an Estonian letter — and `pluss` is
    //     attested DEFINITIONALLY: *"Pluss ehk plussmärk (+) on märk, mida kasutatakse eeskätt
    //     matemaatikas"*.
    //     ⚠ THE INFIX ARM IS WIDER THAN "BETWEEN TWO DIGITS", AND THE WIDTH IS MEASURED. A digits-only arm
    //     left three of the seven unread and the artifact scan said so — `f(x) = sin(x) + x³` (operands are
    //     a bracket and a letter), `($20+$20)` (the right operand is a currency SIGN) and
    //     `$50 pre-flopist + 3x$30` (the leading arm's digit is one space away). None of the three can be
    //     read by a rule that insists on a digit, and all three are ordinary additions. `+` is not an
    //     Estonian letter, so no widening here can bite a word.
    t = t.replace(/(?<![\p{L}\p{M}\d])\+\s?(?=\d)/gu, "pluss ");
    t = t.replace(/(?<=[\p{L}\p{M}\d)\p{Sc}])\s*\+\s*(?=[\p{L}\p{M}\d(\p{Sc}])/gu, " pluss ");

    // The insertions above pad with spaces so a word never fuses with its neighbours; collapse the runs, and
    // do not leave one at an edge (SLOT-GAP is a corpus-diff defect class and this pass may not feed it).
    return t.replace(/[^\S\n]{2,}/gu, " ").replace(/^[^\S\n]+|[^\S\n]+$/gu, "");
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// INITIALISMS
// ─────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * LETTER NAMES — espeak-ng `dictsource/et_list`'s own 32-entry block, transcribed back to orthography, and
 * SEVEN of them independently corroborated by the referee's IPA for the single-letter entries it carries
 * (see the header's sourcing block; all seven agree).
 *
 * ⚠ `sources.ts` REPORTS `letter-names espeak 32 letters — WIREABLE`, which is trap 16's check run in the
 * direction that BREAKS the deferral rather than confirming it. The seam exists, the table exists, and the
 * readings being shipped without it were `SKP-st` → one unpronounceable token, `TGV` → [tɡv], `SNCF` → [snkf].
 *
 * ⚠ `y` IS `igrek` AND THE REFEREE CARRIES BOTH READINGS — `i ɡ r e k` and `y p s i l o n` — for the same
 * letter. espeak declares `igrek`; picking either is a variant, not an error, and the majority spelling in
 * Estonian usage is taken.
 */
const LETTER_NAME: Readonly<Record<string, string>> = {
    a: "aa", b: "bee", c: "tsee", d: "dee", e: "ee", f: "eff", g: "gee", h: "haa", i: "ii", j: "jott",
    k: "kaa", l: "ell", m: "emm", n: "enn", o: "oo", p: "pee", q: "kuu", r: "err", s: "ess", t: "tee",
    u: "uu", v: "vee", w: "kaksisvee", x: "iks", y: "igrek", z: "tsett", ä: "ää", ö: "öö", õ: "õõ",
    ü: "üü", š: "šaa", ž: "žee",
};

/**
 * Estonian phonotactics, for the OOV rule in core/initialisms.ts (can this letter run be a word at all?).
 *
 * ⚠ THE ONSET SET IS THE LOAD-BEARING ONE. No NATIVE Estonian word begins with a consonant cluster at all, so
 * an empty set would be "correct" and would spell out every borrowed acronym that Estonian in fact reads as a
 * word. The clusters listed are the ones the language's own LOANS begin with — *kliima*, *kroon*, *praegu*,
 * *proua*, *sport*, *stress*, *traktor*, *tsement*, *sleng*, *skulptuur*, *plaan*, *bluus*, *grill* — which
 * is the orthographic fact, not a guess.
 * The coda set is Estonian's genuine word-final clusters (*punkt*, *kest*, *linn*, *rand*, *marss*, *kilk*),
 * and it is what keeps `ERR` and `ICANN` READ AS WORDS, which is what this corpus's readers do with them.
 *
 * Effect on the corpus's 59 distinct all-caps runs, after `registry.ts`'s Roman pass has already turned
 * `II`/`III`/`VI`/`XIII` into digits: spelled out are `SKP SKT TGV SNCF NSV CS CD DJ CG FTTH NLH TMS FL DLPFC
 * PMR TPI WSOP WTA NCAA USD IDF ISAF CSKA WC`; left as words are `NATO UNESCO ISIS ICANN IUPAC ÜRO ERR LED
 * FIE ISO SI` — which is the right split for every one of them that this reader can judge.
 */
export const isUnreadableEstonian = makeUnreadableTest({
    vowels: /[aeiouyõäöü]/u,
    legalOnsets: new Set([
        "bl", "br", "dr", "fl", "fr", "gl", "gr", "kl", "kr", "kv", "pl", "pr", "ps", "sk", "sl", "sn",
        "sp", "st", "sv", "tr", "ts", "tv",
    ]),
    legalCodas: new Set([
        "kk", "ks", "ld", "ll", "ls", "lt", "mm", "nd", "ng", "nk", "nn", "ns", "nt", "pp", "rd", "rr",
        "rs", "rt", "ss", "st", "tt", "hk", "ht",
    ]),
});

/**
 * LEXICAL: letter runs that ARE readable as Estonian words and are nevertheless spelled out — the fact no
 * phonotactic test can derive. Kept to what a source states: espeak's `et_list` marks `USA` with
 * `$abbrev $allcaps`, i.e. spell it, and USA is ×16 in this corpus — the commonest initialism it has.
 *
 * ⚠ NOTHING ELSE IS LISTED, DELIBERATELY. `SI` (×1, *SI-süsteemis*) and `LED` (×1) are plausibly spelled in
 * Estonian speech too, but no source in this tree says so and one instance each is not a convention. The
 * playbook's standing rule is that a lexical fact is recorded, never derived — and never invented to be
 * consistent.
 */
const ACRONYM_LETTERS: ReadonlySet<string> = new Set(["usa"]);

/**
 * THE INITIALISM PASS (320,493 instances whole-corpus; 108 all-caps runs in the retained text, ~83 after the
 * shared Roman pass has consumed the numerals).
 *
 * ⚠ ORDERING, VERIFIED END-TO-END RATHER THAN ASSERTED (trap 16). It runs AFTER `normalizeEstonian`, so the
 * era markers and abbreviations are already spent — and after the shared ROMAN pass, which is not in this
 * file at all: Estonian is NOT in `registry.ts`'s `ROMAN_NATIVE`, so `normalizeRomans` wraps `engine.text()`
 * and `Vittorio Emmanuele III-st` is `3-st` by the time anything here sees it. A test pins that through the
 * real phonemizer with `XV`, whose letters would be spelled if the order were wrong.
 *
 * ⚠ IT TOUCHES EXACTLY ONE REFEREE TOKEN AND THE SCORE DOES NOT MOVE — 2732/2903 folded and 98.6% symbol
 * accuracy, byte-identical before and after. The referee's only multi-letter capital entry is `WC
 * v eː t s eː`, its own spelled reading; this engine used to read it as the word ⟨wc⟩ (`w`→v, `c`→k, no
 * vowel, no stress) and now spells it *kaksisvee tsee*. Still a miss, and the reason is a real fact about
 * the language rather than a defect: **⟨w⟩ HAS TWO ESTONIAN NAMES AND THE REFEREE USES BOTH.** Standing
 * alone it records `W k ɑ k s i s v eːː` — *kaksisvee*, the formal name, which is also espeak's — and
 * inside `WC` it records *vee*, the colloquial one. Picking either is a variant; there is no table that
 * scores both. Every other referee token is a lowercase word or a SINGLE letter, and the shared pass
 * requires two capitals, so nothing else in the referee can be touched at all — which is what makes
 * "the referee did not move" checkable here rather than merely observed.
 */
export function normalizeEstonianInitialisms(text: string): string {
    return makeInitialismNormalizer({
        letterName: (l) => LETTER_NAME[l],
        acronymLetters: ACRONYM_LETTERS,
        // Estonian has no in-engine pronunciation dictionary — the grapheme table is context-free and the
        // referee is an evaluation set, not a lookup — so, as in fi/sv/de/nl, every lexical fact lives in
        // ACRONYM_LETTERS above.
        isRecorded: () => false,
        isUnreadable: isUnreadableEstonian,
    })(resolveHyphenInflection(text));
}

/**
 * THE HYPHEN ON AN INITIALISM — Estonian's inflectional joint, and the counterpart of Finnish's colon.
 * `SKP-st`, `USA-sse`, `USA-s`, `SNCF-i` (4 in the retained text). Unlike the digit forms of step 6 this one
 * needs no morphology at all: the suffix attaches to the SPOKEN form, whose last word is a letter name, so
 * `SKP-st` is *ess kaa peest* and `SNCF-i` is *ess enn tsee effi*.
 *
 * ⚠ IT MUST RUN BEFORE THE SHARED PASS, not after, because the shared pass would spell `SKP` and leave `-st`
 * behind as its own token — a bare consonant cluster in the phoneme stream, which is the defect this layer is
 * closing rather than one it may create.
 *
 * ⚠ A HYPHENATED COMPOUND IS NOT A CASE SUFFIX AND MUST SURVIVE AS TWO WORDS. `TGV-rongile`,
 * `PMR-spektrites`, `FTTH-ühendus`, `SI-süsteemis` are compounds whose second element is a full Estonian
 * word, and reading them as head + word is right. The length cap is what separates them: an Estonian case
 * ending is at most three letters (`sse`, `ks`, `ni`, `st`, `le`, `ga`, `na`, `l`, `s`, `t`), and every
 * compound second element in this corpus is six letters or more. Measured on the retained text: 4 suffixes
 * matched, 4 compounds declined, 0 either way round.
 *
 * ⚠ A HEAD THAT IS NOT SPELLED OUT keeps its hyphen and its word — `ISIS-e`, `ICANN-i` are read as words by
 * the OOV rule, and gluing a suffix onto a word the tokenizer will read anyway buys nothing.
 */
function resolveHyphenInflection(text: string): string {
    return text.replace(
        /(?<![\p{L}\p{M}])(\p{Lu}{2,})-([a-zõäöüšž]{1,3})(?![\p{L}\p{M}])/gu,
        (m, head: string, suf: string) => {
            const lower = head.toLowerCase();
            if (!ACRONYM_LETTERS.has(lower) && !isUnreadableEstonian(lower)) return m;
            const names = [...lower].map((l) => LETTER_NAME[l]);
            return names.every((n) => n !== undefined) ? `${names.slice(0, -1).join(" ")} ${names[names.length - 1]!}${suf}`.trim() : m;
        },
    );
}
