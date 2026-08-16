# Flow – CHANGELOG

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
