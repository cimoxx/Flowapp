# Flow changelog

## v2.49.2 – Automatické zálohy

- Záloha v posledný deň mesiaca.
- Maximálne 5 cloudových záloh.
- Najstaršia sa pri ďalšej zálohe prepíše.
- Stav auto zálohy v Nastaveniach.

## v2.49.1 – Backup fix

- Záloha cez Spreadsheet.copy namiesto DriveApp.
- Ľahší read-only cloud health check.
- Presné chybové hlášky zo servera.

## v2.49.0 – Data Protection & Backup

- Opravený prázdny Rozpočet z v2.48.0.
- Centrum ochrany dát a diagnostika.
- Kompletné cloudové kópie Google tabuľky, posledných 30 záloh.
- Safety snapshot pred importom JSON.
- Bez zmeny finančného modelu.

## v2.48.0 – UX konsolidácia

- Menej duplicitných údajov na Prehľade.
- Jasnejšia hierarchia Rozpočtu.
- Zrozumiteľnejšie názvy Rozpočet/Odhad.
- Jednotnejšie filtre Analytiky a Tempa míňania.
- Bez zmeny finančných algoritmov.

## v2.47.0 – Koľko ešte môžem minúť?

- Rezerva do konca mesiaca a suma na deň.
- Jednoduchý stav tempa míňania.
- Rozbaliteľné vysvetlenie výpočtu.
- Bez nového finančného modelu.

## v2.46.0 – Finančný kalendár

- Najbližšie platby a príjmy na 31 dní.
- Súhrn Príde / Odíde / Rozdiel.
- Používa existujúce plány a udalosti.
- Bez zmeny finančných výpočtov.

## v2.45.0 – Čo je dobré vedieť

- Najviac 3 dôležité mesačné informácie.
- Jednoduchšie texty.
- Bez zmeny finančných výpočtov.

## v2.44.6 – Presnosť starších mesiacov

- Flow spätne doplní chýbajúce porovnania pre staršie uzavreté mesiace.
- Pre každý mesiac používa iba dáta dostupné pred jeho začiatkom.
- Nové mesiace naďalej používajú plán reálne uložený počas mesiaca.
- V UI sa používa ľudské označenie `uložené počas mesiaca` alebo `spätne dopočítané`.
- Bez zmeny samotných Budget/Forecast algoritmov.

## v2.44.5 – Closed Month Plan Accuracy

- Presnosť plánu sa zobrazuje priamo v kartách uzavretých mesiacov.
- Aktuálny mesiac automaticky archivuje live Budget/Forecast snapshot.
- Po uzavretí sa Budget a Forecast porovnajú so skutočnými výdavkami z transakcií.
- Ak práve uzavretému mesiacu snapshot chýba, Flow doplní walk-forward porovnanie na pozadí.
- Forecast/Budget algoritmy sa nemenia.

## v2.44.4 – Annual Plan & Analytics UX

### Ročný plán
- Dominantný výsledok je očakávaný ročný zostatok.
- Budget, forecast a príjem sú sekundárne kompaktné metriky.
- Model, backtest a presnosť sú schované pod `Ako vzniká ročný plán`.
- Existujúce mesačné karty, klikateľné mesiace, percentá zhody a detail kategórií zostávajú zachované.

### Analytika
- Jedna dominantná suma + najväčšia kategória.
- Počet transakcií a priemer sú pod `Ďalšie štatistiky`.
- Dynamický nadpis grafu vysvetľuje, na akú otázku graf odpovedá.
- Pôvodné filtre, typ grafu, kategórie/podkategórie a Výdavky/Príjmy/Bilancia zostávajú funkčne nezmenené.

### Bezpečnosť regresie
- Bez zmeny: Budget, transakcie, synchronizácia, kategórie, Cockpit, GAS a forecast výpočty.
- Zmeny v `planning.js` a `analytics.js` sú iba render/UI vrstva.

