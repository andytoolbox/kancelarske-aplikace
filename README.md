<p align="center"><img src="apps.svg" width="110" alt="Kancelářské aplikace"></p>

# Kancelářské aplikace

Sbírka bezplatných kancelářských nástrojů, které běží přímo v prohlížeči. Soubory se **nikam neodesílají** – vše se zpracovává ve vašem počítači.

**Rozcestník:** `https://<vas-ucet>.github.io/kancelarske-aplikace/`

## Aplikace

| | Aplikace | Adresa |
|---|---|---|
| <img src="pdf/icon.svg" width="48" alt=""> | **Andy PDF** – úpravy PDF | [`/pdf/`](pdf/) |

---

## Andy PDF

### Co umí

- **Stránky:** sloučit více PDF a obrázků do jednoho, přeskládat stránky tažením, otáčet, mazat, uložit výběr, rozdělit dokument na jednotlivé stránky (ZIP), očíslovat stránky
- **Oprava textu:** kliknutím na řádek opravíte existující text v PDF (původní text se zakryje barvou pozadí a na jeho místo se napíše nový)
- **Vkládání:** text (písmo, velikost, tučné, kurzíva, podtržení, barva), dnešní datum, obrázek či logo
- **Podpisy a razítka:** nakreslit, vytvořit, nebo **nahrát sken** (JPG, PNG, PDF) – bílé pozadí se automaticky odstraní; uložené položky si prohlížeč pamatuje
- **Formuláře:** vyplnění PDF formulářů s poli
- **Nové PDF:** z fotek a skenů nebo z napsaného textu
- **Tisk** (Ctrl+P) a uložení
- Čeština včetně diakritiky, světlý i tmavý režim


### Použité knihovny a písma

Vše je přibaleno ve složkách `lib` a `fonts`, aplikace nic nestahuje z internetu.

| Součást | Licence |
|---|---|
| [pdf-lib](https://github.com/Hopding/pdf-lib) 1.17.1 | MIT |
| [@pdf-lib/fontkit](https://github.com/Hopding/fontkit) 1.1.1 | MIT |
| [PDF.js](https://github.com/mozilla/pdf.js) 3.11.174 | Apache 2.0 |
| [JSZip](https://github.com/Stuk/jszip) 3.10.1 | MIT |
| Liberation Sans / Serif / Mono | SIL Open Font License 1.1 |
| Carlito, Caladea | SIL Open Font License 1.1 |
| DejaVu Sans | Bitstream Vera / DejaVu (volná licence) |
| Poppins | SIL Open Font License 1.1 |

Písma jsou zmenšená na latinku (včetně češtiny), řečtinu a azbuku.

## Jak zveřejnit na GitHubu

1. Vytvořte veřejný repozitář (úložiště) `kancelarske-aplikace`: https://github.com/new
2. Nahrajte do něj **obsah** této složky (včetně složky `pdf`): `https://github.com/<vas-ucet>/kancelarske-aplikace/upload`
3. Zapněte GitHub Pages: `https://github.com/<vas-ucet>/kancelarske-aplikace/settings/pages` → Branch `main` → Save.

## Jak přidat další aplikaci

1. Vytvořte novou složku (např. `kalkulacka/`) se souborem `index.html`.
2. Do hlavního `index.html` přidejte kartu s odkazem na novou složku.

---

Created by Julius Andy Antoš
