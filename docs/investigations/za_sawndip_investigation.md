# Zhuang Sawndip (za, 2nd script) — feasibility + bring-up investigation

Target: **Sawndip** (Sawndip / 古壮字, the Han-derived LOGOGRAPHIC script for Zhuang) as
a SECOND-SCRIPT front-end over the existing `za` Latin engine — the Adlam/Tifinagh
pattern, but glyph→READING (a dictionary) instead of letter→letter (Sawndip is
logographic, not alphabetic).

## Run 1 — feasibility (the polyphony gate)

Previously DECLINED (see memory `second_script_frontends`): "not standardised, thousands
of chars, no char→reading ground truth." Re-opened with a sharper test: the blocker
isn't POLYGRAPHY (many glyphs → one word — harmless, many-to-one) but POLYPHONY (one
glyph → many readings — the fatal ambiguity). Measured it from the kaikki Zhuang extract
(`kaikki.org-dictionary-Zhuang.jsonl`, 3181 entries, each a Standard-Zhuang Latin word
with its IPA + a `forms` list tagged `Sawndip`).

Inverting to glyph→{readings}: **3095 unique Sawndip glyphs, 3621 glyph↔word links.**

| readings/glyph | glyphs | share |
|---|---|---|
| 1 (UNAMBIGUOUS) | 2890 | **93.4%** |
| 2 | 180 | 5.8% |
| 3 | 19 | 0.6% |
| 4–5 | 6 | 0.2% |

**93.4% of documented glyphs carry a single reading.** The polyphonic ~6.6% are mostly
2-way, and many are tonal/vowel variants of one root (那→na/naj/nax/naz, all /na/ + tone).

**Honest caveats (this is a 🔷 reference-parity, covered-subset front-end, NOT a perfect
Sawndip reader):**
1. Wiktionary is LEMMA-oriented → it UNDER-samples phonetic borrowings (the main
   polyphony driver in running text), so 93.4% is an OPTIMISTIC ceiling; real-text
   ambiguity is higher.
2. Coverage is only the ~3095 Wiktionary-documented glyphs; real manuscripts use
   idiosyncratic/unencoded (PUA) forms → OOV.
3. For the polyphonic ~7% we ship a MOST-COMMON DEFAULT (no disambiguation — Sawndip has
   no labelled running-text corpus to train one, unlike the cmn homograph case). An
   alternative reading used in a specific text silently gets the default — exactly the
   Han-homograph situation (行 xíng/háng), disclosed.

Verdict: buildable as a disclosed default-reading front-end. Mechanism = glyph→reading
dict → the existing `za` engine (inherits za's validated phonology). Validation = SELF-
CONSISTENCY: does `za(reading)` reproduce the glyph's kaikki Standard-Zhuang IPA?

## Run 2 — build (glyph→reading dict + front-end)

Generator `tools/zhuang-sawndip/build-sawndip.ts` reads the kaikki extract → glyph→reading
TSV (`src/languages/zhuang/sawndip-readings.tsv`), polyphonic default = most-senses.
Two data-cleaning findings:
- **Filter Ideographic Description Sequences** (⿰⿱… U+2FF0–2FFF) — Wiktionary's notation
  for UNENCODED glyphs, not real input; dropped 569 pseudo-glyphs.
- **Keep only SINGLE-CODEPOINT glyphs** (each = one syllable; front-end reads per char).
  Multi-char whole-word forms (𭨡𮄫 "Sawndip") are dropped — za mis-syllabifies a joined
  reading (the nd→ɗ onset needs the syllable boundary); per-char lookup handles words.
- Self-consistency needs LENGTH folded (za emits maː where kaikki has ma — a za-vs-kaikki
  calibration matter, already folded in za's own eval), same class as Shan.

**Result: 2412 single-codepoint glyphs (198 polyphonic), 100.0% self-consistency**
(2411/2411 — za(reading) reproduces the glyph's kaikki Standard-Zhuang IPA, segmental).

Front-end `sawndip.ts`: `isSawndip` (CJK-ideograph detection — za's normal input is
Latin, so any ideograph = Sawndip), `sawndipToReadings` (per-glyph lookup, OOV dropped),
wired into `zhuang.ts` `text()` as a 3rd token class (CJK run → readings → za g2p). One
glyph = one syllable; mixed Latin+Sawndip in one input works (gou 佲 → koːuː˨˦ mɯŋ˨˦).

Ships 🔷 reference-parity / covered-subset / default-reading (per Run 1 caveats). The
disambiguation of the polyphonic ~8% is EXPLICITLY out of scope (no Sawndip corpus; the
BiLSTM/perceptron homograph approach is a separate cmn-first effort). Tests:
test/zhuang-sawndip.test.ts (goldens + detection + OOV + a dict well-formedness guard
that phonemizes every reading).