## v2.44.3 — Budget & Tempo míňania UX
- Budget: dominantný mesačný overview, čerpanie a zostávajúca suma.
- Kategórie: na prvý pohľad iba minuté / budget, percento čerpania, zostáva a stav.
- Forecast, confidence a sekundárne metriky sú pod progressive disclosure.
- Burn Rate je v UI premenovaný na Tempo míňania; technické ovládanie grafu je pod Detail analýzy.
- Existujúce ID filtrov, event handlery a analytické výpočty zostávajú zachované.
- Sync, kategórie, transakcie, Planning, Income Engine a GAS bez zmien.

## v2.44.2 — UI Simplification
- Financial Cockpit má jednu dominantnú metriku: očakávaný zostatok.
- Minuté, Forecast a Safe to Spend sú kompaktné sekundárne metriky.
- Menej používané údaje sú pod natívnym rozbaľovacím `Detail mesiaca` (progressive disclosure).
- Filter panel Transakcií je vizuálne zjednotený bez zmeny jeho logiky alebo event handlerov.
- Farebnosť je obmedzená na stavové informácie; bežné údaje zostávajú neutrálne.
- Budget, Forecast, Planning, sync, kategórie, transakcie, Income Engine a GAS sú bez funkčných zmien.

## v2.44.1 — Safe to Spend 2.0 + Cockpit Placement
- Finančný cockpit je presunutý nad filtre na obrazovke Transakcie, aby nebol vložený medzi filtre a zoznam transakcií.
- Pridaný read-only blok `Safe to Spend`: voľný budget do konca aktuálneho mesiaca, orientačný denný limit a 7-dňový limit.
- Safe to Spend priamo používa existujúcu rezervu `Budget − Forecast`; nepridáva nový finančný model ani nové odpočty.
- Denný a 7-dňový údaj sú iba rozpočítaním tejto existujúcej rezervy na zostávajúci čas mesiaca.
- Safe to Spend je iba prezentačný odvodený údaj; nič nezapisuje a nemení Budget, Forecast, Annual Plan, transakcie, recurring plány ani synchronizáciu.
- Budget modul, Forecast model, Income Engine, kategórie a GAS zostávajú funkčne bez zmien.

## v2.44.0 — Financial Cockpit
- Pridaný read-only Finančný cockpit na obrazovku Transakcie.
- Zobrazuje existujúce metriky: minuté doteraz, forecast mesiaca, rezervu podľa forecastu a očakávaný zostatok.
- Cockpit používa existujúci `getBudgetDataset()` a `buildBudgetInsights()`; nevytvára nový forecast ani nemení výpočty.
- Pri výbere viacerých mesiacov sa mesačné KPI zámerne nezlučujú.
- Budget, Annual Plan, Forecast model, Income Engine, kategórie, synchronizácia a GAS ostávajú funkčne nezmenené.

# Flow – CHANGELOG

## v2.43.5 – Category Data Protection

- Po vymazaní cache/cookies sa kategórie už neinicializujú generickými defaultmi ako autoritatívne dáta.
- Aplikácia pred prvým zápisom po strate lokálneho stavu vždy načíta cloudový baseline.
- Známy generický starter set je na klientovi aj v GAS natrvalo blokovaný pre zápis do Google Sheets.
- Posledná potvrdená sada kategórií je zabudovaná iba ako bezpečný recovery fallback; cloud má pri normálnej prevádzke prioritu.
- Legacy kategórie bez `uid` dostávajú deterministické stabilné ID, takže cache clear nemení väzby `categoryId`.
- GAS v2.43.5 pridáva `categories_meta` s cloudovou verziou a pred každou reálnou zmenou uloží predchádzajúcu konfiguráciu do `CategoriesBackup` (max. 100 snapshotov).
- Pri konflikte sa lokálna verzia už slepo neopakuje; najprv sa znovu načíta serverová verzia.
- Budget modul, forecast model `2.42.0-category-champions-v1` a Income Engine zostávajú bez zmien.

## v2.43.4 – Closed Month Historical Values

