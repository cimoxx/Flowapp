# Flow v2.42.3

## Category Champions + Income Intelligence

Flow v2.42.1 vychádza z v2.42.0 a upravuje výdavkový forecast podľa výsledkov doterajších walk-forward scenárov. Hlavná zmena je jednoduchá:

**každá kategória má stabilného championa a model sa už agresívne neprepína podľa kalendárneho mesiaca.**

Income Engine z v2.41.0 zostáva nezmenený.

Aktuálny forecast model:

`2.42.0-category-champions-v1`

## Prečo sa zmenil výdavkový selector

Diagnostika v2.41.0 ukázala, že mesačný meta-selector vedel pomôcť niektorým kategóriám, ale pri riedkych a sezónnych kategóriách sa mohol preučiť na malej vzorke.

Doterajší archív scenárov preto slúži ako počiatočný prior pre jednotlivé kategórie. Flow následne priebežne kontroluje, či iný kandidát nie je výrazne lepší.

## Kandidátne modely

- legacy-adaptive
- recent-robust
- multi-year-trend
- same-month
- seasonal-window
- last-year
- seasonal-index
- event-calendar
- zero-baseline

`multi-year-trend` vracia do kandidátov overený multi-year level + seasonality + trend princíp z línie v2.38.2.

## Počiatoční category championi

Na základe doterajšieho experimentálneho archívu sú ako priory použité napríklad:

- Strava → recent robust
- Osobná starostlivosť → recent robust
- Domácnosť → multi-year trend
- Darčeky → multi-year trend
- Deti → multi-year trend
- Domáce zvieratá → multi-year trend
- Poistenie → minulý rok
- Dane → sezónny index
- Iné → recent robust

Pri kategóriách s nejednoznačným výsledkom alebo nízkou vzorkou zostáva konzervatívny adaptívny prior.

## Challenger pravidlá

Category prior nie je navždy zamknutý.

- minimálne 12 validačných období pred aktívnym challenger výberom,
- pri menšej vzorke musí challenger zlepšiť skóre aspoň o 8 %,
- pri 36+ validačných obdobiach stačí 5 %,
- nulový baseline má dodatočnú ochranu proti falošnému víťazstvu v riedkych kategóriách,
- výber používa iba walk-forward históriu dostupnú pred predikovaným obdobím.

## Income Engine

**Bez zmeny oproti v2.41.0.**

Príjmy sa naďalej:
- modelujú podľa zdrojov/podkategórií,
- delia na stabilné, variabilné a riedke,
- pri pravidelnom príjme používajú explicitný plán pred historickým odhadom,
- vyhodnocujú cez Income WAPE, MAE, Bias a Accuracy.

## Pravidelné platby

Automatické generovanie transakcií zostáva striktne limitované na **maximálne 12 mesiacov dopredu**.

## Nasadenie

1. Nahraj celý frontend v2.42.1 na GitHub Pages.
2. Google Apps Script nemeníš – zostáva backend v2.38.8.
3. Otvor Ročný plán.
4. Spusti Vyhodnotiť históriu.
5. Porovnaj Forecast WAPE s v2.41.0 a skontroluj sekciu presnosti podľa použitého modelu.
6. Income metriky by mali zostať približne na úrovni v2.41.0, pretože príjmový model sa nemenil.

Podrobnosti sú v `V2.42.0-IMPLEMENTACIA.md` a `CHANGELOG.md`.


## v2.42.1 Dark mode
- UI-only oprava čitateľnosti Budgetu a Ročného plánu.
- Forecast model ostáva `2.42.0-category-champions-v1`.
- Income Engine a Google Apps Script sa nemenia.
