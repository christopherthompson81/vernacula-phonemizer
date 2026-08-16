# Shan (shn) normalization — investigation log

Picked to break the run. The last four rounds were Turkic — Kipchak ×2, Oghur, Oghuz — and four
consecutive rounds in one family is how a sweep starts porting rules instead of reading corpora. Shan is
Tai-Kadai in the Myanmar script: a different family, a different script, native digits, and its own
sentence terminator. It is also the largest untreated language left with a mined corpus after Turkmen
(3.3M speakers).

`tools/corpus/mined/shn.jsonc` — shn.wikipedia dump, 43,435 paragraph segments, 31/35 cells.

## Run 1 — 2026-08-16 — what the engine does today

Every class in the artifact is defective, and two of them differently from anything in the Turkic rounds:

```
"10%"              → sʰip̚˥                              the sign dropped
"70°C (158°F)"     → …sˈiː …ˈɛf                          the sign gone, ⟨C⟩/⟨F⟩ as ENGLISH letter names
"၁၈° ၀'"           → sʰip̚˥ pɛt̚˩ sʰun˨˦                  degree and prime both gone
"33-38°N"          → …ˈɛn                                …and the compass letter too
"5:23"             → haː˧˧˨ , sʰaːw˥ sʰaːm˨˦             the colon a clause pause
"09:00 – 10:00"    → kaw˧˧˨ , sʰun˨˦ sʰip̚˥ , sʰun˨˦      …twice, inside one span
"B.C 1122-249"     → bˈiː . sˈiː …                       the era marker as English letters
"A.D 649-729"      → ˈə . dˈiː …
"$50 million"      → haː˧˧˨ sʰip̚˥ mˈɪɫjən               the sign dropped
"4.54"             → sʰiː˩ . haː˧˧˨ sʰip̚˥ sʰiː˩         ⚠ the DECIMAL DOT read as a FULL STOP
"2,759 ထတ်း"        → sʰɔŋ˨˦ , t͡ɕet̚˥ paːk̚˩ …            ⚠ the GROUPING COMMA read as a pause
"4.5672 ± 0.0006"  → the ± dropped
"2.5 ၵမ²"          → the power dropped
"10/1/1990"        → three figures fused into one run
```

⚠ **THE SEPARATOR CONVENTION IS THE ENGLISH ONE** — dot decimal, comma grouping: `4.54`, `365.2564`,
`2.5`, `1.1 ၿီႇလီႇယၢၼ်ႇ` against `2,759 ထတ်း` (2759 feet, beside `4300 ထတ်း` in the same sentence) and
`၉၂၄,၆၀၈ ၵေႃႉ`. That is the opposite of every Turkic round in this sweep and the same as Scottish
Gaelic's.

⚠ **AND THE ASCII DOT IS FREE TO BE A DECIMAL POINT, BECAUSE SHAN DOES NOT END SENTENCES WITH IT.** The
terminator is `။` U+104B (×1,173 in the retained text) and the clause mark is `၊` U+104A (×957); the
Latin full stop appears only inside `B.C`, `A.D.` and decimals. Every other layer in this sweep had to
weigh a dot-decimal rule against the sentence-final dot it would eat — Bashkir declined outright, Tatar
found 17 of 18 were figure references. Here the question does not arise, and that is a fact about the
script rather than a judgement call.

## Run 2 — 2026-08-16 — the native digits are already folded, and the grouping is not

`၁၉၆၂` reads correctly today: `foldNativeDigits` runs at the top of `shan.ts`'s `text()` and the TOKEN
class admits ႐-႙ so an unfolded digit could never fall between the word ranges and vanish. **195 native
digits** in the retained text, and they compose exactly like Western ones.