- Pri uzavretom mesiaci sú explicitne zobrazené tri hodnoty: `Budget`, `Forecast`, `Skutočné výdavky`.
- Budget zobrazuje aj rezervu alebo prekročenie voči skutočným výdavkom.
- Forecast zobrazuje absolútnu odchýlku od skutočných výdavkov.
- Percentuálna zhoda Budget/Forecast zostáva ako sekundárne vyhodnotenie pod sumami.
- Skutočné výdavky sa naďalej berú zo zapísaných transakcií.
- Budget modul, forecast model, Income Engine a GAS bez zmeny.

## v2.43.3 – Plan vs. Reality

### Uzavreté mesiace
- Skutočné výdavky sa berú priamo zo zapísaných transakcií.
- Pridaná `Budget – zhoda` v % voči skutočným výdavkom.
- Pridaná `Forecast – zhoda` v % voči skutočným výdavkom.
- 100 % znamená presnú zhodu; percento klesá podľa absolútnej odchýlky.
- Preferujú sa reálne uložené snapshoty plánu/forecastu; ak nie sú dostupné, použije sa historický backtest a UI to označí.
- Ak nie je dostupný žiadny dôveryhodný podklad, percento sa nevymýšľa.

### Aktuálny mesiac
- `Z budgetu vyčerpané` = skutočné výdavky doteraz / mesačný budget.
- `Z forecastu dosiahnuté` = skutočné výdavky doteraz / aktuálny forecast výdavkov.
- Zobrazuje sa aj percento uplynutej časti mesiaca ako kontext.
- Hodnoty nad 100 % sú explicitne označené.

### Model / backend
- Budget modul ostáva nezmenený oproti v2.43.2/v2.43.1.
- Forecast model ostáva `2.42.0-category-champions-v1`.
- Income Engine sa nemení.
- Google Apps Script zostáva v2.38.8.

## v2.43.2 – Annual Plan Clarity & Navigation

- Uzavretý mesiac: `Skutočné výdavky`, `Skutočný príjem`, `Konečný zostatok`.
- Aktuálny mesiac: `Mesačný budget`, `Minuté doteraz`, `Forecast výdavkov`, `Očakávaný príjem`, `Očakávaný zostatok`.
- Budúci mesiac: `Mesačný budget`, `Forecast výdavkov`, `Plánovaný príjem`, `Očakávaný zostatok`.
- Odstránená nejasná veľká suma bez popisu.
- 12-mesačný prehľad je klikateľný a naviguje na konkrétny mesiac.
- Každá karta mesiaca má `↑ Prehľad` pre návrat k 12-mesačnému prehľadu.
- Budget modul, forecast model, Income Engine a GAS bez zmeny.

## v2.43.1 – Budget Regression Fix

### Oprava
- `assets/js/budget.js` je obnovený **byte-for-byte z v2.42.6**, teda z poslednej overenej verzie pred UX zásahom v2.43.0.
- Odstránené experimentálne zoradenie Budget kategórií podľa rizika.
- Odstránené experimentálne Budget risk-statusy z v2.43.0.
- Budget forecast, recommended budget, spent, safe-to-spend a kategóriové výpočty sa opäť správajú identicky ako vo v2.42.6.

### Zachované z v2.43.0
- 12-mesačný UX prehľad v Ročnom pláne.
- UI/accessibility zlepšenia, focus stavy a reduced-motion.

### Model / backend
- Forecast model ostáva `2.42.0-category-champions-v1`.
- Income Engine sa nemení.
- Google Apps Script zostáva v2.38.8.

## v2.43.0 – UX System Pass

- Ročný plán: 12-mesačný prehľad zostatkov s rýchlou navigáciou.
- Budget: kategórie zoradené podľa rizika a tempa míňania.
- Stavy: V poriadku / Sleduj / Riziko / Nad plánom.
- Zjednotená semantika farieb, focus stavy a reduced-motion.
- Forecast model, Income Engine a Google Apps Script sa nemenia.

## v2.42.6 – Annual Plan Category Cards

