# Bare unit token — the abbreviation that only reads when a number is in front of it

`10 km` reads. `km` alone does not: the raw ASCII abbreviation reaches the phoneme sink. In a Latin-script
language that leak is invisible to every gate the project has — DIGIT hunts digits, RAWMARK hunts
punctuation, and a Latin run in a Latin-script language looks exactly like a word. Same class as the
`syllableToIpa` (hmn) and `baseToIpa` (cdo) defects: a path that returns its own input.

## Run 1 — 2026-08-12 20:35

**Command.** `npx tsx probe-leak.scratch.mts` (the ready probe: for every registry engine with a
normalization layer, does `km`/`kg`/`mm`/`cm` leak bare, and does `10 <unit>` leak too?).

**Question.** How many engines leak the bare token while ALREADY declaring the word — i.e. how many are
fixable without sourcing a single new word?

**Raw finding.** 50 FIXABLE (af ak az bar bm ca ceb cs cy de es es-419 ff ha hil hr ht id it jv kmr lb ln
mad mg mi nl nya om pcm pl pt pt-BR rn ro rw sk sl sn so sr su sv tl tr uz xh yo zsm zu), 11 NEEDS-A-WORD
(bal hmn ig jv mg mi mos sn tl yo za — out of scope; inventing a word is the Fula `tere` failure).

**Implication.** The word is there in all 50; only the standalone path is missing. One shared change, in the
tier that already owns the unit table.

## Run 2 — 2026-08-12 20:41