But `၉၂၄,၆၀၈ ၵေႃႉ` still breaks, because the fold does not touch the ASCII comma between them — so the
de-grouping step has to run on the folded text, which is what putting it in `normalize.ts` (before the
engine's own fold) would get wrong. ⚠ **The layer therefore folds native digits itself, first**, and
accepts that the engine will fold again over a string that no longer has any to fold.

## Run 3 — 2026-08-16 — the corpus writes the coordinate BOTH ways, in one article

This is the round's best piece of sourcing and it settles three words at once:

> မီးတမ်ႈတီႈ ၼႂ်းၵႄႈၵၢင် **19 ၻီႇၵရီႇ 45 မိၼိတ်ႉ** လႄႈ **20 ၻီႇၵရီႇ 25 မိၼိတ်ႉ N** ဢိၵ်ႇ
> **98 ၻီႇၵရီႇ 99 ၻီႇၵရီႇ E**

— and elsewhere the same publication writes the same kind of coordinate in signs: `၁၈° ၀' လႄႈ ၁၉° ၅၅'၊
လွင်ႇၵျီႇတုတ်ႉဢွၵ်ႇ ၉၄° ၄၀'`. So `ၻီႇၵရီႇ` (degree) and `မိၼိတ်ႉ` (minute) are not inferred from a
dictionary; the corpus glosses its own notation by writing it out.

⚠ **And the degree class is BOTH thermal and angular here**, as in Turkmen: `70°C (158°F)` beside the
latitude readings and `33-38°N`, `106°-109° E`, `22°N`.

⚠ **The era marker is written in LATIN letters inside Shan text** — `B.C 1122-249`, `A.D 649-729`,
`(1434 A.D.)`, `A.D 739` — so it currently reaches `core/foreign.ts` and is read as English letter names.
The Shan expansion is in the corpus's own prose: `ပီၶရိတ်ႉ` ("Christ year") ×several — "ၼႂ်းပီၶရိတ်ႉ
1054", "ပီၶရိတ်ႉ 1953 တေႃႇ 1956", "ပီၵေႃးၸႃႇ 1320 ပီၶရိတ်ႉ 1950".

⚠ **`ႁူဝ်ပၢၵ်ႇ` is CENTURY, not percent**, and the corpus glosses that too — "မိူဝ်ႈဢွၼ်တၢင်း ႁူဝ်ပၢၵ်ႇ 15
(**15th Century AD**)", "မွၵ်ႈပီႁူဝ်ပၢၵ်ႇ 6 (**6th Century AD**)". Literally "head-hundred". A percent
rule reaching for the obvious "per hundred" compound would land on the word for *century*, which is the
Fula `tere` shape waiting to happen; the percent word is probed separately rather than assumed.

## Run 4 — 2026-08-16 — the attestation tool has no precision in this language, and says so

`attest.ts --lang shn` over 37 words. **Every verdict comes back `attested*`**, and the tool prints the
reason itself:

> `* = UNSPACED SCRIPT: no word boundary exists, so the count is a SUBSTRING count and this tool supplied
> no precision at all. The hit may be a fragment of a longer compound. The examples below are the whole of
> the evidence — an unread `attested*` is worth nothing.`

Reading them proves the warning is not theoretical:

- **`မွင်း` scores ×108 and every returned example is the place name** ဝဵင်းၶမွင်းသဵၵ်ႉ (Khamaungseik).
  The o'clock sense is real — the mined artifact has `10:00 မူင်း`, `(5:23)မွင်း`, `ဝၢႆးဝၼ်း (1) မွင်း`,
  `1 မူင်းၶိုင်ႈ`, `ယၢမ်းမူင်း` — but the wiki count contributed nothing to establishing it.
- **`မၢၵ်ႉ` scores ×116** and is the given name *Mark* (Mark Shuttleworth) and the shop *City Mart*.
- **`ႁဵင်` ("thousand") matches inside ႁဵင်းၵၢတ်ႈ**, an unrelated word.

**Implication** In an unspaced script the MINED ARTIFACT is the stronger source, because a whole sentence
can be read around the hit. Every word this layer emits rests on the artifact, not on a wiki count.

⚠ **AND THAT IS WHAT COSTS THIS LANGUAGE ITS PERCENT RULE.** `%` is 108 corpus-wide and 32 in the retained
text. The obvious compound `ႁူဝ်ပၢၵ်ႇ` ("head-hundred") is the word for CENTURY, and the corpus glosses it
in English to prove it — "ပီႁူဝ်ပၢၵ်ႇ 15 (**15th Century AD**)", "မွၵ်ႈပီႁူဝ်ပၢၵ်ႇ 6 (**6th Century
AD**)". `ပုၼ်ႈႁူဝ်ပၢၵ်ႇ` and `ရာၶိုင်ႈ` score 0. `ပႃႇသႅၼ်ႉ` scores ×5 and came back with **no readable
example**, which by the tool's own legend is not evidence. The class stays unread and visible.

## Run 5 — 2026-08-16 — the two signs that mean something no other language in this sweep meant

Printing every `=`, `>`, `±`:

```
သေရိဝဝႃၼိꩡ=ၵူၼ်းၵႃႉမၢၵ်ႇပွႆးတီး     ·  ပၼ်ထၵ=ၵေႃႉၵိူတ်ႇၸွမ်းတၢင်း
ၻေဝꩪမ်မ=တြႃးၽီ                    ·  ၵၼ်ꩦိ = ၵေႃႉဢၼ် ပိုၼ်ၵၢင်ႇ…        ×23, all of them
သျႃႇမ > သျၢမ်ႇ > သျၢမ်း (Shan)      ·  Rhwam > Yhwam > Hyam > Cyam > Sham > Shan   ×10, all of them
4.5672 ± 0.0006 ၿီႇလီႇယၢၼ်ႇပီ                                                       ×1
```

⚠ **`=` ×23 is a PALI GLOSS SEPARATOR** — the Buddhist-canon articles gloss a Pali term against its Shan
meaning. Zero are equations. That is a **fourth distinct non-equation sense of the sign in five rounds**:
gd's were wiki heading markers, tt's etymology and translation glosses, chv's a library catalogue's
parallel titles, and this is a scriptural gloss.

⚠ **`>` ×10 is a SOUND-CHANGE ARROW** in the historical-linguistics prose. No previous round's `>` was
anything but a typo or a LaTeX fragment; this one is a real, systematic notation with a real meaning that
happens not to be "greater than".

⚠ **AND THE HYPHEN IS NOT A MINUS EITHER, IN ANY OF ITS 19 INSTANCES.** They are ranges (`33-38°N`,
`17 -18`), a timezone offset (`UTC -12`), a **label separator in census figures** (`ၸၢႆး-1,226၊
ယိင်း-1,316` — "male-1,226, female-1,316") and a level marker (`ၸၼ်ႉ-5`, `တပ်မဟာ-၆`). The range rule
requires a DIGIT before the hyphen, which is what leaves the last two alone. `+` ×2 is likewise a timezone
offset, never an addition.

## Run 6 — 2026-08-16 — one defect the probes found late

`09:00 – 10:00 မူင်း` came out with the hour word **twice** on the second endpoint, because the corpus
writes one မူင်း after the whole span and the rule added its own. The same shape Turkmen's `+11° gradus`
produced two rounds ago, and the same fix: a lookahead, guarded on both spellings (မူင်း and မွင်း),
because this corpus uses them in roughly equal measure.

## Run 7 — 2026-08-16 — the gates

- **`mine.ts scan`**: `degree` 8→0 · `ampersand` 7→0 · `currency` 7→2 · `minus` 3→3 (all ranges and
  labels, see run 5) · `math-sign` 28→2 · `percent` 15→15 (the measured refusal). Residual, all read: two
  currency signs inside Latin-script runs, the two `²`, one `kg` in an English nutrition sentence, and
  one iteration mark.
- **corpus diff** (baseline emitted from a pristine worktree at `c97e572`): **112/406 utterances changed
  (27.6%), DROP 67 → 49**, and no DIGIT / SLOT-GAP / RAWMARK / RAW-CAPS / THROW on either side. The
  smallest diff of the sweep, and the reason is in the header — the two biggest sign classes here are
  deliberate refusals, so the layer's job was the separators, the clock, the coordinate and the era.
- **`review.ts --lang shn`**: green on every checklist item including `sourcing` and `sign classes` — nine
  refused classes are registered in `ACCEPTED_SIGN_SILENCE` with their counts and their real senses.
- **`referee-eval shn`**: **90.0% raw / 98.4% folded / 99.1% symbol, before and after** — measured on both
  sides from the pristine worktree. The highest referee scores in this sweep, and unchanged, as expected
  for a layer that rewrites text and not the word g2p.
- **`vitest`** 4,536 passed and **`tsc --noEmit`** clean.

## Backlog surfaced, not fixed

- **Percent (108 corpus-wide) is unread** for want of a word. Run 4.
- **The Celsius scale name and the compass letters** (`°N`, `°E`) are likewise unread; the degree itself
  is claimed.
- **No initialism pass.** `initialism` is 791 and `letter-name` 428 corpus-wide, but the caps runs in the
  retained text are LATIN (`UTC`, `CEPI`, `SOAS`, `AD`), which already reach the foreign reader and are
  read as English letter names — which is arguably right for a Latin acronym in Shan prose. A Shan
  letter-NAME table is what a native initialism pass would need and no source here supplies one.
- **`B.C`** stays in Latin letters; only `A.D` has a corpus-attested Shan expansion.