### Ročný plán
- Kategórie v detaile mesiaca používajú nový profesionálny card layout.
- Každá karta má jasnú hierarchiu `Budget → Forecast → Zostáva`.
- Stav kategórie je označený textom `Rezerva`, `Tesne pri limite` alebo `Nad plánom`.
- Tenký progress indikátor ukazuje podiel forecastu voči budgetu.
- Zostatok zostáva semanticky zelený/červený/neutrálny a farba nie je jediným nosičom významu.
- Mobilný a dark-mode layout bol doladený.

### Ostatné
- Zachované existujúce UI Budgetu z v2.42.5.
- Forecast model, Income Engine a Google Apps Script sa nemenia.

## v2.42.5 – Category Balance UX

### Budget
- `Budget`, `Minuté` a `Forecast` zostávajú kompaktné porovnávacie metriky.
- `Zostáva` je samostatný výsledkový pás s vyššou vizuálnou prioritou.
- Plus = `Rezerva v kategórii`, mínus = `Nad plánom`.
- Kladná hodnota používa jemnú zelenú semantiku, záporná červenú, nula neutrálnu.

### Ročný plán
- V detaile mesiaca má každá kategória nový `Zostáva = Budget − Forecast`.
- Na mobile sa výsledok presúva na vlastný riadok.

### UI/UX
- Vstupy a výsledok sú vizuálne oddelené, takže používateľ vie rýchlejšie skenovať kategórie.
- Farba je iba podporný signál; význam ostáva čitateľný z textu a znamienka.
- Rozloženie je optimalizované pre mobilné displeje.

### Model / backend
- Forecast model ostáva `2.42.0-category-champions-v1`.
- Income Engine sa nemení.
- Google Apps Script zostáva v2.38.8.

## v2.42.4 – Balance UI/UX Hierarchy

### Budget
- `Safe to spend` používa zelenú/červenú/neutrálnu semantiku podľa výsledku.
- Karta zobrazuje aj textový stav `V pluse`, `V mínuse` alebo `Na nule`.
- `Zostáva` pri každej kategórii má jemné semantické pozadie, border a farebnú hodnotu.

### Ročný plán
- `Očakávaný zostatok` používa rovnakú semantiku ako Budget.
- Mesačný `Zostatok` je zvýraznený jemným zeleným/červeným/neutrálnym povrchom.

### UI/UX
- Farba nie je jediný nosič informácie.
- Výsledok ostáva dominantný, farebná plocha je iba jemná podpora.
- Light a dark mode majú samostatne nastavený kontrast.
- Použité sú tabular numerals pre stabilnejšie porovnanie finančných hodnôt.

### Model / backend
- Forecast model ostáva `2.42.0-category-champions-v1`.
- Income Engine sa nemení.
- Google Apps Script zostáva v2.38.8.

## v2.42.3 – Signed Result Colors + Changelog

### UI
- Plusové výsledky v Budgete a Ročnom pláne sú zelené.
- Mínusové výsledky sú červené.
- Nulové výsledky zostávajú neutrálne.
- Pravidlo sa používa pre `Safe to spend`, zostávajúci budget, mesačný zostatok a očakávaný ročný zostatok.
- Farby majú samostatný kontrast pre light a dark mode.

### Changelog
- Doplnená chýbajúca položka v2.42.2 aj do changelog modalu v aplikácii.

### Model / backend
- Forecast model sa nemení (`2.42.0-category-champions-v1`).
- Income Engine sa nemení.
- Google Apps Script zostáva v2.38.8.

## v2.42.2 – Dark Mode Contrast Fix

### Fixed
- Ročný plán už v dark mode nepoužíva biele karty s bielym textom.
- Budget a Ročný plán používajú spoločné theme premenné pre povrch, text a border.
- Dynamicky renderované mesačné karty, hero karty, mini-karty a tlačidlá majú v dark mode vynútený správny kontrast.
- Pridaný cache-busting pre `styles.css`, aby mobil/PWA nezostal na starom CSS po aktualizácii.
- Forecast ani Income Engine sa nemenia.

## v2.42.1 – Dark Mode Readability

