# Chittagonian (ctg) native bring-up — ⛔ cannot-verify

Eastern Indo-Aryan (Bengali-Assamese sub-branch), ~13M speakers, Chittagong
(Bangladesh). A distinct language, but with **no independent phonetic referee**, so
this is a ⛔ **cannot-verify** stub — the Assamese pattern (reuse the Bengali engine
+ an override manifest of the documented divergences), anchored by a hand-adjudicated
gold of the DISTINCTIVE features only.

## Data check — nothing machine-readable

- wikipron: none. epitran ctg-Beng: none. kaikki: 404. Wiktionary: 24 lemmas,
  <10 with IPA. No JIPA Illustration.
- The cited phonology grammars (**Moniruzzaman 2007**, **Hai 1965**) are out of reach.
- **No standard orthography** — Bengali-Assamese script, Latin, and Arabic all used,
  none standardised. (We take the Bengali-Assamese script as the input.)
- Tone: contested — the accessible sources describe **no** tone (we emit none).

The user supplied the two obtainable sources: **Uddin, "Chittagonian Variety:
Dialect, Language, or Semi-Language?"** (IIUC Studies 12, drawing on Moniruzzaman
2007) and a short **Wikipedia-derived overview** (Uddin). Neither is a phonology
grammar; both are *comparative* (Chittagonian vs Bengali). This is exactly the case
the user framed: high mutual intelligibility → describe it *against* Bengali.

## The build — Bengali engine + documented divergences

Reuses `makeNativeBengali` with a Chittagonian override manifest (`skipLexicon:true`
so the Bengali word-lexicon can't leak Bengali pronunciations). The divergences,
each grounded in the two sources:

- **Spirantisation of the voiceless velar/labial aspirates**: খ [kʰ]→[x] (both
  sources: xabar), ফ [pʰ]→[f]. The signature.
- **Loss of the voiced aspirates** (source 2, explicit: "lost all the voiced
  aspirates"; confirmed by the sample bát ভাত): ঘ→[ɡ], ধ→[d̪], ঢ→[ɖ], ভ→[b], ঢ়→[ɽ].
- **Deaffrication**: চ ছ → [s], জ ঝ য → [z].
- The **[s]/[ʃ] contrast**: স → [s] (Bengali merges all three sibilants to [ʃ]).
- **Contrastive nasalisation** via the candrabindu (আর [ar] 'and' vs আঁর [ãr] 'my').

NOT applied (undocumented → kept Bengali-conservative, disclosed): the voiceless
dental/retroflex aspirates থ ঠ (no homorganic fricative documented), the retroflex
series ট ড, and the vowel qualities. Numbers use Bengali spellings as a disclosed
placeholder (Chittagonian numerals are undocumented; the sample even has Portuguese
ugwá/duwá 'one/two').

## Corroboration (⛔ — the falsifiable check that can fail)

The two sources INDEPENDENTLY agree on the spirantisation (both give xabar for খ→x),
and source 2 adds the voiced-aspirate loss + bát (ভ→b) — a check that *could* fail
(if we'd mapped ভ→bʱ, ভাত would be [bʱat], contradicting the attested bát; it is
[bat]). The hand-gold (`test/chittagonian.test.ts`, 6 tests) locks these distinctive
features. The shared Bengali bulk is asserted, not measured — hence ⛔.

**Verified:** খবর→[xɔbɔɾ], ঘর→[ɡɔɾ], ভাত→[bat̪], ফুল→[ful], চা→[sa], জল→[zɔl],
সাত→[sat̪] vs শহর→[ʃɔɦɔɾ], আর→[aɾ] vs আঁর→[ãɾ].

**Upgrade path:** Moniruzzaman (2007) or Hai (1965) for the full rule system + a
transcribed gold would lift this to a measurable 🔷 (the Madurese path). Until then,
⛔ is the honest ceiling.
