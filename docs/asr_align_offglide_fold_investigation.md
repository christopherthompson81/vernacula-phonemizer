# ASR-align: the superscript offglides in `fold()`

`fold()` in `tools/corpus/asr-align/asr_align_report.py` strips every Lm character, on the argument that
`ˠ ʲ ʰ ʷ` are marks the recognizer never emits. `ᶦ`/`ᶷ` are Lm too, but they are the engine's offglide of a
closing diphthong, and the recognizer writes that segment as `ɪ`/`ʊ`. This log measures what expanding them
does, corpus-wide, before changing anything.

## Run 1 — 2026-09-04 09:10 — census: which modifier letters our IPA actually carries

Question: which Lm characters are vowels in disguise, and how widely?

```
python3 -  # unicodedata.category(ch) == "Lm" over the IPA column of csharp/goldens/*.tsv
```

```
U+1DA6 ᶦ   3,870   75 languages      closing-diphthong offglide (eᶦ aᶦ ɔᶦ)
U+1DB7 ᶷ   2,327   78 languages      (aᶷ əᶷ oᶷ)
U+2071 ⁱ   1,240   cdo cmn ga ha ilo  (paⁱ — the Sinitic offglide)
U+1D58 ᵘ     989   bo cdo cmn cy ha ilo syl
U+1DA4 ᶤ     746   cy                 (ɨ offglide)
U+1D5D ᵝ   1,938   gan hsn ja wuu     compression on ɯ — a MODIFIER, correctly dropped
U+207F ⁿ / U+1D50 ᵐ / U+1D51 ᵑ   6,031 / 3,269 / 3,014   Bantu prenasalisation — a different question
ˈ ː ʰ ʲ ʼ ˌ ˠ ʱ ˀ ʷ ˤ …          stress, length, secondary articulations — correctly dropped
```

Implication: five characters are vowel segments; the fold should expand them, not strip them. Two variants
to measure — A = `ᶦ→ɪ ᶷ→ʊ` only (the issue as filed), B = A plus `ⁱ→i ᵘ→u ᶤ→ɨ`. The prenasals are left for
their own measurement: the recognizer does write `m n ŋ`, so the same argument may apply, but a prenasal is
a consonant onset rather than a vowel nucleus and its deletion cost is a different quantity.

## Run 2 — 2026-09-04 09:40 — corpus-wide before/after, both variants

```
python3 scratch/offglide.py     # every usable row of every language emitting one of ᶦ ᶷ ⁱ ᵘ ᶤ; 63 langs, 163,166 rows
```

Per row: distance with today's `fold()`, with A (`ᶦ→ɪ ᶷ→ʊ`), with B (A + `ⁱ→i ᵘ→u ᶤ→ɨ`). Per language:
median, flag count (>3 MAD), and how many rows moved closer / further. Full table in `scratch/offglide.tsv`;
the rows that decide it:

```
lang         emit   med0    medA    medB    flags 0/A/B   closerA/furtherA   closerB/furtherB
en_us        2570   0.1795  0.1561  0.1561  165/160/160   2450 / 120         same
en_gb        1235   0.2048  0.1826  0.1826   16/ 17/ 17   1081 / 153         same
ta_in        2244   0.5510  0.5349  0.5349   48/ 68/ 68   1505 / 737         same
cy_gb        3080   0.2697  0.2632  0.2738   64/ 61/ 58   1862 / 757          984 / 1846   ← ᶤ→ɨ hurts
cmn_hans_cn  3230   0.2886  0.2890  0.2536  126/125/ 84      5 / 246         3099 / 129    ← ⁱ→i is the big win
cs_cz        1457   0.2780  0.2811  0.2811   38/ 37/ 37    111 / 1346        same          ← A HURTS
gl_es        1857   0.1076  0.1089  0.1089   54/ 49/ 49    775 / 1082        same          ← A hurts, mildly
es_419        849   0.0821  0.0814  0.0814   44/ 47/ 47    481 / 368
ga_ie        1966   0.4811  0.4811  0.4848   36/ 36/ 38      0 / 0             97 / 1869   ← ⁱ→i HURTS
ha_ng        2264   0.2872  0.2872  0.2903   96/ 96/ 91     11 / 4            402 / 1861   ← ᵘ→u HURTS
TOTAL (A)                                                 11162 / 9290
TOTAL (B)                                                 13866 / 13988
```

⚠ **THE ISSUE'S PREMISE IS TRUE FOR ENGLISH AND FALSE AS A GENERALITY.** Where the offglide is the English
one, the recognizer writes it as a segment and expansion is a clean win — en_us 0.180 → 0.156 with 2,450
rows closer against 120. But Czech `oᶷ` gets 1,346 rows FURTHER against 111, Galician is net negative, and
the three smaller letters split the same way: `ⁱ→i` is Mandarin's single largest improvement (3,099 / 129,
median 0.289 → 0.254) and Irish's worst (97 / 1,869). Neither variant is "nothing gets worse", which is the
bar `COARSEN` set for itself. The next run reads what the recognizer actually writes at the glide position,
per language, before choosing a target — the `ɀ` precedent: target by measurement, not by shape.