### Fixed
- Kompletná čitateľnosť tabu **Budget** v dark mode.
- Tmavé povrchy, texty, štatistiky, forecast riadky, insighty a vysvetlenie výpočtu používajú kontrastné dark-mode farby.
- Kompletná čitateľnosť tabu **Ročný plán** v dark mode.
- Opravené hero karty, mesačné karty, mini štatistiky, plánovacie udalosti, tlačidlá a výber roku.
- Dark mode funguje pri systémovom `prefers-color-scheme: dark` aj pri explicitnej `.dark` triede.

### Unchanged
- Forecast model zostáva **2.42.0-category-champions-v1** – nový backtest nie je potrebný.
- Income Engine zostáva bez zmeny.
- Google Apps Script zostáva v2.38.8.

---

## v2.42.0 – Category Champions

### Forecast / model selection
- Výdavkový selector už nevyberá championa samostatne pre každý kalendárny mesiac.
- Každá kategória má stabilného category championa odvodeného z doterajších walk-forward scenárov.
- Challenger môže category prior nahradiť iba pri jasnom zlepšení: 8 % pri menšej vzorke, 5 % pri 36+ validačných obdobiach.
- Do kandidátov sa vrátil `multi-year-trend`, založený na overenom multi-year level + seasonality + trend modeli z v2.38.2.
- Odstránené je mesačné prepínanie modelov, ktoré mohlo pri riedkych kategóriách viesť k preučeniu.
- Champion cache/model state je teraz viazaný na kategóriu, nie na kategóriu + mesiac.

### Scenario archive
- Priory pre kategórie boli nastavené podľa doterajších archivovaných walk-forward experimentov.
- Stabilné a dobre podložené výsledky majú prednosť pred malou vzorkou s náhodne nízkou chybou.
- Kategórie s nedostatkom dát používajú konzervatívny adaptívny fallback.

### Income Intelligence
- **Bez zmeny oproti v2.41.0.**
- Income WAPE / MAE / Bias / Accuracy zostávajú zachované.
- Pravidelný príjem má naďalej prednosť pred historickým forecastom rovnakého zdroja.

### Google Apps Script
- **Bez zmeny backendu.** Zostáva Google Apps Script v2.38.8.

### Unchanged
- Pravidelné platby sa generujú maximálne 12 mesiacov dopredu.
- Forecast Archive zostáva cloud-first.
- Rýchly filter kategórií/podkategórií zostáva iba v Transakciách.
- Filtre rokov v Grafoch a Burn Rate zostávajú zachované.
- Existujúci sync indikátor/UI sa nemení.

---

## v2.41.0 – Meta Forecast + Income Intelligence

### Forecast / model selection
- Champion výber teraz zohľadňuje nielen kategóriu, ale aj **kalendárny mesiac**.
- Mesačný výkon kandidátov sa aktivuje až po minimálne 2 historických pozorovaniach a je tlmený smerom ku kategóriovému skóre (`n / (n + 8)`), aby sa model nepreučil na malej vzorke.
- Live výber používa jeden online validačný stav na kategóriu a dátový cutoff; všetkých 12 mesiacov z neho číta lacno bez opakovaného kompletného backtestu.
- Model state je viazaný na verziu forecast modelu, takže staré champion výsledky sa po upgrade nepoužijú omylom.

### Income Intelligence
- Pôvodný príjmový forecast (jednoduchý priemer posledných kladných mesiacov) bol nahradený modelom podľa **zdrojov/podkategórií príjmu**.
- Stabilné príjmy používajú robustný recent level, obmedzený trend a jemný same-month sezónny signál.
- Variabilné a riedke príjmy používajú pravdepodobnosť výskytu a typickú sumu; pri nízkej pravdepodobnosti sa nepredikujú ako istý príjem.
- Nulové mesiace sa už pri nepravidelných príjmoch neignorujú.
- Pravidelný príjem z plánu nahrádza historický forecast rovnakého zdroja, čím sa odstraňuje možné dvojité započítanie výplaty.
- Pri aktuálnom mesiaci Flow zohľadní už evidovaný príjem a predikuje iba zostávajúcu časť.

