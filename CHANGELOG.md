# Historie verzí

Formát vychází z [Keep a Changelog](https://keepachangelog.com/cs/1.1.0/).

## [0.1.0] - ve vývoji

První technický spike. Prokazuje architekturu, není to hotový produkt.

### Přidáno

- Instalace jako Home Assistant App z tohoto repozitáře
- Přístup přes Ingress, bez druhého hesla a bez otevřeného portu
- Home Assistant Adapter - WebSocket klient přihlášený Supervisor tokenem
- Načtení pater, místností, zařízení a entit z Home Assistantu
- Realtime sledování změn stavů
- Capability Engine pro světla, zásuvky, senzory a binární senzory
- Jednoduchý přehled místností
- Ovládání světel a zásuvek
