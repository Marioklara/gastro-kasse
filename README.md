# Gastro Kasse

Einfache Web-App für ein Restaurant / Café / Imbiss.

## Ziel

Diese Kasse soll sehr einfach bedienbar sein:

- Produkt antippen
- Tisch eingeben
- Zahlart wählen
- Bon erstellen
- Tagesumsatz exportieren

Die App funktioniert auf:

- Handy
- Tablet
- Laptop
- PC

## Aktueller Stand

Das ist Version 1 als Prototyp.

Enthalten:

- `index.html`
- `style.css`
- `app.js`

## Start lokal

Einfach `index.html` im Browser öffnen.

## Auf GitHub hochladen

1. Neues Repository erstellen, z. B. `gastro-kasse`
2. Diese Dateien hochladen:
   - `index.html`
   - `style.css`
   - `app.js`
   - `README.md`
3. Danach kannst du GitHub Pages aktivieren.

## GitHub Pages aktivieren

1. Repository öffnen
2. Settings
3. Pages
4. Branch: `main`
5. Folder: `/root`
6. Save

Danach bekommst du eine Webseite wie:

`https://dein-name.github.io/gastro-kasse/`

## Wichtiger Hinweis zu TSE

Diese Version ist noch NICHT legal fertig für echten Restaurant-Betrieb in Deutschland.

Für echten Einsatz brauchst du:

- zertifizierte TSE
- GoBD-konforme Speicherung
- DSFinV-K Export
- korrekte Bon-Pflichtangaben
- keine nachträgliche Manipulation
- Prüfung durch Steuerberater oder Kassen-Fachfirma

## Swissbit TSE

Im Code gibt es schon Platzhalter:

- `startTseTransaction(order)`
- `finishTseTransaction(order, tseStart)`

Dort kann später Swissbit angebunden werden.

Wichtig:
Eine Webseite auf GitHub Pages kann normalerweise nicht direkt mit einer USB/SD/microSD-TSE sprechen.
Dafür brauchen wir später ein Backend oder lokale Middleware.

## Nächster Ausbau

- Backend mit Node.js
- SQLite Datenbank
- Login für Admin
- Produkte bearbeiten/löschen
- Tagesabschluss
- DSFinV-K Export vorbereiten
- Swissbit TSE Integration vorbereiten
