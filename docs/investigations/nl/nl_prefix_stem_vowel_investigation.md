# nl: the prefix shift onto a reduced stem ⟨e⟩ (#1550)

## Run 1 — 2026-10-14 (why `vertellen` kept prefix stress, and which guard is net positive)

**Question.** `vertellen` read *vˈɛrtələn*, but `verkopen` read *vərkˈoːpən*. What stops the shift, and can a rule
fix it without breaking the ⟨ge⟩/⟨be⟩ roots the existing guard protects?

**Command.** `<scratchpad>/prefix.mts`, rebuilt from the #1524 log's description since its scratch script was
not committed: every kaikki nl word matching `^[a-zà-ÿ]+$` that starts with a `prefixUnstressed` member (4,296
words), scored by `phonemizeWord`.
- **Segments:** stress, length, the syllable dot and the offglide stripped. This is a simpler fold than
  referee-eval's BACKBONE, so it serves only as a before/after comparison.
- **Stress:** the index of the stressed syllable, counted on 4,229 words with a stressed variant.

Variants sat behind temporary env switches in `placeStress`, since removed. Then the full
`tools/referee-eval/eval.ts nl` on main and on the fix.

**Raw finding.**
- **Cause.** `g2p.ts` reduces every non-initial single ⟨e⟩ to schwa BEFORE stress is placed. `placeStress` only
  shifts off a prefix when the second nucleus is not a schwa, a guard that exists for a root such as
  `ge·ven`. So `ver·tel·len`, `be·stel·len`, `ge·zel·lig`, `her·ken·nen` and `ont·dek·ken` all kept the
  stress on the prefix.
- **Scale.** About 900 of the 1,143 stress misses are this shape: the prefix is stressed and the referee
  stresses the next syllable.

The rule: shift onto a reduced ⟨e⟩ unless it is the LAST nucleus and only an ending follows it. Restore its
full vowel through the scanner's own open/closed rule (`fullVowel`), which gives tɛl, zɛl, ɣeːt.

| Variant | Segments | Stress |
|---|---|---|
| base | 2,687 (62.55%) | 3,086 (72.97%) |
| endings n,r,l,"" | 3,097 (72.09%) | 3,554 (84.04%) |
| endings n,r,"" | 3,087 | 3,544 |
| endings n,"" | 3,069 | 3,528 |
| endings n,l,"" | 3,079 | 3,538 |
| endings n,r,l,m,"" | 3,098 | 3,555 |
| + no shift after a longer STRESSED prefix (tegen, terug) | **3,131 (72.88%)** | **3,601 (85.15%)** |

- **Gains and losses** (the last row against base): stress +664 / −149, segments +579 / −135. The
  stressed-prefix guard removed 46 losses at no cost: the `tegen-` compounds (`tegenstander`, `tegenspraak`,
  `tegendeel`) are te + a stem in spelling only.
- **What's left.** The remaining losses are prefix-SPELLED stems: teken-, hersen-, bedel-, verre-, gekken-,
  telex. As #1524 found for tennis/telling, these need a lexicon rather than a gate.
- **Full referee eval:** kaikki 31,205 → 31,629 (+424), wikipron 30,884 → 31,305 (+421).
- **nl golden:** 50 rows move.
  - **Most are the intended fix:** bekent, beperkingsgebied, gegeven, gewelddadige, verdenkt, gerechten,
    herstellen, herkenbare, genezen, gevechten, bedekt, verstrekken, verwerkt and others.
  - **Moved but wrong before and after:** telefoon, geregistreerd, gereconstrueerd.
  - **Now wrong:** the compound hersenletsel (her- is not a prefix there) and temperatuur. These are the
    measured residual losses.
- **Dead end:** none of the variants without the stressed-prefix guard beat it.
- **Mutation proofs.** Without the ending check, geven/beter/verder lose first-syllable stress, and so does the
  stem `tellen` itself (it starts with te-). Without the stressed-prefix check, tegenstander does.

**Implication.** Closes #1550. The prefix-spelled stems are lexicon work.

## Run 2 — 2026-10-14 (#1551: `hoofdstuk 3.12` read as a clock)

**Question.** #1524 declined the section-number reading for want of evidence. Can it be sourced?

**Command.** A research pass (Onze Taal, Vlaanderen Taaladvies, nl.wiktionary, usage), every `\d{1,2}\.\d{2}` in FLEURS nl
and the golden with its preceding word, probes, and `nl-normalize` before/after.

