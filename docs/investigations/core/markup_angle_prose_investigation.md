# Markup — prose in angle brackets — investigation log

`stripMarkup` removed any span matching `<\/?[a-zA-Z][^<>]*>`, so prose in angle brackets was deleted. This was
reported from a downstream TTS caller: an editor's note wrapped in `< >` left an empty input, and the engine then
returned no phonemes. All probe text below is synthetic.

---

## Run 1 — 2026-10-15 12:00

**Question.** Which tag names actually reach `stripMarkup`? That decides whether a closed element list is safe.

**Command.** Over every corpus file on the external drive (`<external-drive>/omnivoice_ipa/corpus`, 195 GB):
`grep -rhoP '</?[a-zA-Z][^<>\n]{0,80}>' | <tag name> | sort | uniq -c`. The same was run over the golden inputs
(`csharp/goldens/*.tsv`, column 1).

**Raw finding.** Corpus: `sup` 52, `i` 16, `b` 8, and nothing else. Goldens: no tag-shaped span at all.

**Implication.** A list of known HTML and MediaWiki element names loses nothing measured. The list alone is not
enough, though: `<a longer note here>` starts with the real element `a`. Attributes must therefore be
`name=value`, which a run of bare words never is.

## Run 2 — 2026-10-15 12:10

**Question.** With the narrower `TAG`, is the kept bracket read well?

**Command.** `phonemize("Before <a longer note here> after.", lang)` against the `( )` form, over en, es, fr, it,
pt-BR, hi, ja, cmn, ar and de.

**Raw finding.** It was not read well. Only en and ja read the angle and paren forms the same. The other eight
read `<` and `>` as comparison words around the aside: de *klˈaɪ̯nɐ als … ɡʁˈøːsɐ als*, es *menˈoɾ ke … maʝˈoɾ ke*,
ar *ʔˈasˤɣar mˈin … ʔˈakbar mˈin*, and similarly in fr, it, pt-BR, hi and cmn.

**Implication.** The pair has to be rewritten to `( … )` (`PROSE_ANGLE`). It qualifies only if each bracket
hugs a non-space inside and touches no letter or digit outside, and the inside contains a letter. After that
change all ten languages read the angle form byte-identically to the paren form. `3 < 5 and 7 > 2` and
`x<y and z>w` are unchanged.
