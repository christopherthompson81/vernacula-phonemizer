# Investigation logs

Running logs of every measured decision — chronological, by `## Run N`, with the command, the question, the raw
finding and what it implied. Negative results and dead ends are kept on purpose. One folder per language (by
registry code) and one per cross-cutting topic; a new log goes in the folder of the thing it measures.

## Topics

- [`asr-align/`](asr-align/) — the wav2vec2 alignment QC harness and its folds (3)
- [`core/`](core/) — engine seams — registry, async path, browser, trace (5)
- [`corpus/`](corpus/) — corpus sourcing, mining, attestation and the goldens (10)
- [`csharp-port/`](csharp-port/) — findings from the C# porting sweep (1)
- [`normalization/`](normalization/) — cross-language normalization sweeps (Latin runs, silent deletions, initialisms, stress) (26)
- [`numbers/`](numbers/) — the number compositors (5)
- [`referee/`](referee/) — the referee-eval harness, folds and referee quality (6)
- [`symbols/`](symbols/) — the shared symbol tier — units, rates, currency, signs, exponents (16)

## Languages

190 folders, named by registry code; each holds the language's bring-up, normalization, port and eval logs.

[`ab`](ab/) 3 · [`acm`](acm/) 1 · [`acw`](acw/) 1 · [`af`](af/) 3 · [`afb`](afb/) 1 · [`ajp`](ajp/) 1 · [`ak`](ak/) 3 · [`am`](am/) 1 · [`an`](an/) 3 · [`apc`](apc/) 1 · [`apd`](apd/) 1 · [`ar`](ar/) 3 · [`ary`](ary/) 1 · [`arz`](arz/) 2 · [`as`](as/) 2 · [`ast`](ast/) 2 · [`awa`](awa/) 1 · [`ayl`](ayl/) 1 · [`az`](az/) 2 · [`ba`](ba/) 3 · [`bal`](bal/) 3 · [`bar`](bar/) 2 · [`be`](be/) 3 · [`bg`](bg/) 1 · [`bho`](bho/) 1 · [`bm`](bm/) 2 · [`bn`](bn/) 1 · [`bo`](bo/) 2 · [`bpy`](bpy/) 2 · [`bs`](bs/) 3 · [`ca`](ca/) 2 · [`cdo`](cdo/) 3 · [`ceb`](ceb/) 1 · [`chr`](chr/) 3 · [`chv`](chv/) 3 · [`cjy`](cjy/) 2 · [`ckb`](ckb/) 2 · [`cmn`](cmn/) 2 · [`crh`](crh/) 3 · [`cs`](cs/) 2 · [`cy`](cy/) 3 · [`da`](da/) 4 · [`de`](de/) 2 · [`ee`](ee/) 3 · [`el`](el/) 1 · [`en`](en/) 5 · [`en-GB`](en-GB/) 2 · [`en-IN`](en-IN/) 1 · [`es`](es/) 2 · [`es-419`](es-419/) 1 · [`et`](et/) 3 · [`eu`](eu/) 2 · [`fa`](fa/) 2 · [`ff`](ff/) 2 · [`fi`](fi/) 3 · [`fo`](fo/) 3 · [`fr`](fr/) 2 · [`fr-CA`](fr-CA/) 1 · [`ga`](ga/) 3 · [`gan`](gan/) 2 · [`gd`](gd/) 3 · [`gl`](gl/) 3 · [`gn`](gn/) 3 · [`grc`](grc/) 1 · [`gu`](gu/) 1 · [`ha`](ha/) 2 · [`hak`](hak/) 2 · [`haw`](haw/) 2 · [`he`](he/) 3 · [`hi`](hi/) 1 · [`hil`](hil/) 3 · [`hmn`](hmn/) 2 · [`hne`](hne/) 1 · [`hr`](hr/) 3 · [`hsn`](hsn/) 2 · [`ht`](ht/) 3 · [`hu`](hu/) 1 · [`hy`](hy/) 3 · [`hyw`](hyw/) 3 · [`id`](id/) 1 · [`ig`](ig/) 2 · [`ilo`](ilo/) 3 · [`is`](is/) 4 · [`it`](it/) 2 · [`ja`](ja/) 1 · [`jv`](jv/) 2 · [`ka`](ka/) 3 · [`kaa`](kaa/) 3 · [`kam`](kam/) 3 · [`kea`](kea/) 3 · [`ki`](ki/) 3 · [`kk`](kk/) 2 · [`kl`](kl/) 1 · [`km`](km/) 6 · [`kmr`](kmr/) 2 · [`kn`](kn/) 1 · [`ko`](ko/) 1 · [`ky`](ky/) 3 · [`la`](la/) 3 · [`lb`](lb/) 4 · [`lg`](lg/) 2 · [`ln`](ln/) 2 · [`lo`](lo/) 2 · [`lt`](lt/) 2 · [`ltg`](ltg/) 3 · [`luo`](luo/) 3 · [`lv`](lv/) 2 · [`mad`](mad/) 2 · [`mag`](mag/) 2 · [`mai`](mai/) 1 · [`mg`](mg/) 2 · [`mi`](mi/) 1 · [`mk`](mk/) 3 · [`ml`](ml/) 1 · [`mn`](mn/) 3 · [`mos`](mos/) 3 · [`mr`](mr/) 2 · [`ms`](ms/) 1 · [`mt`](mt/) 2 · [`mto`](mto/) 2 · [`my`](my/) 1 · [`nan`](nan/) 3 · [`naq`](naq/) 2 · [`nb`](nb/) 2 · [`nci`](nci/) 3 · [`ne`](ne/) 1 · [`nl`](nl/) 1 · [`nog`](nog/) 2 · [`nso`](nso/) 4 · [`nya`](nya/) 2 · [`oc`](oc/) 2 · [`om`](om/) 2 · [`or`](or/) 1 · [`pa`](pa/) 2 · [`pap`](pap/) 3 · [`pcm`](pcm/) 2 · [`pl`](pl/) 1 · [`pnb`](pnb/) 1 · [`ps`](ps/) 3 · [`pt`](pt/) 2 · [`pt-BR`](pt-BR/) 1 · [`qu`](qu/) 2 · [`quc`](quc/) 2 · [`rkt`](rkt/) 2 · [`rn`](rn/) 3 · [`ro`](ro/) 1 · [`ru`](ru/) 1 · [`rup`](rup/) 3 · [`rw`](rw/) 3 · [`sat`](sat/) 3 · [`sd`](sd/) 1 · [`shi`](shi/) 3 · [`shn`](shn/) 3 · [`si`](si/) 2 · [`sk`](sk/) 3 · [`skr`](skr/) 2 · [`sl`](sl/) 3 · [`smj`](smj/) 2 · [`sn`](sn/) 2 · [`so`](so/) 1 · [`sq`](sq/) 2 · [`sr`](sr/) 1 · [`st`](st/) 3 · [`su`](su/) 1 · [`sv`](sv/) 2 · [`sw`](sw/) 1 · [`syl`](syl/) 2 · [`ta`](ta/) 1 · [`te`](te/) 1 · [`tg`](tg/) 2 · [`th`](th/) 1 · [`ti`](ti/) 3 · [`tk`](tk/) 3 · [`tl`](tl/) 1 · [`tn`](tn/) 3 · [`tr`](tr/) 1 · [`tt`](tt/) 3 · [`ug`](ug/) 2 · [`uk`](uk/) 2 · [`umb`](umb/) 2 · [`ur`](ur/) 3 · [`uz`](uz/) 2 · [`vi`](vi/) 1 · [`wo`](wo/) 3 · [`wuu`](wuu/) 2 · [`xh`](xh/) 3 · [`yo`](yo/) 2 · [`yue`](yue/) 1 · [`za`](za/) 3 · [`zu`](zu/) 2