**Raw finding.**
- **Writing: sourced.** Onze Taal ("tijden noteren"; "komma of punt in getal") and Vlaanderen Taaladvies
  ("uurnotatie"): Dutch writes a clock with a dot (`12.30 uur`, with `uur` optional) and a decimal with a comma.
  A dotted pair is therefore a clock, or an English-style decimal or version number.
- **Speech: not sourced.** How a section number is spoken has no authoritative description. The only usage
  attested is *punt* for version numbers (an nl.taal thread, "Twee punt nul").
- **Corpus.**
  - All 17 dotted clocks in FLEURS nl follow om, rond, tussen, vanaf, precies, na, ongeveer, was or en, or a
    parenthesis. None follows a section word.
  - The one real section number, `figuur 1.1`, never reached the clock rule (one-digit minute).
  - The golden's dotted clock is `Vanaf 11.29 uur`.
- **Fix.** After a `sectionWords` member (new dutch.jsonc list: hoofdstuk, paragraaf, par., sectie, artikel,
  art., figuur, fig., tabel, bijlage, versie, lid, stap), the dot form is not a clock. It falls through to the
  path `figuur 1.1` already takes (*drie . twaalf*). No spoken *punt* is invented.
- **Impact.** nl-normalize changes 0 of 29,792 rows. Every probe clock (`om 12.30 uur`, `rond 07.19 uur`,
  `tussen 6.30 en 7.30`) is unchanged.
- **Tests.** `test/dutch-1551-section-numbers.test.ts`, C# `Dutch1551SectionTests` and Rust
  `the_1551_section_numbers_are_not_clocks`, relational. With the fix reverted they fail 4/5 (TS, C#) and fail
  (Rust).

**Implication.** The section number is no longer misread. If a source for the spoken *punt* turns up, it slots in
at the release point.

## Run 3 — 2026-10-14 (#1551: the prefix-spelled stems, as a sourced exception list)

**Question.** Runs 1 and #1524 found that no rule separates a prefix from a stem that only begins with its
letters (tennis, hertog, hersenen), so these "need a lexicon". Is a kaikki-derived list legitimate here, and how
much does it gain?

**Command.**
- `<scratchpad>/mine.mts` over `nl.kaikki-nl.tsv`: every lowercase word starting ver/ont/her/be/ge/te whose
  stressed variants ALL put primary stress on the first syllable, and which the engine stressed elsewhere.
- `<scratchpad>/score.mts` on those words, before and after.
- `tools/referee-eval/eval.ts nl` main vs fix.
- The FLEURS nl phonemize-sync diff and the nl golden.

**Raw finding.**
- **Legitimacy.** The repo already ships the same thing for Turkish (`turkish/stress.tsv`, a kaikki mine,
  CC-BY-SA, fenced per file and listed in `LICENSES/PROVENANCE.md` §3). The Dutch engine had no exception
  mechanism at all.
- **The list.** 276 words. `telefoon` and `temperatuur` are not in it: their referee stress is final, so a
  first-syllable list could not fix them.
- **Mechanism.** A listed word takes no prefix shift in its FIRST chunk. Reading listed compounds whole was a
  dead end: it dropped the seam rules, so *bedlamp* kept a voiced *d* (bˈɛdlɑmp). They now split as before,
  with the flag on chunk 0. A related bug: `groups.map(phonemizeChunk)` would have passed the array index as
  the new flag (typecheck caught it).
- **On the 276 words.** Stress is right on 0 → 276, which is circular by construction. Segments against kaikki
  go 15 → 167. The rest are loanwords the g2p cannot spell (beauty, beagle, teamgenoot) and inflection-driven
  vowels.
- **Full referee eval.** kaikki 31,629 → 31,782 (+153), wikipron 31,305 → 31,454 (+149). Both are partly
  circular, since both referees are Wiktionary-derived.
- **FLEURS nl.** 52 of 3,748 rows change: *generaal* ×14, *hersenen* ×10, *tempo*, *versie*, *technisch*,
  *verreweg*, *verrekijker*, *bergachtig*, *tennis*, *hertog*.
- **The nl golden.** 6 rows move (*hersenletsel*, *technisch*, *genus*, each ×2). *hersenletsel* was one of
  Run 1's measured losses.
- **Rust.** It replays FLEURS plus all 276 listed words identically (4,025 rows), and nl parity is 200/200.
- **Tests.** `test/dutch-1551-not-prefixed.test.ts`, C# `Dutch1551NotPrefixedTests` and Rust
  `the_1551_not_prefixed_words` are structural: where the stress sits, and whether the first vowel is full.
  With the list file removed, TS and C# fail 8/13 and Rust fails.

**Implication.** Closes the last nl item of #1551.
