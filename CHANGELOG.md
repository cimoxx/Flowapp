# Flow – CHANGELOG

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