## Run 3 — 2026-09-04 10:05 — what the recognizer writes at the glide position, per language

Question: is the split in Run 2 a target problem (wrong vowel) or a segment problem (the recognizer hears no
second segment at all)? Align our folded units to the recognizer's, read the recognizer's token AFTER the
nucleus our glide follows, 400 rows per cell:

```
en_us  ᶦ  n=1127  ɪ=1100 (98%)          en_us  ᶷ  n=729  ʊ=596 (82%)         ← a segment, and OUR target
cy_gb  ᶦ  n=526   ɪ=406  (77%)          cy_gb  ᶤ  n=741  ɪ=470 (63%)  ɨ=22   ← ᶤ is heard as ɪ, NOT ɨ
gl_es  ᶦ  n=595   ɪ=328  (55%)  j=78    gl_es  ᶷ  n=500  ʊ=67  (13%)  w=55   ← ᶷ mostly no segment
es_419 ᶦ  n=407   ɪ=216  (53%)          ta_in  ᶦ  n=822  ɪ=381 (46%)
cmn    ⁱ  n=1025  i=970  (95%)          ha_ng  ᵘ  n=144  ʊ=72  (50%)  u=7    ← ᵘ is heard as ʊ, NOT u
cs_cz  ᶷ  n=534   t=52 s=45 ʊ=45 p=42   ← the next CONSONANT: Czech ⟨ou⟩ comes back as one vowel
ga_ie  ⁱ  n=303   n=48 l=39 d=33 t=32   ← never a vowel: Irish ⁱ is slender-consonant colouring, not an offglide
vi_vn  ᶦ  n=200   ɪ=107 (54%)           km_kh  ᶦ  n=99   ɪ=35  (35%)
```

Two corrections to Run 2's targets: `ᶤ→ɪ` and `ᵘ→ʊ`, because that is what comes back (the recognizer writes
`ɨ` 22 times in 741 and `u` 7 in 144) — the `ɀ` lesson again, target by count. And the split is a SEGMENT
problem: in cs and ga the recognizer hears nothing where the glide is, so expanding adds a phone to our side
that has no counterpart, the same fixed penalty in the other direction. The engine's `ⁱ` means two different
things — Mandarin's offglide and Irish's consonant colouring — and a global fold cannot tell them apart.

Implication: the expansion must be per (language, character), decided by the same closer/further count the
`ɀ` entry used, and the exclusions recorded with their numbers. Run 4 computes every cell.

## Run 4 — 2026-09-04 10:30 — every (language, character) cell, with the measured targets

```
python3 scratch/offglide2.py     # targets ᶦ→ɪ ᶷ→ʊ ⁱ→i ᵘ→ʊ ᶤ→ɪ; per cell: rows closer / further when ONLY that cell expands
```

91 cells, 63 of them with ≥20 rows. The pattern is not language-by-language noise — it is one fact seen
from two sides:

```
EXPAND (closer ≫ further)                          KEEP DROPPING (further ≫ closer)
en_us ᶦ 2363/75    ᶷ 1634/414                      cs_cz ᶷ  111/1346     Czech ⟨ou⟩ is one vowel to the recognizer
en_gb ᶦ 1033/143   ᶷ  687/280                      ga_ie ⁱ   97/1869     slender-consonant colouring, not a glide
cy_gb ᶦ 1881/402   ᶤ 1791/938   (ᶷ 634/1129 ✗)     cmn   ᵘ   51/2981     ᶦ 1/146  ᶷ 4/143  — only ⁱ is a glide there
ta_in ᶦ 1506/736                (ᶷ 9/37 ✗)         ha_ng ᵘ  236/848      ⁱ 373/1463
cmn   ⁱ 2917/148                                   gl_es ᶷ  211/1047     mi ᶷ 74/405   xh ᶷ 95/170   ru ᶷ 3/52
gl_es ᶦ  870/589   mi ᶦ 396/141  ny ᶦ 231/88
sn ᶦ 213/73  xh ᶦ 330/195  zu ᶦ 291/106            am ar as be bg bn ckb fa gu he hi hy ja ka kk km kn ko ky
ny ᶷ 63/47   sn ᶷ 66/42   zu ᶷ 105/89              lo mn mr my ne or ps te tg th uk ur vi yue — BOTH letters
es_419 ᶦ 274/238  ᶷ 243/178   el ᶦ 72/49
```

