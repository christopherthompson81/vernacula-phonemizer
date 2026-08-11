# silver.pswikt-ps.tsv — provenance

**Artifact:** `tools/perso-arabic/silver.pswikt-ps.tsv` — 548 `word ⇥ pus ⇥ IPA` rows, a silver tranche for
`invert_harakat.ts --lexicon ps`. Tools-only; not under `src/`, not loaded by the runtime.

## Source and licence

**ps.wiktionary** (Pashto-language Wiktionary), `pswiktionary-latest-pages-articles.xml.bz2`, read 2026-08-10.
Wikimedia content → **CC-BY-SA 3.0 / GFDL**, the same stratum as every wikipron and kaikki artifact here
(`LICENSES/PROVENANCE.md` §3). ⚠ **It is NOT GPL** — unlike the espeak tranche it sits beside — so rows
reachable from it must be counted on the CC side of `pashto/lexicon.tsv`'s licence sentence.
`export_lexicons.sh` does that; any further ps tranche has to be added to the same two places there.

## Why it is committed when the espeak tranche is not

15 KB against espeak's 2.5 MB. Committing it makes the tranche reproducible without the 3.0 MB dump, and the
dump is a rolling `latest` URL that will not be the same file next month — the `ps.kaikki-kandahari.tsv`
failure (hand-cut, source gone, unverifiable, retired) is the precedent. Regenerate with:

```
curl -O https://dumps.wikimedia.org/pswiktionary/latest/pswiktionary-latest-pages-articles.xml.bz2
python3 tools/pashto/build_pswiktionary_silver.py \
    --dump pswiktionary-latest-pages-articles.xml.bz2 --out tools/perso-arabic/silver.pswikt-ps.tsv
```

## What it is, and the one thing to understand about it

⚠ **ps.wiktionary's `{{IPA|…}}` template does not contain IPA.** It holds an ad-hoc Latin transliteration in
the Pashto Academy / MacKenzie tradition — `bāĵ-pā́zay`, `astāz-lìk`, `halɘk`. That is why it is worth having:
the diacritics encode what the abjad does not write.

| mark | n | carries |
|---|---:|---|
| acute | 938 | **stress** (87% of values) |
| macron | 559 | **length** (49%) |
| dot below | 335 | retroflex ḍ ṛ ṇ ṭ |
| caron | 138 | postalveolar č ǰ š ž |

`build_pswiktionary_silver.py` maps that to this engine's IPA inventory. Every confusable mapping is anchored
to a headword in the dump where the Arabic letter and its Latin counterpart line up (`c`=څ from `asmān-cák`,
`j`=ځ from `axaj-lík`, `ǰ`=ج from `ehteǰāǰ-lík`, `x̌`/`ṣ`=ښ, `ǧ`/`ẓ`=ږ, `ɤ`/`γ`=غ).

## Why this source and not another

It is the **only SOUTHERN Pashto pronunciation source found** — on the isogloss it is very nearly pbt-only —
and it is independent of all three existing ones (investigation Run 13, corrected in Run 15):

```
ښ → ṣ̌ / x̌ (pbt) 74/75 = 99%   ·  plain s 1  ·  NORTHERN x 0  ·  broad š 0
ږ → ẓ̌ / ǧ (pbt) 32/32 = 100%
```

wikipron leans ~3:1 **Northern**; espeak's ps_list is internally mixed. 427 of these rows are in none of
espeak, wikipron or kaikki.

## Quality: two guards, and the yield

The dump is visibly corrupted in places — a contiguous block of nine headwords (باز ارمخچه اگن باښه برگېلۍ
پينگوين تارو ترکاڼک ټکټکانه) all carry the value `bāz`; ټاپول carries وگړپال's; `dictionnaire` is French.
Neither guard trusts the source:

1. **The skeleton check** in the builder — the romanization's consonant sequence must match the headword's
   spelling (all consonants for short words, 75% for long compounds). Drops 41.
2. **The inversion itself** — a row yields a label only where some vocalization of the skeleton makes *our*
   g2p reproduce this IPA. The same filter that took espeak's 501 unambiguously-Northern entries to exactly 0.

⚠ **THE YIELD IS THE QUALITY MEASUREMENT, and it is the best of any ps tranche**: 548 rows → **222 shipped
lexicon rows (40.5%)**, against 16.9% for the corpus as a whole. 169 of those are words no other source
reaches. Dropped at build time: 2,062 pages whose template was empty, 453 multi-word/phrasal entries, 41
skeleton-check failures, 14 with characters the map does not cover.

⚠ **It does not move the referee, and that is expected** — 427 of its rows are words wikipron and kaikki do
not contain, so there is nothing for them to score. Same posture as the espeak tranche; see
`src/languages/pashto/lexicon.PROVENANCE.md`.
