# Historie verzí

Formát vychází z [Keep a Changelog](https://keepachangelog.com/cs/1.1.0/).

## [0.2.0] - ve vývoji

Z prohlížečky se stalo rozhraní. Přibyla navigace a všechno, co uživatel
potřebuje, aby nemusel otevírat Home Assistant.

### Přidáno

- Navigace s pěti sekcemi: Domů, Místnosti, Scény, Automatizace, Zařízení
- Nastavení aplikace v hlavičce
- Domovská obrazovka se souhrnem domu, upozorněními a rychlou akcí
- Panel s plným ovládáním: stmívání, teplota bílé, barva, poloha žaluzie,
  natočení lamel, termostat, zámek, rychlost ventilátoru, hlasitost
- Správa místností a pater - vytvořit, přejmenovat, přesunout, smazat
- Seznam zařízení po místnostech, detail, přejmenování, přiřazení do místnosti
- Přidání zařízení - nalezená zařízení a nejčastější integrace
- Scény a skripty: seznam, spuštění, uložení stavu místnosti jako scény, mazání
- Automatizace: seznam, zapnutí a vypnutí, ruční spuštění, mazání
- Šest šablon automatizací s průvodcem výběru zařízení
- Hluboké odkazy "Otevřít v Home Assistantu" na přesnou obrazovku
- Vlastní sada linkových ikon

### Rozšířeno

- Capability Engine zná žaluzie, termostaty, zámky, ventilátory, scény,
  skripty, automatizace, tlačítka, číselné vstupy, výběry, média a přítomnost
- Adaptér umí zapisovat do registrů a pracovat s config API

## [0.1.0]

První technický spike. Prokázal architekturu.

### Přidáno

- Instalace jako Home Assistant App z tohoto repozitáře
- Přístup přes Ingress, bez druhého hesla a bez otevřeného portu
- Home Assistant Adapter - WebSocket klient přihlášený Supervisor tokenem
- Načtení pater, místností, zařízení a entit
- Realtime sledování změn stavů
- Capability Engine pro světla, zásuvky, senzory a binární senzory
- Jednoduchý přehled místností
- Ovládání světel a zásuvek
