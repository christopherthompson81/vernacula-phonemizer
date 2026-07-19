# Lao (lo) native bring-up

Lao — Tai-Kadai, ~30M (incl. Isan, Lao in Thai script), Brahmic ABUGIDA. Sibling of Thai but MORE PHONEMIC
orthography (Lao-PDR reforms stripped most Indic etymological spelling) → a LEANER rule g2p than Thai (no
Sanskrit-reading dictionary). Authored beyond-espeak. Referee: kaikki Lao (Wiktionary, 2310 words, human, tone-
marked). Tones stripped by the eval backbone → SEGMENTAL check.

## Architecture
Self-contained `lao.ts`: leading-vowel reorder (ເ ແ ໂ ໃ ໄ before the consonant) → L→R syllable scan matching the
vowel-sign PATTERN (Lao vowels are discontinuous, around the onset) → tone (class × live/dead × length × mark). The
Thai engine's syllabifier is Thai-orthography-specific, so Lao gets its own leaner scanner reusing the same shape.

## Run 1 — first compile
**57.4% folded** (kaikki, tone-stripped). Consonant/class tables, the 8-way coda, ~28 vowel patterns, ຫ-led high
sonorants, Cວ/Cຼ clusters, leading-vowel reorder. Next: read the residual for the biggest vowel-pattern gaps.

## Run 2 — parens fold + ວາ vowel + ວ→ʋ
**57.4 → 76.0%.** Three fixes: (1) kaikki wraps an optional secondary tone in parens `˩(˧)` — after the backbone
strips the Chao letters the bare `()` remained → fold them out (big); (2) `ວາ` is the VOWEL uːə (ຄວາຍ→kʰuːəj), not
a kʷ cluster; (3) ວ onset → [ʋ] (referee), labialised cluster ʷ~w folded.

## Run 3 — tone-mark extraction (76 → 89.1%)
THE structural fix. Lao tone marks (◌່ ◌້ ◌໊ ◌໋) combine ABOVE the onset and appear BEFORE the vowel signs in the
character stream (ຂ່າ = ຂ + ່ + າ), which broke vowel-pattern matching (ຂ່າວ read the tone mark as the vowel →
inherent-a garbage). `extractTones()` pulls the marks out up front, keyed by onset index, so the scanner sees
contiguous vowel signs (ຂ່າວ→kʰaːw, ເຂົ່າ→kʰaw, ຊ່ອງ→sɔːŋ). +13pp.

## Run 4 — Cວ vowel + ຫຼ ligature (89.1 → 92.7%)
Two fixes: (1) Cວ is the VOWEL uːə in nearly all cases (nwat→nuːət, luəŋ) — only Cວຽ is a labialised kʷ cluster;
flipped the default. (2) ຫ + ຼ (the lam-ligature, U+0EBC, not a base consonant) → [l] HIGH (ສະຫຼາດ→salaːt).

## Run 5 — ຣ → [l] (92.7 → 93.8%)
Modern Lao ຣ (rare, Indic-loan) is realized [l] (the referee uses l: ຈິດຕະລາ→t͡ɕittalaː, ກາລີຍະວິເສດ). Verdict:
**93.8% folded vs kaikki** (2310 words). The residual is diffuse — proper-noun silent letters (Luang Prabang
ຫຼວງພຣະບາງ→luəŋpʰabaŋ), Indic loanword vowels, and referee oddities. A solid authored bring-up: consonant classes,
8-way coda, ~30 vowel patterns, leading-vowel reorder, tone-mark extraction, ຫ-led high sonorants, Cວ/Cຼ, tone
(class×life×length×mark). Tone is APPROXIMATE (eval strips it); a Wiktionary-Module:lo-pron-exact tone pass is a
follow-up. 🟡 — single referee (no wikipron Lao); more phonemic than Thai, so no Sanskrit dictionary needed.
