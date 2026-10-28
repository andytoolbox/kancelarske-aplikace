<p align="center"><img src="apps.svg" width="150" alt="Kancelářské aplikace – žralok s deskami a tužkou"></p>

# Kancelářské aplikace

Sbírka bezplatných kancelářských nástrojů, které běží přímo v prohlížeči. Soubory se **nikam neodesílají** – vše se zpracovává ve vašem počítači.

**Spustit:** [andytoolbox.github.io/kancelarske-aplikace](https://andytoolbox.github.io/kancelarske-aplikace/)

## Aplikace

| | Aplikace | Adresa |
|---|---|---|
| <img src="pdf/icon.svg" width="48" alt=""> | **Andy PDF** – úpravy PDF | [Otevřít Andy PDF](https://andytoolbox.github.io/kancelarske-aplikace/pdf/) |
| <img src="kalkulacka/icon.svg" width="48" alt=""> | **Andy Kalkulačka** – vědecká kalkulačka, DPH, data, převody | [Otevřít kalkulačku](https://andytoolbox.github.io/kancelarske-aplikace/kalkulacka/) |
| <img src="kalendar/icon.svg" width="48" alt=""> | **Andy Kalendář** – svátky, jmeniny, plánování | [Otevřít kalendář](https://andytoolbox.github.io/kancelarske-aplikace/kalendar/) |

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

## Andy Kalkulačka

- **Vědecká kalkulačka:** závorky, mocniny, odmocniny, goniometrické funkce (stupně i radiány), logaritmy, faktoriál, π, e, paměť (MC, MR, M+, M−), lze psát i z klávesnice
- **Procenta jako u stolní kalkulačky:** 200 + 10 % = 220
- **Páska:** historie výpočtů se součtem, kopírování a tisk; zůstane uložená i po zavření
- **DPH:** sazby 21 % a 12 % (platné v roce 2026), 0 % i vlastní sazba; výpočet zdola i shora, zaokrouhlení na haléře nebo koruny
- **Procenta:** podíl, změna v %, sleva, přirážka a marže, původní cena před slevou
- **Data a dny:** rozdíl mezi daty, pracovní dny bez víkendů a státních svátků ČR, splatnost (+14 dní apod.), číslo týdne, přehled svátků
- **Převody:** měny podle kurzů ČNB (služba [Frankfurter](https://frankfurter.dev), bez registrace) nebo vlastní kurz; délka, plocha, objem, hmotnost, teplota, čas, rychlost, energie, data

Do všech polí lze psát i výpočty, např. `1200*3`.

---

## Andy Kalendář

- **Klasický český kalendář:** státní svátky (včetně Velikonoc), jmeniny na každý den, čísla týdnů, volitelně významné dny (Den matek, advent, změna času…)
- **Tři zobrazení:** měsíc jako nástěnný kalendář, týden jako diář s poznámkami, celý rok na jedné stránce
- **Události:** čas, místo, poznámka, barva, vícedenní akce; opakování denně, každý pracovní den, týdně, po 2 týdnech, měsíčně, ročně (narozeniny); smazání jen jednoho výskytu
- **Úkoly:** s termínem i bez, po termínu / dnes / nadcházející, odškrtávání
- **Tisk** měsíce, týdne i roku; **záloha** do souboru a **export do Outlooku / Google Kalendáře** (.ics)
- Vše se ukládá jen v prohlížeči daného počítače – pro přenos na jiný počítač použijte zálohu.

Jmeniny pocházejí z knihovny [namedays-cs](https://github.com/OzzyCzech/namedays-cs) (MIT, © Roman Ožana).

---

## Jak zveřejnit na GitHubu

1. Vytvořte veřejný repozitář (úložiště) `kancelarske-aplikace`: https://github.com/new
2. Nahrajte do něj **obsah** této složky (včetně složky `pdf`): `https://github.com/andytoolbox/kancelarske-aplikace/upload`
3. Zapněte GitHub Pages: `https://github.com/andytoolbox/kancelarske-aplikace/settings/pages` → Branch `main` → Save.

## Jak přidat další aplikaci

1. Vytvořte novou složku (např. `kalkulacka/`) se souborem `index.html`.
2. Do hlavního `index.html` přidejte kartu s odkazem na novou složku.

---

Created by Julius Andy Antoš
