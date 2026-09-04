# en OOV n-gram: a word-final consonant letter that emits nothing (#1265)

Follow-up to #1260, whose retrained n-gram improved every measured class but one: a consonant letter at the
end of a word emitting no phone — `SNES` → *sn*, `ISIL` → *ˈɪsɪ*, `GIF` → *ɡˈɪ*. The decoder penalises a
VOWEL letter that emits nothing (`evp`, 5 nats, when the context is found below order 3) because a swallowed
nucleus is never right; nothing weighs against a swallowed consonant, and for the training data that is
sometimes correct (`lamb`, `damn`, `corps`, `Illinois`). This log measures whether a penalty of the same
shape helps more than it hurts.

## Run 1 — 2026-09-04 20:30 — the candidates, and the baseline they must beat

Baseline = the unpruned model shipped by #1260, held-out tenth of CMUdict (11,748 words):

```
word-acc(stress) 47.20%   word-acc(segments) 53.25%   PER 13.71%   spurious VV 634 (5.40%)
no vowel 21   short by ≥2 155   long by ≥2 139   FINAL CONSONANT LOST 216 (1.84%)
```

Two shapes of the same rule, behind `G2P_FINALC` for measurement only:

- **A** — penalise an empty chunk on a WORD-FINAL consonant letter (not `y`, not a doubled letter), same
  magnitude and same order threshold as the vowel penalty. Attested silent finals (`lamb`, `damn`) are found at
  order ≥ 3 and so are not penalised, which is the vowel rule's own exemption mechanism.
- **C** — penalise it on ANY consonant letter not in a known silent digraph (`kn gn wr ps pn gh ck rh mb mn
  wh sc st tch dg`) and not doubled.

Question for Run 2: word accuracy, PER, and the final-consonant count under each, plus the acronym cases.

## Run 2 — 2026-09-04 20:50 — variant A does nothing, and the beam trace says why

```
G2P_DEBUG=1 G2P_FINALC=A  …decompose("snes")
[e] pen=true  S N EH1=-8.8 | S N=-9.1 | S N IY1=-9.6           ← e:"" is 0.3 behind, UNPENALISED: found at order ≥ 3
[s] pen=true  S N=-12.0 | S N Z=-13.2 | S N EH1 S=-13.4        ← final s:"" likewise: order ≥ 3 (…n:N e: → s:"")
```

The vowel penalty's exemption — "not if the n-gram found this empty chunk at order ≥ 3" — was meant to let
attested silences through (`lamb`, the silent final `e`). But CMUdict carries enough French (`Des Moines`,
`Illinois`, `corps`, `debris`) that a silent final `s` after `…ne` IS attested at order 3, and a silent `e`
after `s:S n:N` too. So variant A, which copies that exemption, never fires on the words the issue names.
A2 (full penalty, regardless of order) and A3 (half) drop the exemption for the FINAL consonant only:

```
        SNES   ISIL    GIF
A       sn     ˈɪsɪ    ɡˈɪ        (= baseline)
A2      snz    ˈɪsɪɫ   ɡˈɪf
A3      snz    ˈɪsɪ    ɡˈɪf
```

`SNES` → *snz*: the final consonant is back, but the mid-word `e` is still swallowed — that is the VOWEL
penalty's exemption at work, a separate decision this issue does not reopen. Whether A2's gain on the acronym
cases costs ordinary words is what the held-out numbers decide (Run 3).

## Run 3 — 2026-09-04 21:40 — the four, on the held-out tenth

```
                       word-acc(stress)  word-acc(seg)  PER      noVowel  short≥2  long≥2  FINAL LOST
baseline (#1260)       47.20%            53.25%         13.71%   21       155      139     216
A  final, order-exempt 47.24%            53.30%         13.71%   20       143      151     164
C  any consonant       45.50%            51.22%         14.76%   23       134      254     162   ← rejected: ordinary words pay
A2 final, full evp     46.98%            53.04%         13.72%   19       102      153      44   ← the class nearly gone, word-acc −0.22
A3 final, HALF evp     47.39%            53.50%         13.62%   20       111      152      71   ← taken
```