⚠ **THE RIGHT-HAND COLUMN IS THE ENGLISH FOREIGN READER.** am, ar, bg, bn, fa, he, hi, ja, kk, km, ko, th,
vi… do not have closing diphthongs of their own; their `ᶦ`/`ᶷ` are in `gripen`, `ebay`, `craigslist`,
`h5n1` — English words read by the English arm inside a non-Latin host — and the recognizer, listening to
Amharic or Thai speech, writes those loans as monophthongs (Run 3: `eː`, `iː`). Expanding there adds a phone
the recognizer did not hear. Where the diphthong is the language's OWN (English, Welsh, Tamil, Mandarin's
`aⁱ`, the Bantu `ai`/`au` sequences in ny/sn/xh/zu), the recognizer writes the second segment and expansion
removes a deletion that was never real.

And `ᶷ` is heard less often than `ᶦ` everywhere: cy, ta, gl, mi, xh, ru all expand `ᶦ` and not `ᶷ`. A back
offglide is more readily absorbed into the nucleus, by this recognizer at least.

Applying "expand a cell only where closer > further" (n ≥ 20 cells; small cells stay at today's behaviour):

```
median better 13, worse 2 (el_gr +0.0001, ig_ng +0.0001 — n=10 cell, excluded by the threshold), same 47
closer 13,235 / further 3,544
en_us 0.1795 → 0.1561   en_gb 0.2048 → 0.1826   cmn 0.2886 → 0.2690   cy 0.2697 → 0.2578   ta 0.5510 → 0.5348
```

ta_in's flag count RISES 48 → 68 while its median falls — the distribution sharpens, which is the ga_ie
lesson in reverse: a fixed penalty had been hiding the tail.

Implication: the fold is per (language, character), with a positive list — the cells where the recognizer
demonstrably hears the segment — and default drop. "closer > further" is not the report's own criterion,
though; `ɀ` was decided on the MEDIAN. Run 5 recomputes each cell on the median so the list is chosen on the
same unit the report scores with.

## Run 5 — 2026-09-04 11:15 — per-cell on the MEDIAN, the committed table, and the final before/after

```
python3 scratch/offglide3.py     # per cell: the LANGUAGE's median, MAD and flag count with only that cell expanded
python3 scratch/offglide4.py     # the committed OFFGLIDE table, every language it names
python3 asr_align_report.py --selftest
```

Rule, stated once: a cell is listed when n ≥ 20, the language's median does not get worse with only that
cell expanded, and more rows move closer than further. The median alone would have admitted as_in `ᶦ`
(0.3996 → 0.3991 on 20 rows, 7 closer / 13 further) and ko, ja, lo, mn, mr, th, vi `ᶦ` — each a median that
drifts down by a ten-thousandth while most of its rows move the wrong way — and rejected nothing the row
count accepts. Both conditions together are the `ɀ` criterion applied honestly at n=20.

Twenty cells in fourteen languages. What the table does, every language it names:

```
lang         n     med0    med1    flags     closer/further
en_us        2601  0.1795  0.1561  165→160   2450 / 120
en_gb        1281  0.2048  0.1826   16→ 17   1081 / 153      #1258 measured 0.026 for #1252; it was 0.022
cmn_hans_cn  3246  0.2886  0.2690  126→ 93   2917 / 148
cy_gb        2846  0.2697  0.2578   64→ 56   2177 / 636
ta_in        2366  0.5510  0.5348   48→ 68   1506 / 736      the tail was hidden under a fixed penalty
gl_es        2175  0.1076  0.1070   54→ 50    870 / 589
es_419       2306  0.0821  0.0814   44→ 47    481 / 368
mi_nz        3247  0.2418  0.2410   71→ 66    396 / 141
ny_mw        2678  0.3251  0.3241  240→240    260 / 100
zu_za        2858  0.3604  0.3597   76→ 74    291 / 106
xh_za        3466  0.3939  0.3933  106→104    330 / 195
sn_zw        2463  0.2000  0.2000   89→ 88    249 /  86
ru_ru        2562  0.4311  0.4308   93→ 92     41 /  39
mk_mk        2337  0.2848  0.2848   60→ 61     14 /  13
                                             13063 / 3430    median better 12, same 2, worse 0
```

The other 49 languages that carry one of these letters are untouched by construction, and so is every
recognizer string: `fold(phones, lang)` sees no Lm offglide to expand. `--selftest` pins the three
invariants (targets are single vowel letters; the drop is the default without `lang`; a recognizer string
folds identically with and without it).

⚠ **WHAT THIS MEANS FOR EARLIER NUMBERS.** Every `summary.tsv` median for the fourteen languages above is
now stale, and so is #1258's 0.026 (it is 0.022 on the same rows). The queues (`investigate.tsv`) shift too —
ta_in gains twenty rows it could not see. Re-run `asr_align_label.py --apply` and the report before reading
either.

Not done here, on purpose: the prenasal `ⁿ ᵐ ᵑ` (Bantu, 12k tokens), which the same argument may reach and
which need the same per-cell measurement; and the NOTATION question the numbers raise for the non-English
languages that write their own diphthongs with these letters — cs `oᶷ` and ga `ⁱ` come back as one segment,
cy `ᶤ` comes back as `ɪ` — which is an engine question, not a scoring one, and is filed separately.
