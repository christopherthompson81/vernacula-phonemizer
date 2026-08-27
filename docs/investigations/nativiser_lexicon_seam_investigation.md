# The nativiser-before-lexicon seam (#1068) — measuring before deciding

#1068 was filed with three witnesses and four candidate fixes, and deliberately without a choice between
them, because the issue's own "suggested shape" asks for two counts first:

1. per lexicon-bearing engine, how many keys are unreachable under the current fold;
2. how many distinct keys would COLLIDE under option 3 (fold the lexicon keys at load).

This document is those counts. It does not land a fix.

---

## Run 1 — 2026-08-26 ~18:50

**Command.** A throwaway sweep (`.probe/nat/sweep2.mts`, not committed) that, per language, extracts
`NATIVE_CLASS` and the `makeNativiser` flags out of the engine source — so the fold measured is the fold the
engine actually applies, not a re-derivation — then reads every `data/languages/<lang>/*.tsv`, treats column 1
as the key, and classifies each unreachable key by what its folded form lands on.

**Question.** Is #1068 a 15-key curiosity in Swedish, or a fleet-wide defect? And does option 3 cost more
than it buys?

**Scope.** 21 engines use both `makeNativiser` and a word-keyed TSV lexicon; 30 lexicons between them.

### Raw finding

```
lang        file                    keys   unreach  orphan  same  CLASH   examples
slovenian   stress.tsv             37340      1252     684   469     99   abstraktən→abstrakten  aktualizirał→aktualiziral
swedish     accent-stress.tsv      42052        15      12     3      0   düsseldorf→dusseldorf  genève→geneve
norwegian   nb-lexicon.tsv         38276        14      10     1      3   señor→senor  malmö→malmo  göring→goring
danish      da-lexicon.tsv         37008         4       1     2      1   joão→joao
balochi     balochi-lexicon.tsv      399         4       4     0      0   آپ→اپ  آس→اس  آتک→اتک

25 further lexicons — 0 unreachable keys each, ~323,000 keys:
  akan-tone, catalan mid-vowels + bl-gl-geminate, czech loanwords, german ×6 (131,840 keys),
  hausa tone, ilocano, irish, javanese, minnan dict + dict-chars (70,535), romanian stress,
  serbian stress + accent-transitions (105,729), tagalog ×2, turkish stress, welsh, zhuang, zulu tone

TOTALS over the five affected lexicons: keys=155,075  unreachable=1,289
  · orphan        711  — the folded form is NOT already a key
  · same-value    475  — the folded form is already a key with the SAME value (a harmless duplicate)
  · VALUE-CLASH   103  — the folded form is already a key with a DIFFERENT value
```

### What it implies

**The defect is real but narrow, and Swedish is not the interesting case.** Five of thirty lexicons are
affected at all. `slovenian/stress.tsv` carries 1,252 of the 1,289 — 97% of the whole problem, and two orders
of magnitude more than the witness the issue was filed on.

**⚠ SLOVENIAN IS A DIFFERENT DEFECT WEARING THE SAME CLOTHES, and this is the finding that changes the
decision.** Its unreachable keys are spelled with **ə** (683 keys) or **ł** (638), 69 with
both — characters that are not Slovene orthography at all. `abstraktən` is not how Slovene writes *abstrakten*; `aktualizirał` is not
*aktualiziral*. These are phonetic respellings that leaked into the key column when the lexicon was built
from kaikki. So the direction of the failure is inverted:

|              | where the odd spelling lives | what the input contains | does today's fold hurt?                  |
|--------------|------------------------------|-------------------------|------------------------------------------|
| sv / no / da | the **key** (`münchen`)      | the same letter (`München`) | yes — input folds to `munchen`, key stays `münchen`, miss |
| slovenian    | the **key** (`abstraktən`)   | never (`abstrakten`)    | no — the key was simply always dead      |

That distinction decides between the candidates. **Option 2 (look up the lexicon before nativising) fixes
sv/no/da and does nothing whatever for Slovene**, because no Slovene input string will ever contain ə — a
pre-fold lookup on `abstrakten` misses `abstraktən` exactly as the post-fold one does. **Option 3 (fold the
keys at load) fixes all five**, and in Slovene it does more than repair a miss: 684 of those keys fold onto a
word the lexicon does not otherwise contain, so folding **adds 684 real stress entries** rather than merely
un-hiding them. Option 1 (NFC at the seam) is orthogonal — it is kmr's witness and neither helps nor hurts
these counts.

**Option 3's measured cost is 103 keys fleet-wide, and it is avoidable.** 475 of the 1,289 collapse onto an
identical value and cost nothing. The 103 that clash are 99 Slovene (`bləste`=0 vs `bleste`=1 — the ə-spelling
and the e-spelling disagree about which nucleus is stressed), 3 Norwegian, 1 Danish. **A precedence rule
removes the cost entirely: an unfolded key already in the map WINS, and a folded key is inserted only into a
free slot.** That yields 711 keys rescued, 475 duplicates collapsed, 0 readings changed for any word the
engine can already reach today — which also means the parity goldens cannot move, since every row they cover
resolves through a key that exists now.

**The fourth option is not a partial version of the others — it is a separate defect, and sv's total is 20,
not 15.** The issue described sv as "10 folded away, 5 split", and offered widening `LATIN_RUN` to carry the
apostrophe as a cheaper fix "for 5 of sv's 15". Measured, both halves of that were off:

- **15 keys fail the FOLD**, not 10 — `crème` and `hélène` are in the set too, which the hand-listed ten
  missed. (è is outside `NATIVE_CLASS`; é is inside it.)
- **The 5 apostrophe keys do NOT fail the fold at all.** `nat("o'brien")` returns `o'brien` unchanged — the
  nativiser has nothing to fold, because an apostrophe is not a letter it maps. They are lost one step
  earlier, in the TOKENIZER: `phonemize("o'brien", "sv")` = *uː brˈìːɛn*, two words, the `o` read as the
  Swedish word *o*.

So the two sets are DISJOINT and option 3 does not touch the apostrophe five. Both fixes are wanted; neither
subsumes the other. (The reading `münchen` actually emits is *mˈɵ̀nkhɛn* — the grave is accent 2, where NST
records accent 1 — and `munchen` emits the same string, which is the fold made visible.)

**Negative result worth keeping:** the 25 clean lexicons are not clean by luck. German's six tables (131,840
keys) and Serbian's two (105,729) are the two largest in the fleet and score exactly zero, because their
`NATIVE_CLASS` already admits every letter their source writes — including, for sr, both scripts. The seam
only bites where a lexicon's provenance spells words in an alphabet wider than the engine's declared
inventory. That is a **sourcing** property, not an engine one, which suggests the durable guard is the
per-lexicon reachability test the issue asks for in step 3, not a rule about folds.

### What this changes for the next step

The measurement says option 3 + an unfolded-key-wins precedence rule, and says it on numbers rather than
taste. What it does NOT settle is Slovene's 99 clashes as a *data* question: `bləste` and `bleste` disagreeing
about stress is a lexicon-provenance defect that precedence merely routes around, and it deserves its own
look at whether the ə-rows should be in `stress.tsv` at all. Recorded here rather than fixed, because it is a
different question from the one #1068 asks.

⚠ **None of this is reachable from the parity gate.** Both engines fold identically, so every count above is
a defect both sides reproduce byte-for-byte. The instrument was a purpose-built sweep, and the durable
version of it is a test, not a gate row.
