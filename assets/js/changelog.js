/* Flow changelog - jediný zdroj pre okno "Changelog" v aplikácii.
 * Nové verzie pridávaj cez: python3 tools/bump_version.py <verzia> --title "..." --note "..." --note "..."
 * (skript zároveň prepíše assets/js/version.js a CHANGELOG.md). */
const FLOW_CHANGELOG = /*ENTRIES*/[
  {
    "version": "2.50.1",
    "title": "Kompaktná hlavička, nové karty pravidelných platieb, presnosť odhadu, jeden zdroj verzie",
    "items": [
      "Hlavička je nižšia a pri scrolle sa ešte zmenší. Nad sumou je napísané, čo číslo znamená (napr. Spolu · Okt 2026, Nové · Okt 2026). Suma používa jednotný formát meny.",
      "Pravidelné platby: klepnutie na kartu otvorí úpravu, ďalšie akcie (História 12 mes., Pozastaviť, Odstrániť) sú v menu ⋯. Karta ukazuje skutočný dátum ďalšej platby, zoznam je zoradený podľa najbližšej.",
      "Pozastavené pravidelné platby ostávajú viditeľné v sekcii Pozastavené a dajú sa obnoviť.",
      "Presnosť odhadu je v ľudskej reči (napr. Odhad sa v priemere líši o 57 %, typicky o 132 € na kategóriu za mesiac). Odborné metriky WAPE, MAE a bias sú v Detaile s jasnejšími názvami.",
      "Jeden zdroj verzie: assets/js/version.js. Číta ho aplikácia, nastavenia, changelog aj service worker (názov cache). Novú verziu zapíšeš cez python3 tools/bump_version.py <verzia> --note \"…\"."
    ]
  },
  {
    "version": "2.49.23",
    "items": [
      "Ročný plán: plánovaný príjem mesiaca sa dá ručne upraviť, voliteľne aj pre všetky nasledujúce mesiace roka, a kedykoľvek vrátiť na odhad modelu."
    ]
  },
  {
    "version": "2.49.22",
    "items": [
      "Z Ročného plánu je odstránená karta s tlačidlom „Aktualizovať odhad“; odhady sa prepočítavajú na pozadí ako doteraz."
    ]
  },
  {
    "version": "2.49.21",
    "items": [
      "Opravené chýbajúce pravidelné platby v novom mesiaci (kolízia so starými zmazanými záznamami z v2.49.15).",
      "Verzie v aplikácii, cache a changelogu sú zosúladené."
    ]
  },
  {
    "version": "2.49.19",
    "items": [
      "Ročný plán má tlačidlo „Aktualizovať odhad“ pre okamžitý nový výpočet výdavkov aj príjmov.",
      "Flow pri ručnom prepočte zneplatní forecast cache a znovu prejde aktuálne dáta.",
      "Odhad ukazuje čas posledného prepočtu a každá akcia má okamžitý feedback.",
      "Forecast algoritmus, Income Engine, Budget, recurring logika a GAS sa nemenia."
    ]
  },
  {
    "version": "2.49.18",
    "items": [
      "Plánované udalosti sa dajú plnohodnotne upravovať.",
      "Pri zmene údajov splnenej udalosti sa neplatná zhoda bezpečne zruší a udalosť sa vráti na Čaká.",
      "Udalosti sa dajú odstrániť cez potvrdenie; reálna transakcia zostáva nedotknutá.",
      "Editácia aj mazanie majú okamžitý feedback a lokálnu ochranu pri výpadku cloudu."
    ]
  },
  {
    "version": "2.49.17",
    "items": [
      "Plánované udalosti majú stav Čaká / Splnená.",
      "Flow hľadá podobnú reálnu transakciu podľa typu, sumy, dátumu, názvu a kategórie a ponúkne ju na kontrolu.",
      "Zhodu vždy potvrdí používateľ; Flow ju neuzavrie iba podľa odhadu.",
      "Splnená udalosť sa už druhýkrát nezapočíta do očakávaných príjmov alebo výdavkov.",
      "Každá zmena má okamžitý stav a toast feedback."
    ]
  },
  {
    "version": "2.49.16",
    "items": [
      "Ručne nastavený budget má trvalo prednosť pred modelom.",
      "Refresh už neprepíše novšiu lokálnu ručnú hodnotu staršou alebo chýbajúcou cloudovou hodnotou.",
      "Ak cloudové uloženie zlyhalo, Flow zachová ručný budget lokálne a pri ďalšom načítaní ho skúsi automaticky dopísať do FlowBudgetOverrides.",
      "Pri ukladaní je jasná spätná väzba o úspešnom alebo iba lokálnom uložení."
    ]
  },
  {
    "version": "2.49.15",
    "items": [
      "Pravidelné transakcie sa už nevytvárajú dopredu na ďalšie mesiace.",
      "Flow vytvorí iba výskyty patriace do aktuálne začatého mesiaca.",
      "Platby ďalšieho mesiaca vzniknú až po začatí nového mesiaca pri prvom otvorení alebo synchronizácii Flow.",
      "Staré automaticky vytvorené budúce RPOCC_ / tx_ transakcie sa bezpečne odstránia; ručné ID-* transakcie zostanú nedotknuté."
    ]
  },
  {
    "version": "2.49.14",
    "items": [
      "Pravidelná platba vie nájsť ručné historické transakcie za posledných 12 mesiacov.",
      "Používateľ sám potvrdí, ktoré transakcie patria k pravidelnému plánu.",
      "Označené transakcie dostanú isRecurring, frequency a recurringPlanId a synchronizujú sa do Sheet1.",
      "Forecast ich následne nepočíta ako variabilnú časť, takže sa pravidelná platba nezapočíta dvakrát."
    ]
  },
  {
    "version": "2.49.13",
    "items": [
      "Pridaná jednorazová oprava už existujúcich chybných pravidelných transakcií.",
      "Najprv urobí audit, potom povinnú cloudovú zálohu a až následne opraví metadata a odstráni potvrdené automatické duplicity.",
      "Bežné ID-* transakcie sa automaticky nemažú.",
      "Po oprave sa lokálna databáza zosúladí s cloudom, aby sa odstránené kópie nevrátili."
    ]
  },
  {
    "version": "2.49.12",
    "items": [
      "Opravené duplicity pravidelných transakcií po synchronizácii a úprave plánu.",
      "Sheet1 už uchováva isRecurring, frequency a recurringPlanId, takže príznak opakovanej platby po pull synchronizácii nezmizne.",
      "Každý plán a dátum má iba jednu generovanú transakciu; staré tx_* duplicity sa bezpečne zreconcilujú.",
      "Úprava sumy mení existujúce budúce transakcie namiesto vytvárania druhej kópie.",
      "Pridanie a editácia pravidelnej platby majú okamžitý feedback a optimistické UI."
    ]
  },
  {
    "version": "2.49.11",
    "items": [
      "Do aktuálneho mesiaca v Ročnom pláne sa vrátila karta Príjmy mesiaca.",
      "Zobrazuje prijaté príjmy, očakávaný príjem, ešte očakávanú sumu a progress bar.",
      "Samotný výpočet Ročného plánu zostáva presne zo stabilnej v2.49.2.",
      "Sync, HIST ochrana a GAS zostávajú bez zmeny."
    ]
  },
  {
    "version": "2.49.10",
    "items": [
      "Ročný plán bol kompletne vrátený na presný kód zo stabilnej v2.49.2, kde fungoval správne aj pre aktuálny rok.",
      "Odstránené všetky neskoršie zásahy do planning.js z v2.49.3 až v2.49.9.",
      "Synchronizácia a ochrana proti návratu HIST duplicít zostávajú z funkčnej v2.49.7.",
      "Budget, transakcie, kategórie a ostatné moduly sa nemenia."
    ]
  },
  {
    "version": "2.49.7",
    "items": [
      "Opravená synchronizácia nových transakcií po v2.49.6.",
      "Doplnené chýbajúce serverové funkcie pre ochranu HIST-* záznamov.",
      "Bežné ID-* transakcie už vôbec nečítajú tombstone hárok, takže ochrana historických duplicít nezasahuje do normálneho syncu.",
      "Ochrana proti návratu vyčistených HIST-* duplicít zostáva zachovaná."
    ]
  },
  {
    "version": "2.49.6",
    "items": [
      "Opravené opätovné vytváranie vyčistených HIST-* duplicít po synchronizácii.",
      "Po čistení sa odstránené historické ID vymažú aj z lokálnej databázy a sync fronty.",
      "Cloud si odstránené HIST-* ID pamätá v hárku FlowHistoricalTombstones a staré zariadenie ich už nemôže znovu nahrať.",
      "Budget, Forecast, Income Engine a Ročný plán zostávajú bez zmeny."
    ]
  },
  {
    "version": "2.49.5",
    "items": [
      "Kontrola dát už nezávisí od oprávnenia ScriptApp.",
      "Čistenie historických duplicít sa zablokuje pri čakajúcej synchronizácii alebo neoverenom cloude.",
      "Pred mazaním zostáva povinná kompletná cloudová záloha.",
      "Backend overuje počet čakajúcich zmien a nezmenený audit duplicít ešte pred čistením."
    ]
  },
  {
    "version": "2.49.4",
    "items": [
      "Bezpečné čistenie duplicitných historických riadkov v Sheet1.",
      "Pred čistením sa povinne vytvorí kompletná cloudová záloha; pri zlyhaní zálohy sa nič nemaže.",
      "Čistenie sa týka iba HIST-* riadkov s rovnakými finančnými údajmi.",
      "Budget, Forecast, Income Engine a Ročný plán sa nemenia."
    ]
  },
  {
    "version": "2.49.3",
    "items": [
      "Presnosť plánu v Ročnom pláne sa uchováva v samostatnom cloudovom hárku FlowPlanAccuracy.",
      "Pre každý mesiac sa uloží iba prvý plán/odhad a neskôr sa už neprepisuje.",
      "Existujúce historické porovnania sa bezpečne doplnia z ForecastArchive.",
      "Výpočet Ročného plánu, Income Engine, Budget a Forecast sa nemení."
    ]
  },
  {
    "version": "2.49.2",
    "items": [
      "Automatická záloha sa spustí v posledný deň každého mesiaca.",
      "Flow drží najviac 5 cloudových záloh; šiestou prepíše najstaršiu.",
      "V Nastaveniach vidíš, či je automatické zálohovanie zapnuté.",
      "Finančné výpočty ani synchronizácia sa nemenia."
    ]
  },
  {
    "version": "2.49.1",
    "items": [
      "Cloudová záloha už nepoužíva DriveApp; kópia sa vytvára priamo cez Google Sheets.",
      "Kontrola cloudu je ľahšia a nemení žiadne planning sheety.",
      "Pri chybe Flow zobrazí skutočnú odpoveď servera namiesto všeobecnej hlášky."
    ]
  },
  {
    "version": "2.49.0",
    "items": [
      "Opravený prázdny Rozpočet po v2.48.0.",
      "Centrum ochrany dát kontroluje základnú integritu dát.",
      "Cloudová záloha vytvorí kompletnú kópiu Google tabuľky a drží posledných 30 kópií.",
      "Pred importom JSON sa uloží lokálna bezpečnostná kópia.",
      "Finančný model, plánovanie a synchronizačná logika zostali nezmenené."
    ]
  },
  {
    "version": "2.48.0",
    "items": [
      "Prehľad mesiaca je jednoduchší: každé hlavné číslo sa zobrazuje iba raz.",
      "Rozpočet má jasnejšiu hierarchiu; podrobné odhady a ďalšie upozornenia sú zbalené do detailu.",
      "Technické názvy Budget/Forecast sú v používateľskom rozhraní nahradené výrazmi Rozpočet/Odhad.",
      "Analytika a Tempo míňania používajú jednotnejšie názvy filtrov.",
      "Finančné výpočty, transakcie, synchronizácia a kategórie zostali nezmenené."
    ]
  },
  {
    "version": "2.47.0",
    "items": [
      "Nová karta „Koľko ešte môžem minúť?“ dá jednoduchú odpoveď pre zvyšok mesiaca.",
      "Ukáže aj približnú dennú sumu a stav V pohode / Pozor na tempo / Treba ubrať.",
      "Detail vysvetlí výpočet bez technických výrazov.",
      "Pravidelné a naplánované výdavky zostávajú súčasťou existujúceho odhadu."
    ]
  },
  {
    "version": "2.46.0",
    "items": [
      "Nový prehľad „Najbližšie platby“ ukáže, čo príde a odíde v najbližších 31 dňoch.",
      "Zobrazuje pravidelné položky aj naplánované udalosti, ktoré už Flow pozná.",
      "Na prvý pohľad vidíš príjmy, výdavky a ich rozdiel.",
      "Existujúce finančné výpočty a synchronizácia zostali nezmenené."
    ]
  },
  {
    "version": "2.45.0",
    "items": [
      "Nová sekcia „Čo je dobré vedieť“ ukazuje najviac 3 dôležité informácie o mesiaci.",
      "Flow upozorní na riziko prekročenia rozpočtu, rýchle míňanie a očakávaný výsledok mesiaca.",
      "Texty sú krátke a zrozumiteľné.",
      "Finančné výpočty a synchronizácia zostali nezmenené."
    ]
  },
  {
    "version": "2.44.6",
    "items": [
      "Presnosť sa vie spätne doplniť aj pri starších uzavretých mesiacoch.",
      "Pri spätnom výpočte Flow používa iba údaje, ktoré boli dostupné pred daným mesiacom.",
      "Je jasne označené, či bol plán uložený počas mesiaca alebo spätne dopočítaný.",
      "Texty sú jednoduchšie: Rozpočet, Odhad a Skutočné výdavky."
    ]
  },
  {
    "version": "2.44.5",
    "items": [
      "Opravená presnosť plánu priamo v kartách uzavretých mesiacov.",
      "Aktuálny mesiac automaticky archivuje Budget/Forecast snapshot pre neskoršie porovnanie so skutočnosťou.",
      "Ak práve uzavretému mesiacu porovnanie chýba, Flow ho doplní walk-forward výpočtom na pozadí.",
      "Skutočné výdavky sa naďalej berú zo zapísaných transakcií."
    ]
  },
  {
    "version": "2.44.4",
    "items": [
      "Ročný plán teraz začína jedným hlavným výsledkom – očakávaným ročným zostatkom – a tri sekundárne sumy sú kompaktnejšie.",
      "Technické informácie o modeli a presnosti sú schované pod „Ako vzniká ročný plán“.",
      "Analytika používa jednu dominantnú sumu, najväčšiu kategóriu a ostatné štatistiky sú dostupné až po rozbalení.",
      "Nad grafom sa podľa dát zobrazuje otázka „Kam idú peniaze?“, „Odkiaľ prichádzajú príjmy?“ alebo „Ako vyzerá bilancia?“.",
      "Filtre, grafy, ročný plán, forecast, Budget, sync a backendová logika zostávajú funkčne nezmenené."
    ]
  },
  {
    "version": "2.44.3",
    "items": [
      "Budget má kompaktnejší mesačný overview a kategórie ukazujú najprv čerpanie a zostávajúcu sumu.",
      "Forecast a ďalšie sekundárne údaje sú dostupné pod Detail mesiaca / Detail kategórie.",
      "Burn Rate je v UI pomenovaný zrozumiteľnejšie ako Tempo míňania.",
      "Pokročilé ovládanie grafu je schované pod Detail analýzy, všetky pôvodné ovládače a eventy zostali zachované.",
      "Finančné výpočty, sync, kategórie, transakcie, Planning, Income Engine a GAS sa nemenia."
    ]
  },
  {
    "version": "2.44.2",
    "items": [
      "Zjednodušený Financial Cockpit: jedna dominantná metrika a tri rýchle údaje.",
      "Safe to Spend zostáva viditeľný, sekundárne metriky sú presunuté pod Detail mesiaca.",
      "Filtre Transakcií sú vizuálne zjednotené do jedného kompaktného panelu.",
      "Zjednotená typografická hierarchia a menej vizuálneho šumu v hornej časti Transakcií.",
      "Žiadne finančné výpočty, Budget, Forecast, sync, kategórie ani GAS sa nemenia."
    ]
  },
  {
    "version": "2.44.1",
    "items": [
      "Finančný cockpit je presunutý nad filtre Transakcií, aby tvoril jeden kompaktný úvod obrazovky.",
      "Pridaný read-only Safe to Spend 2.0: existujúca rezerva Budget − Forecast prepočítaná aj na orientačný denný a 7-dňový bezpečný priestor.",
      "Safe to Spend nevytvára nový finančný model; používa presne existujúci Budget/Forecast a iba zrozumiteľnejšie prezentuje jeho rezervu.",
      "Výpočet používa iba existujúce dáta a nemení Budget, Forecast, Annual Plan, transakcie ani synchronizáciu.",
      "Budget modul, forecast model, Income Engine, kategórie a GAS zostávajú funkčne bez zmien."
    ]
  },
  {
    "version": "2.44.0",
    "items": [
      "Na obrazovku Transakcie pribudol read-only Finančný cockpit pre rýchly obraz aktuálneho mesiaca.",
      "Ukazuje minuté doteraz, existujúci forecast, rezervu podľa forecastu a očakávaný zostatok.",
      "Pridáva jeden prioritný insight z existujúceho Budget insight enginu a rýchly vstup do detailu Budgetu.",
      "Pri výbere viacerých mesiacov sa cockpit nevypočítava, aby nemiešal mesačné metriky.",
      "Budget modul, forecast model, Annual Plan, Income Engine, synchronizácia kategórií a GAS zostávajú bez zmien."
    ]
  },
  {
    "version": "2.43.5",
    "items": [
      "Opravená ochrana kategórií po vymazaní cache/cookies: aplikácia najprv overí cloud a až potom dovolí zápis.",
      "Generický starter zoznam kategórií je natrvalo zablokovaný pre zápis do Google Sheets.",
      "Pridaný bezpečný recovery master s poslednou potvrdenou sadou kategórií a podkategórií.",
      "Kategórie bez uid dostávajú stabilné deterministické ID, takže sa po vymazaní cache nemenia väzby categoryId.",
      "Nový GAS v2.43.5 pridáva verziu cloudových kategórií a automatickú históriu v hárku CategoriesBackup pred každou zmenou.",
      "Budget modul, forecast model a Income Engine zostávajú bez zmien."
    ]
  },
  {
    "version": "2.43.4",
    "items": [
      "Pri uzavretom mesiaci sú teraz priamo viditeľné historické hodnoty Budget, Forecast a Skutočné výdavky.",
      "Budget karta ukazuje aj rezervu alebo prekročenie oproti realite.",
      "Forecast karta ukazuje absolútnu odchýlku od skutočných výdavkov.",
      "Percentuálna zhoda Budget/Forecast zostáva pod sumami ako sekundárna informácia.",
      "Budget modul, forecast model, Income Engine a GAS sa nemenia."
    ]
  },
  {
    "version": "2.43.3",
    "items": [
      "Uzavreté mesiace porovnávajú skutočné výdavky z transakcií s uloženým budgetom a forecastom.",
      "Pribudla percentuálna zhoda Budget vs. realita a Forecast vs. realita s vizuálnymi progress indikátormi.",
      "Aktuálny mesiac ukazuje, koľko % budgetu a forecastu už bolo reálne vyčerpaných.",
      "Čerpanie zobrazuje aj pomer uplynutej časti mesiaca pre lepší kontext.",
      "Ak historický plán nie je uložený, appka percento nevymýšľa a stav transparentne označí.",
      "Budget modul, forecast model, Income Engine a GAS sa nemenia."
    ]
  },
  {
    "version": "2.43.2",
    "items": [
      "Uzavreté mesiace teraz jasne zobrazujú skutočné výdavky, skutočný príjem a konečný zostatok.",
      "Aktuálny mesiac oddeľuje minuté doteraz od forecastu konca mesiaca; budúce mesiace sú jednoznačne označené ako plán.",
      "Veľká suma vpravo má vždy popis: Skutočné výdavky alebo Mesačný budget.",
      "12-mesačný prehľad je plne klikateľný, zvýrazňuje aktuálny mesiac a plynulo naviguje na kartu mesiaca.",
      "Každý mesiac má tlačidlo ↑ Prehľad pre okamžitý návrat hore.",
      "Budget modul, forecast model, Income Engine a GAS sa nemenia."
    ]
  },
  {
    "version": "2.43.1",
    "items": [
      "Opravený Budget po UX release v2.43.0.",
      "Celý výpočet a renderovanie Budgetu sú obnovené byte-for-byte z overenej v2.42.6.",
      "Odstránené experimentálne rizikové zoradenie a statusy, ktoré zasahovali do Budget renderovania.",
      "Ročný 12-mesačný UX prehľad a ostatné bezpečné UI zlepšenia v2.43.0 zostávajú.",
      "Forecast model, Income Engine a Google Apps Script sa nemenia."
    ]
  },
  {
    "version": "2.43.0",
    "items": [
      "Ročný plán: 12-mesačný prehľad zostatkov s navigáciou na konkrétny mesiac.",
      "Budget: kategórie prioritizované podľa rizika a tempa míňania.",
      "Nové stavy V poriadku / Sleduj / Riziko / Nad plánom.",
      "Zjednotená semantika farieb, focus stavy a reduced-motion.",
      "Forecast, Income Engine a Google Apps Script sa nemenia."
    ]
  },
  {
    "version": "2.42.6",
    "items": [
      "Kategórie v detaile Ročného plánu majú nový profesionálny card layout.",
      "Každá kategória zobrazuje Budget, Forecast a výrazný Zostatok v jednej čitateľnej hierarchii.",
      "Stav kategórie je označený ako Rezerva, Tesne pri limite alebo Nad plánom.",
      "Pribudol tenký progress indikátor čerpania budgetu; farba nie je jediný nosič informácie.",
      "Doladený mobilný a dark-mode layout. Forecast ani backend sa nemenia."
    ]
  },
  {
    "version": "2.42.5",
    "items": [
      "Zostatok kategórie je samostatný výsledkový pás pod Budget/Minuté/Forecast.",
      "Plus zobrazuje „Rezerva v kategórii“, mínus „Nad plánom“ s jemnou zelenou/červenou semantikou.",
      "V detaile mesiaca Ročného plánu má každá kategória vlastný zostatok Budget mínus Forecast.",
      "Mobilný layout presúva zostatok kategórie na samostatný riadok pre lepšiu čitateľnosť.",
      "Forecast, Income Engine a Google Apps Script sa nemenia."
    ]
  },
  {
    "version": "2.42.4",
    "items": [
      "Zostatky v Budgete a Ročnom pláne majú jednotnú semantiku: plus zelený, mínus červený, nula neutrálna.",
      "Výsledkové bunky majú jemné farebné pozadie a border bez zbytočného vizuálneho hluku.",
      "Hlavné zostatkové karty zobrazujú aj stav „V pluse“, „V mínuse“ alebo „Na nule“, takže informácia nestojí iba na farbe.",
      "Kontrast je doladený samostatne pre light a dark mode.",
      "Forecast model, Income Engine a Google Apps Script sa nemenia."
    ]
  },
  {
    "version": "2.42.3",
    "items": [
      "Plusové výsledky v Budgete a Ročnom pláne sú zelené, mínusové červené a nulové neutrálne.",
      "Farebné rozlíšenie sa používa pri Safe to spend, zostávajúcom budgete a mesačnom aj ročnom zostatku.",
      "Farby sú optimalizované pre light aj dark mode.",
      "Doplnený chýbajúci changelog v2.42.2.",
      "Forecast model, Income Engine a Google Apps Script sa nemenia."
    ]
  },
  {
    "version": "2.42.2",
    "items": [
      "Opravený kontrast dynamicky renderovaných kariet Budgetu a Ročného plánu v dark mode.",
      "Karty používajú spoločné theme premenné pre povrch, text a border.",
      "Pridaný cache-busting pre styles.css, aby PWA po aktualizácii nepoužila staré CSS.",
      "Forecast model, Income Engine a Google Apps Script sa nemenia."
    ]
  },
  {
    "version": "2.42.1",
    "items": [
      "Kompletná oprava čitateľnosti Budgetu v dark mode.",
      "Opravený Ročný plán v dark mode: hero karty, mesačné karty, štatistiky, udalosti, tlačidlá aj výber roku.",
      "Forecast model a Income Engine sa nemenia; nový backtest nie je potrebný.",
      "Google Apps Script sa nemení; zostáva backend v2.38.8."
    ]
  },
  {
    "version": "2.42.0",
    "items": [
      "Výdavkový forecast prešiel z výberu kategória + mesiac na stabilného championa pre každú kategóriu.",
      "Do kandidátov sa vrátil overený multi-year trend model z línie v2.38.2.",
      "Počiatoční championi boli nastavení podľa doterajšieho archívu walk-forward scenárov; challenger ich môže nahradiť iba pri jasnom a opakovanom zlepšení.",
      "Odstránené je agresívne mesačné prepínanie modelov, ktoré pri riedkych kategóriách spôsobovalo preučenie.",
      "Income Engine z v2.41.0 zostáva nezmenený.",
      "Google Apps Script sa nemení; zostáva backend v2.38.8."
    ]
  },
  {
    "version": "2.41.0",
    "items": [
      "Meta forecast pri výbere výdavkového modelu zohľadňuje aj konkrétny kalendárny mesiac; mesačné skóre je tlmené smerom ku kategóriovému, aby sa model nepreučil.",
      "Experimentálny archív scenárov bol použitý na nastavenie minimálnej vzorky a sily mesačného signálu.",
      "Nový Income Engine rozdeľuje príjmy podľa zdrojov/podkategórií a odlišuje stabilné, variabilné a riedke príjmy.",
      "Pravidelný príjem má prednosť pred historickým forecastom rovnakého zdroja, takže sa výplata nezapočíta dvakrát.",
      "Pravidelné plány teraz podporujú aj príjem (napr. výplatu) a stále generujú transakcie maximálne 12 mesiacov dopredu.",
      "Vyhodnotenie histórie archivuje a zobrazuje samostatné Income WAPE, MAE a Bias.",
      "Google Apps Script sa nemení; zostáva backend v2.38.8."
    ]
  },
  {
    "version": "2.40.0",
    "items": [
      "Champion/challenger engine testuje viac forecast modelov pre každú kategóriu.",
      "Challenger sa použije iba pri minimálne 3 % zlepšení oproti pôvodnému adaptívnemu baseline.",
      "Výber modelu je walk-forward a nepoužíva budúce dáta.",
      "Diagnostika ukazuje presnosť podľa konkrétne vybraného champion modelu.",
      "Backtest je optimalizovaný tak, aby počas výpočtu menej blokoval mobilné UI.",
      "Google Apps Script sa nemení; zostáva backend v2.38.8."
    ]
  },
  {
    "version": "2.39.0",
    "items": [
      "Forecast automaticky rozlišuje stabilné, variabilné, riedko sezónne a nepravidelné kategórie.",
      "Riedke sezónne výdavky používajú model pravdepodobnosti udalosti × typickej sumy namiesto rozlievania nákladu do celého roka.",
      "Nepravidelné výdavky používajú intervalový/hazard model, ktorý zohľadňuje typickú medzeru medzi udalosťami.",
      "Diagnostika ukazuje presnosť aj podľa použitého modelu a vysvetľuje WAPE, MAE a Bias.",
      "Roky s príliš malým počtom backtestov sa označia ako „málo dát“.",
      "Google Apps Script sa nemení; zostáva kompatibilný backend v2.38.8."
    ]
  },
  {
    "version": "2.38.8",
    "items": [
      "Forecast archív presunutý na cloud-first režim kvôli limitu localStorage.",
      "Planning načítava iba archív aktuálnej verzie modelu.",
      "Vyžaduje backend v2.38.8."
    ]
  },
  {
    "version": "2.38.7",
    "items": [
      "Opravené vyhodnotenie histórie a ukladanie walk-forward backtestu.",
      "Priebeh vyhodnotenia je viditeľný priamo na tlačidle.",
      "Archív sa do Google Sheets odosiela po dávkach."
    ]
  },
  {
    "version": "2.38.6",
    "items": [
      "Nový adaptívny sezónny forecast pre kategórie s výraznou sezónnosťou.",
      "Pri opakujúcich sa sezónnych kategóriách sa viac využíva história rovnakého mesiaca naprieč rokmi.",
      "Jednorazový sezónny výkyv sa už automaticky neopakuje v každom roku.",
      "Do backtest archívu sa ukladajú aj údaje o sile a opakovateľnosti sezónnosti.",
      "Changelog je aktualizovaný priamo v aplikácii pod ikonou ⓘ."
    ]
  },
  {
    "version": "2.38.5",
    "items": [
      "Pridaná diagnostika forecastu podľa kategórií, mesiacov, rokov a typu výdavkov.",
      "WAPE používa iba unikátne walk-forward backtesty.",
      "Opravené mobilné rozloženie súhrnných kariet Ročného plánu."
    ]
  },
  {
    "version": "2.38.4",
    "items": [
      "Pridaný samostatný filter roku pre Grafy a Burn Rate.",
      "Grafy, Burn Rate a Transakcie majú nezávislé filtre."
    ]
  },
  {
    "version": "2.38.3",
    "items": [
      "Rýchly filter kategórií a podkategórií sa zobrazuje iba v Transakciách.",
      "Opravené prepínanie kategórie → podkategórie a kombinované filtrovanie."
    ]
  },
  {
    "version": "2.38.2",
    "items": [
      "Multi-year forecast a korektný walk-forward backtest bez budúcich dát.",
      "Optimalizované indexovanie historických transakcií."
    ]
  }
]/*END*/;