A3 is better than the baseline on every column — word accuracy +0.19, PER −0.09, the final-consonant class
216 → 71 — and nothing gets worse. A2 removes more of the class but costs ordinary words: the full penalty
overrides silences the model has real evidence for. C, the mid-word version, is simply wrong: a silent
consonant inside a word (`gh`, `kn`, `sc`…) is far more often correct than at the end, and the digraph list
did not save it.

```
GIF → ɡˈɪf     ISIL → ˈɪsɪ (unchanged: the l is not the last letter's problem alone)     SNES → snz
```

The half penalty is expressed as `evp / 2` rather than a new model parameter: it is a decoder rule about a
letter position, not a trained quantity, and it must be identical in the trainer's own decoder (so the number
it prints is the shipped decoder's) and in the C# port. All three carry it.

## Run 4 — 2026-09-04 22:10 — which words moved, and what it did to the goldens

```
npx tsx scratch/moved.mts <main worktree> <branch>     # baseline vs A3 decoder, same model, held-out tenth
```

```
held-out words whose reading moved: 284      now exact: 75      no longer exact: 46
won  bet: B EH → B EH T          bud: B AH → B AH D          crag: K R AE → K R AE G       cancel: K AE N S → K AE N S AH L
won  benedict: …D IH K → …D IH K T    consort: …S AO R → …S AO R T    ambergris: …R IH → …R IH S
LOST arnow: AA R N OW → AA R N AO F                                   ← a silent final w, now voiced
```

⚠ The baseline was not only losing consonants on acronyms. `bet`, `bud`, `crag`, `cancel`, `benedict` are
ordinary words that the n-gram — as OOV, which is how a misspelling or a name reaches it — read one consonant
short, because a silent final letter is cheap for a model that has seen `Illinois`. The 46 losses are the
words where the silence was real (`arnow`, `-ow` and `-gh` shapes); a half penalty leaves those as ties the
n-gram's own evidence usually still wins, which is why A3 beats A2 on word accuracy.

Goldens: 10 files, 39 rows of English OOV runs inside other languages moved (nan 23, hak 8, syl 2, …);
`en.tsv` and the variant goldens did not — they are async-rendered, so their OOV words come from the BiLSTM
and never reach this decoder. (`gen_parity_goldens.mts` again rewrote `en-GB.tsv` with a different sentence
selection; reverted and re-rendered with `gen_variant_golden.mts`, which reports no change.)

## Run 5 — 2026-09-04 23:05 — review: SNES and ISIL were never the decoder's to get right

Review note: *SNES is "es-nes" and ISIL "eye-sil" — mixed letter-pronounced acronyms, lexical.* Right: a
letter, then a syllable. The letter route says *ˈɛs ˈɛn ˈiː ˈɛs*, the word route says *snz* (A3) or *sn*
(before), and no rule can produce the mixed form because nothing in the spelling marks where the letters stop
and the syllable starts. Run 3's "SNES → snz, ISIL → ˈɪsɪ — not reopened" was pinning a wrong reading as if
it were a target. Both go into `accent-lexicon.tsv`, in the same shape as the lexicon's own `emcee`
*ˈɛmsˈiː* and `tv` *tʰˈiːvˈiː*, under a comment marking them hand-authored rather than CMUdict:

```
snes  ˈɛsnˈɛs        isil  ˈaᶦsɪɫ
```

The lexicon precedes the tagger and the n-gram on every path, so `SNES` reads the same sync, async, and
through the accent deltas (*ðə ˈɛsnˈɛs* in en-GB), and inside a foreign run: the FLEURS sentence "an alleged
Daesh (ISIL) militant" is in 58 goldens as an English run inside other languages, and 32 rows in 18 files
moved from the n-gram's *ˈɪsɪ* / the tagger's *ˈɪzəɫ* to the lexical reading. GIF stays the decoder's —
*ɡˈɪf* is what the rule earns, and it is right.

What this leaves for the decoder is exactly the class Run 4 measured: ordinary words reached as OOV.