### Recurring
- Tab Pravidelné podporuje aj **pravidelný príjem** (napr. výplata).
- Pravidelná položka má typ Výdavok / Príjem a podkategóriu/zdroj.
- Automatické transakcie zostávajú striktne limitované na maximálne **12 mesiacov dopredu**.

### Backtest / diagnostics
- Walk-forward backtest od tejto verzie archivuje aj samostatný mesačný záznam `__INCOME__`.
- Diagnostika zobrazuje **Income WAPE, Income MAE, Income Bias a orientačnú accuracy** oddelene od výdavkov.
- Live snapshoty príjmu sa ukladajú do Forecast Archive, ale neovplyvňujú walk-forward metriky.

### Experiment data
- Pri návrhu meta výberu boli použité doterajšie archivované forecast scenáre. Na priamo porovnateľných historických záznamoch bolo vidieť, že žiadna jedna modelová verzia nie je najlepšia pre všetky kategórie a mesiace.
- Experimentálny selector kategória + kalendárny mesiac znižoval historické WAPE oproti najlepšiemu samostatnému modelu; preto sa tento signál pridáva konzervatívne a so shrinkage.

### Google Apps Script
- **Bez zmeny backendu.** Zostáva Google Apps Script v2.38.8.

### Unchanged
- Forecast Archive zostáva cloud-first.
- Rýchly filter kategórií/podkategórií zostáva iba v Transakciách.
- Filtre rokov v Grafoch a Burn Rate zostávajú zachované.
- Existujúci sync indikátor/UI sa nemení.

---

## v2.40.0 – Champion / Challenger Forecast

### Added
- Forecast pre každú kategóriu automaticky testuje viac kandidátnych modelov na historických dátach.
- Kandidáti: pôvodný adaptívny model, recent robust, rovnaký mesiac, sezónne okno ±1 mesiac, minulý rok, sezónny index, kalendár udalostí a nulový baseline.
- Champion sa vyberá samostatne pre každú kategóriu pomocou walk-forward validácie bez použitia budúcich dát.
- Do Forecast Archive sa ukladajú aj informácie o zvolenom championovi, validačnom WAPE, Budget WAPE a zlepšení oproti baseline.
- Diagnostika zobrazuje presnosť podľa konkrétne zvoleného champion modelu.

### Safety / Model governance
- Challenger musí zlepšiť validačné skóre aspoň o **3 %**, inak zostáva pôvodný adaptívny model.
- Nulový baseline sa nepoužije iba preto, že kategória je riedka; ak nie je materiálne lepší, prednosť dostane zmysluplný nenulový model.
- Výber modelu používa maximálne posledných 24 validačných období a minimálne 12 mesiacov tréningovej histórie.
- Model sa vyberá iba z údajov dostupných pred predpovedaným obdobím.

### Performance
- Champion výber sa cacheuje podľa kategórie a dátového cutoffu.
- Pri zmene transakcií sa cache automaticky invaliduje.
- Historický backtest používa lineárny online champion výber namiesto opakovaného prepočítania celej validačnej histórie.
- Historický backtest priebežne uvoľňuje event loop, aby mobilné UI počas výpočtu nezamrzlo.
- Ročný plán už neprepočítava forecast pre uzavreté mesiace; používa skutočné Actual hodnoty a model počíta iba aktuálny/budúci horizont.

### Model
- Nová verzia modelu: `2.40.0-champion-challenger-v1`.
- Výsledky sa archivujú oddelene od v2.39.0, takže sa dajú priamo porovnať.

### Google Apps Script
- **Bez zmeny backendu.** Zostáva Google Apps Script v2.38.8.

### Unchanged
- Cloud-first Forecast Archive zostáva zachovaný.
- Pravidelné platby sa stále generujú maximálne 12 mesiacov dopredu.
- Rýchly filter kategórií/podkategórií zostáva iba v Transakciách.
- Filtre rokov v Grafoch a Burn Rate zostávajú zachované.

---

## v2.39.0 – Category-Adaptive Forecast