**Command.** `npx tsx measure-bareunit.scratch.mts --ctx` — extract every language's declared `units` keys
from source, then scan its mined corpus (`tools/corpus/mined/<code>.jsonc`, 47 of the 50 have one; es-419,
pt-BR and zsm share their base language's) for STANDALONE occurrences under the predicate the fix would use.

**Question.** The one the fix stands or falls on: is a bare `km`/`mm` token always a unit? And which case?

**Raw finding (by written form).** `km` 68 · `mi` 27 · `ha` 24 · `naninirahan` 8 · `kilometro` 6 · `kg` 6 ·
`cm` 4 · `katao` 3 · `mm` 2 · `inches` 2 · `Kg` 2 · `Cm` 1 · `MM` 1 · `full` 1 · `Mi` 1 · `MI` 1 · `គម` 1.

The hits split cleanly along ONE line — whether the key contains a vowel.

* VOWEL-FREE keys (`km` `kg` `cm` `mm`): units in every instance. Most are `NNN&nbsp;km`, where the HTML
  entity is what puts the numeral out of the digit-adjacent rule's reach. Two non-unit exceptions, both
  guardable and both recorded below.
* KEYS WITH A VOWEL: mostly ordinary words of the language.
  * `ha` ×24 — Somali particle, *si kastaba **ha** ahaatee* ×~19; Spanish *se **ha** registrado*, *no se
    **ha** emitido*. Never a hectare.
  * `mi` ×29 — Yoruba possessive (*ìmò **mi***, *Àkùn **mi***) ×11, and `sq mi` inside an English
    parenthetical in so/zu/xh/nya. Never a bare mile.
  * `naninirahan` ×8, `kilometro` ×6, `katao` ×3 (tl), `inches` ×2 (te), `full` ×1 — spelled-out unit keys
    that are simply words.

**Case (measured, not preferred).** Every upper-case standalone hit except one is NOT a unit: `MM` = the
Mercalli scale (kmr), `MI` = Michigan in a bibliography (nya), `Cm` = a variable in a rendered formula
(cmn), `Mi` = the Yoruba word at the head of a title. The single genuine one is `$5 pa Kg` (sn) ×2.

**Non-unit counter-examples among the vowel-free keys.**
1. `km.t` (arz) — the transliterated Ancient Egyptian name of Egypt. Standalone by every other test.
2. `គម` (km/Khmer) — matched INSIDE សហ​គម ("community"), which U+200B splits. In an abugida a consonant-only
   run is a word fragment, not a symbol.
3. Corpus-file header prose and `"language": "km"` metadata — artefacts of the JSONC container, not text.

**Implication — the four guards, each earned.** (a) never a single-letter key (trap 46, unchanged);
(b) the key must be vowel-free — an alphabet that writes its vowels does not write vowel-less words, which
separates a symbol from a word with no per-language lexicon; (c) Latin script only — the Khmer hit, plus
Cyrillic `см`, which is the centimetre AND the standard abbreviation of *смотри* ("see"), so the same test
would license a wrong reading there; (d) exact case, no folding — folding would buy 2 readings and cost 4,
and `Kg` keeps leaking VISIBLY, which is the honest side to fail on. Plus positional guards: not after a
numeral, not before `/` (half a rate), not before an exponent, not before `.`+letter (`km.t`).

## Run 3 — 2026-08-12 20:52

**Command.** Fix in `src/core/normalizeSymbols.ts` (`isBareUnitKey` + `makeBareUnitNormalizer`, applied
after the digit-adjacent unit path and before the bare-exponent path); `npx tsc --noEmit`; probe; `npx vitest run`.

**Question.** How much of the 50 does the shared tier actually serve, and what moves?

**Raw finding.** Probe: 50 → 6. tsc clean. Suite: 3843 passed, 2 failed — both changed goldens, both
findings rather than breakage:

* `test/javanese.test.ts` — `10-15(-17) cm` → `…15(-17) sèntimèter` (was `…(-17) cm`). The old golden PINNED
  A LEAK: the `)` puts the numeral out of the digit rule's reach, so `cm` reached the IPA raw. It is a
  centimetre in every corpus instance of that botanical shape. The dash behaviour the test is about is
  unchanged.
* `test/normalize-multilang.test.ts` — `2 zillion km` → `2 zillion kilometre` (was `2 zillion km`). The
  assertion's point — an undeclared magnitude is not swallowed and the count does not reach across it — still
  holds: "zillion" survives and the noun is in its uncounted citation form. The distance is a reason not to
  COUNT the unit; it was never a reason to leave raw ASCII in the stream.

**Implication.** The remaining 6 — ak, bm, ht, ln, om, ro — do not go through `makeSymbolNormalizer` at all;
each keeps a LOCAL unit table for reasons its own header gives (ro's `802.11ah` lookbehind, ht's refusal to
claim `km/h`, om's noun-first order). Rather than hand-write the guards a second time in six places, the
bare-token pass was extracted as an exported `makeBareUnitNormalizer` for those six to call.

## Run 4 — 2026-08-12 21:00

**Command.** Six local-table engines wired to the exported `makeBareUnitNormalizer`; probe; `npx vitest run`.

**Question.** Does the leak actually close everywhere, and does anything else move?

**Raw finding.** Probe FIXABLE 50 → **0**; NEEDS-A-WORD unchanged at 11, as intended. Suite: 3845 passed,
0 failed. Guard spot-checks through the registry, each a shape that has bitten before:

```
rn   50 m’ubumwe → miɾoŋo itanu m ubumwe      (one-letter key still silent)
ak   US$ 1m      → dɔla baako m               (ditto, and the currency arm is untouched)
id   makmur      → mˈaʔmur                    (a real word with `km` inside it)
de   km/h        → km h                       (a rate the language declines is still declined)
de   km.t        → km . t          km. → kilomˈeːtɐ .
es   se ha registrado → se ˈa rexistɾˈaðo     yo  mi → mi˧
ro   802.11g     → …ˈunsprezet͡ʃe ɡ            (the designation is still a designation)
```

**Implication.** Both routes work and no guard fires wrongly. Pinned as regression tests in
`test/normalize-multilang.test.ts` ("a unit symbol standing alone", 6 tests) — both directions, including
the single-letter and vowel-key negatives and the ten-language fleet reading.

## Run 5 — 2026-08-12 21:05

**Command.** `corpus-diff.ts emit` from a baseline worktree pinned at the pre-change commit, then `compare`,
for **de** (Germanic), **pl** (Slavic, count agreement), **tr** (Turkic, `suffix` exponent), **rw** (Bantu),
**ht** (French-lexifier creole, LOCAL table), **ro** (Romance, LOCAL table) — six families and both
implementation routes. Then **bar**, **jv**, **mad**, **kmr**, the four the corpus measurement predicted
would actually move.

**Question.** What does this change at corpus scale, and is any of it a regression?

**Raw finding.**

| lang | changed | before → after |
|---|---|---|
| de, pl, tr, ro, bar, mad, kmr | 0 | defect counts identical |
| rw | 0 | DROP 21 → 21 |
| ht | 1/439 | DROP 23 → 22 |
| jv | 3/448 | SLOT-GAP 1 → 1, DROP 30 → 30 |

⚠ **THE `&nbsp;` HITS FROM RUN 2 DO NOT REACH THE ENGINE AS BARE TOKENS.** 68 of the raw standalone `km`
were `NNN&nbsp;km` in the JSONC, and bar/mad/kmr — which are almost entirely that shape — changed by
nothing. The entity is decoded before the reading, so the numeral IS adjacent and the digit path already
had them. The file scan overcounted; the pipeline is the authority. Negative result, and it means the
corpus-visible surface of this defect is much smaller than the raw counts suggested.

**jv, all three improvements.** `10-15(-17) cm` read **t͡ʃm** — the raw letters spoken as Javanese, audible
garbage rather than a drop, which is why no gate flagged it — and now reads *sɛnt̪imˈɛt̪ər*. The other two
are the planetary-distance sentences: `57,9 × 10⁶ km` puts an EXPONENT between the numeral and the unit,
so the digit path cannot reach it; eight instances across the two sentences now read *kilomˈɛt̪ər*.

⚠ **ht's DROP 23 → 22 IS NOT A FIX, IT IS A DETECTOR BLIND SPOT, and it is worth writing down.** The
utterance is `yon sifas tè km² ( mil kare)` — an exponent with no numeral. The `²` is STILL unread (the
output still says *km*); what changed is that `dropsIn` probes by DELETING the sign and re-reading, and
with the deletion the `km` is now a bare token that reads *kilomèt*. The two readings differ, so the probe
concludes the sign was not dropped. `mine.ts scan` shows the same thing from the other side: ht's
`ACCEPTED exponent ×1` row disappears. It was an ACCEPTED silence, not a LEAK, so no gate weakened — but a
deletion-probe detector can be blinded by a rule that changes the neighbourhood, and this is the shape.

## Run 6 — 2026-08-12 21:10

**Command.** `mine.ts scan` on de, pl, tr, rw, ht, ro, jv, against the same scans from the baseline
worktree; `review.ts --lang de` and `--lang ht`.

**Question.** Any new defect class anywhere?

**Raw finding.** Every scan byte-identical to its baseline except the ht `ACCEPTED exponent ×1` row
described above. de review: checklist clean but for its pre-existing `[??] sourcing — Yen`. ht review:
2 FAILING (`DROPPED: minus`, `DROP minus ×10`) — identical in the baseline worktree, so pre-existing and
untouched by this change.

**Implication.** Done. The leak is closed in all 50, nothing else moved, and the one detector row that
changed is recorded above rather than banked as a win.
