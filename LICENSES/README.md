# LICENSES/

Everything licensing lives here:

| | |
|---|---|
| `PROVENANCE.md` | the per-artifact map — which file, which upstream, which license |
| `licencing_posture.md` | the posture the facts-based determinations rest on |
| `*.txt` | verbatim license texts (this file documents them) |

The repo's own MIT grant is the root `LICENSE`; the attribution roll-up is the root `NOTICE.md`.

## The texts

Verbatim copies of every license this repository is obligated under, named by
[SPDX identifier](https://spdx.org/licenses/) so they can key a REUSE manifest later
(`PROVENANCE.md` §6.2).

**These are reference copies — do not edit them.** `MIT.txt` and `BSD-3-Clause.txt` are SPDX
*templates* and keep their `<year> <copyright holders>` placeholders on purpose; the filled-in grant
for this project's own work is the root `LICENSE`, and the filled-in notices for third-party BSD
material belong to those upstreams.

| File | Covers |
|---|---|
| `MIT.txt` | **this project's own work** (root `LICENSE` is the filled-in grant) · pypinyin · epitran · Sharif GE2PE · Nakdimon · dataflare arabic-dialect-corpus · CAMeL Tools |
| `CC0-1.0.txt` | NST Danish/Norwegian/Swedish (Nasjonalbiblioteket / Språkbanken) · HomoRich · Lexibank/ASJP · PyThaiNLP · iTaigi |
| `CC-BY-4.0.txt` | rime-cantonese · Google `language-resources/bn` |
| `CC-BY-SA-3.0.txt` | Wiktionary content under the older license (kaikki extracts are a mechanical redistribution of it) |
| `CC-BY-SA-4.0.txt` | the largest stratum — Wiktionary/wikipron/kaikki, Wikipedia dumps, Lexique 3.83, ChhoeTaigi, kanjium, JMdict/KANJIDIC (EDRDG), UD English-EWT, hermitdave FrequencyWords, CC-CEDICT, the Tajik Shahnameh corpus |
| `Apache-2.0.txt` | CATT (AbjadAI) · OpenCC |
| `BSD-3-Clause.txt` | OpenJTalk / naist-jdic ("modified BSD") |
| `GPL-2.0-only.txt` | Tashkeela · CAMeL Tools `calima-egy` morphology DB (offline teacher, not shipped) |
| `GPL-3.0-only.txt` | rime-wugniu → `wu/dict.tsv`, the one **shipped** GPL-fenced data file · espeak-ng (consulted, not shipped — §5.1) |
| `LicenseRef-SindhiOpenLexicon.txt` | Sindhi Open Lexicon (SindhiLanguage.org, Amar Fayaz Buriro) — a **bespoke** grant: broad and permissive, mandatory attribution, but not CC-BY and with no SPDX ID, hence the `LicenseRef-` prefix |
| `Unicode-DFS-2016.txt` | ICU `thaidict`, one component of `thai/seg-words.txt` |

## Provenance of these copies

Not hand-written — a wrong license text is worse than none.

- **GPL-2.0, GPL-3.0** — Debian `/usr/share/common-licenses/`, which ships the FSF's verbatim layout
  (centred title, indented preamble). SPDX's rendering of the GPL is reflowed; the FSF's own text is
  what the license itself says may not be changed, so Debian's copy is the one used here.
- **Everything else** — the SPDX license list
  (`spdx/license-list-data`, `text/<ID>.txt`), the canonical machine-readable source.
- **Cross-checked:** the SPDX `Apache-2.0.txt` and `CC0-1.0.txt` were compared against Debian's
  independently-distributed copies and match whitespace-normalised, which validates the fetch source.

## Not included

**CC BY 2.0 FR** — Tatoeba's license (Japanese evaluation sentences, tools-only). SPDX carries only
the generic `CC-BY-2.0`, which is a *different instrument*, and Creative Commons publishes the FR port
as French HTML with no plain-text form. Rather than ship a scraped conversion of a French legal
document, it is referenced by URI, which CC licenses expressly permit:
<https://creativecommons.org/licenses/by/2.0/fr/legalcode>

## Resolved — the four formerly-unversioned "CC-BY" upstreams

`LICENSES/PROVENANCE.md` §2 once recorded four upstreams as bare "CC-BY". Chased 2026-08-06; two were
simply unversioned, two were mislabelled:

| Upstream | Actual | How determined |
|---|---|---|
| **lexibank-lsi** (Grierson LSI → `sd`) | **CC-BY-4.0** | GitHub repo license, matching what `sd.grierson-lsi.tsv`'s own header already said |
| **Phonikud** (thewh1teagle) | **CC-BY-4.0** | its `LICENSE` — GitHub reports NOASSERTION only because the repo ships a *reworded* CC-BY-4.0 rather than the verbatim legal code |
| **ReNikud** (thewh1teagle) | **CC-BY-4.0** | its `LICENSE` ("Attribution 4.0 International"), and the GitHub API agrees |
| **JIPA `bo`** — Zhang 2024, "Central Tibetan (Lhasa)" | **CC-BY-4.0** | Crossref license URL on doi:10.1017/S0025100324000033 |
| **JIPA `mad`** — Misnadin & Kirby, "Madurese" | **not CC** — Cambridge subscription terms | Crossref on doi:10.1017/S0025100318000257. Nothing verbatim is taken from it, so this governs the article rather than the 35 word→IPA facts — see PROVENANCE §2b |
| **Sindhi Open Lexicon** | **bespoke — `LicenseRef-SindhiOpenLexicon.txt`** | the dataset ZIP's own `LICENSE.txt`. **Not CC-BY** — bespoke, broad and permissive, attribution mandatory. The ZIP's `README.md` restates the same permission as a bulleted list of alternative use cases, which is what rules out a conjunctive reading of the license sentence; the analysis is in PROVENANCE §2b |

So `CC-BY-4.0.txt` covers rime-cantonese, Google `language-resources/bn`, lexibank-lsi,
Phonikud, ReNikud, and the Zhang Illustration. There is no CC-BY 1.0/2.0/3.0 dependency.