### Added
- Automatická klasifikácia kategórií na **stabilné/husté**, **variabilné**, **riedko sezónne** a **nepravidelné/intervalové**.
- Riedko sezónny model používa pravdepodobnosť výdavku v konkrétnom období a typickú sumu udalosti.
- Nepravidelný model využíva typickú medzeru medzi udalosťami (hazard/intermittent princíp) a kalendárnu pravdepodobnosť.
- Forecast už pri riedkych kategóriách nerozlieva veľký jednorazový alebo ročný výdavok rovnomerne do všetkých mesiacov.
- Budget pri neistých udalostiach používa pravdepodobnostnú rezervu, zatiaľ čo forecast sa snaží vyjadriť najpravdepodobnejší mesačný scenár.
- Diagnostika presnosti podľa použitého forecast modelu.
- Priamo v diagnostike je vysvetlenie WAPE, MAE a Bias.

### Improved
- Sezónny model toleruje posun udalosti približne o jeden mesiac medzi rokmi.
- Novšie historické udalosti majú vyššiu váhu pri odhade typickej sumy.
- Trend sumy udalosti je obmedzený, aby jeden extrémny rok nespôsobil prudký skok forecastu.
- Roky s menej než 24 backtestov sú v diagnostike označené ako **málo dát**.

### Analytics / Backtest
- Nová verzia modelu: `2.39.0-category-adaptive-v1`.
- Backtest sa archivuje oddelene od starších modelov, takže je možné objektívne porovnať výsledok s v2.38.8.
- Do diagnostických vstupov sa ukladajú aj typ modelu, pravdepodobnosť udalosti, aktivita kategórie, koncentrácia sezónnosti a typická medzera medzi udalosťami.

### Google Apps Script
- **Bez zmeny backendu.** Používa sa existujúci Google Apps Script v2.38.8.

### Unchanged
- Cloud-first Forecast Archive zostáva zachovaný.
- Pravidelné platby sa stále generujú maximálne 12 mesiacov dopredu.
- Rýchly filter kategórií/podkategórií zostáva iba v Transakciách.
- Filtre rokov v Grafoch a Burn Rate zostávajú zachované.

---

## v2.38.8 – Cloud-first Forecast Archive

### Fixed
- Opravené zlyhanie `QuotaExceededError` pri spustení „Vyhodnotiť históriu“.
- Celý forecast archív sa už neukladá do `localStorage`; zdrojom pravdy je Google Sheets.
- Pri štarte sa odstráni starý veľký lokálny kľúč `flow_forecast_archive_v235`, čím sa uvoľní miesto v prehliadači.
- Načítanie planning dát sťahuje iba archív aktuálnej verzie forecast modelu, nie všetky historické modely.

### Performance
- Menší objem dát v localStorage.
- Menší planning payload z Google Apps Script pri viacerých verziách modelu.
- Backtest zostáva dávkovaný po blokoch a po uložení funguje diagnostika z dát načítaných v pamäti.

### Google Apps Script
- **Vyžaduje aktualizáciu backendu** na `Flowapp-Google-Apps-Script-v2.38.8.gs`.

---

## v2.38.7 – Backtest Repair & Reliable Archive Sync

### Fixed
- Opravené vyhodnotenie histórie po prechode na model 2.38.6.
- Backend teraz ukladá príznak `backtest: walk-forward`, takže sa historické výsledky po opätovnom načítaní nestratia z metrík.
- Staré neúplné archívne riadky už neblokujú vytvorenie nového korektného backtestu.
- Vyhodnotenie histórie zobrazuje priebeh a chybu namiesto tichého zlyhania.
- Historické predikcie sa do Google Sheets odosielajú v dávkach po 100 riadkoch.

### Google Apps Script
- **Vyžaduje aktualizáciu backendu** na `Flowapp-Google-Apps-Script-v2.38.7.gs`.
- `FlowForecastArchive` dostáva doplnkové stĺpce pre backtest a sezónnu diagnostiku. Existujúce dáta zostávajú zachované.

### Unchanged
- Adaptive seasonal forecast z v2.38.6 zostáva zachovaný.
- Limit pravidelných platieb maximálne 12 mesiacov dopredu zostáva nezmenený.

