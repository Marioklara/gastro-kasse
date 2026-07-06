# Gastro Kasse Version 2

Einfache Web-App für Restaurant / Café / Imbiss.

## Funktionen

- Handy, Tablet und PC
- Produkte antippen
- Warenkorb
- Tische öffnen
- Tische speichern
- Offene Tische später weiter bearbeiten
- Produkte hinzufügen
- Produkte bearbeiten
- Produkte löschen
- Bon erstellen
- Bon drucken
- Umsatz exportieren
- Offene Tische exportieren
- TSE-Platzhalter für Swissbit vorbereitet

## Start

`index.html` im Browser öffnen.

## Auf GitHub aktualisieren

Dateien ersetzen:

- `index.html`
- `style.css`
- `app.js`
- `README.md`

Dann im Terminal:

```bash
git add .
git commit -m "Version 2 mit offenen Tischen und Produktverwaltung"
git push
```

## Wichtig zu TSE

Diese Version ist noch nicht legal fertig für echten Restaurant-Betrieb.

Für Deutschland brauchst du später:

- echte zertifizierte TSE
- GoBD-konforme Speicherung
- DSFinV-K Export
- korrekte Bon-Pflichtangaben
- keine nachträgliche Manipulation

GitHub Pages allein kann nicht direkt mit Swissbit USB/SD/microSD-TSE sprechen.
Dafür brauchen wir später Backend oder Middleware.