## v2.38.6 – Adaptive Seasonal Forecast

### Added
- Adaptívny sezónny forecast pre silne sezónne kategórie.
- Pri kategóriách, ktoré sa opakujú v rovnakom mesiaci naprieč rokmi, model kombinuje celkový trend so skutočnými hodnotami rovnakého mesiaca.
- Meranie `seasonalOccurrence`, `seasonalStrength` a priameho historického sezónneho odhadu.
- Aktuálny changelog priamo v aplikácii cez ikonu ⓘ vpravo hore.

### Improved
- Silná sezónnosť dostáva vyššiu váhu iba vtedy, keď sa opakuje vo viacerých rokoch.
- Jednorazový výkyv v jednom roku má menšiu šancu skresliť budúci forecast.
- Riedke sezónne kategórie sa menej „rozlievajú“ do mesiacov, v ktorých sa historicky takmer nevyskytovali.

### Unchanged
- Google Apps Script sa v tejto verzii nemení.
- 12-mesačný limit generovania pravidelných platieb zostáva zachovaný.
- UI Ročného plánu a diagnostiky zostáva zachované.

---

## v2.38.5 – Forecast Diagnostics & Annual Plan Mobile Fix

### Added
- Detailná diagnostika presnosti forecastu priamo z Ročného plánu.
- Vyhodnotenie presnosti podľa kategórie, mesiaca, roku a typu výdavkov.
- Zobrazenie WAPE, Budget WAPE, MAE a biasu v diagnostike.
- Rebríček kategórií s najväčším priestorom na zlepšenie aj najpresnejších kategórií.
- Klik na riadok metrík otvorí detail diagnostiky.
- Po „Vyhodnotiť históriu“ sa po dokončení automaticky otvorí diagnostika.

### Fixed
- Metriky presnosti už používajú iba unikátne walk-forward backtesty.
- Priebežné live snapshoty sa už nezapočítavajú do WAPE, takže jeden mesiac nemôže dostať vyššiu váhu len preto, že bol archivovaný viackrát.
- „Vyhodnotiť históriu“ funguje aj vtedy, keď už netreba doplniť nové historické riadky – obnoví vyhodnotenie a zobrazí diagnostiku.
- Horné karty Ročného plánu sa na mobile zobrazujú 2 × 2; štvorstĺpcové rozloženie sa zapína až od šírky 900 px.
- Čísla v horných kartách majú bezpečnejšie responzívne rozmery a neprekrývajú susedné karty.

### Performance
- Diagnostika sa počíta až po otvorení detailu; nezvyšuje náklady bežného vykreslenia Ročného plánu.
- Základné metriky používajú deduplikovaný backtestový dataset.

### Unchanged
- Forecast matematika modelu `2.38.2-multi-year-walkforward` sa v tejto verzii nemení. Najprv meriame, ktoré kategórie a obdobia spôsobujú chybu.
- Google Apps Script netreba kvôli v2.38.5 meniť.
- Pravidelné platby zostávajú limitované na maximálne 12 mesiacov dopredu.
- Rýchly filter kategórií/podkategórií zostáva iba v Transakciách.
- Filtre rokov v Grafoch a Burn Rate zostávajú zachované.

---

## v2.38.4 – Year Filters
- Pridaný samostatný filter roku pre Grafy a Burn Rate.
- Roky sa generujú dynamicky z databázy + aktuálny rok a minimálne jeden rok dopredu.
- Grafy a Burn Rate už nie sú závislé od roku zvoleného v Transakciách.

## v2.38.3 – Category & Subcategory Filters
- Rýchly filter kategórií/podkategórií je iba v Transakciách.
- Opravené prepínanie kategórie a podkategórie a ich spoločné filtrovanie.

## v2.38.2 – Multi-year Forecast & Backtest
- Multi-year forecast, dynamické historické roky a walk-forward backtest.
- Optimalizovaný index transakcií.
- Forecast archív a historické metriky.
- Pravidelné platby maximálne 12 mesiacov dopredu.
