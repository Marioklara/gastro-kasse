# TSE-Middleware-Spezifikation

Die Kasse kann im Demo-Modus laufen oder eine lokale zertifizierte TSE-Middleware ansprechen.
Fuer den echten produktiven Betrieb in Deutschland muss die Middleware eine zertifizierte TSE korrekt steuern und die rechtlichen Anforderungen mit Steuerberatung/Kassenhersteller validiert werden.

## Basis-URL

Standard in der Kasse:

```text
http://127.0.0.1:8080
```

## Health Check

```http
GET /health
```

Beispielantwort:

```json
{
  "status": "ok",
  "serialNumber": "TSE-SERIENNUMMER",
  "vendor": "Swissbit"
}
```

## Transaktion starten

```http
POST /transaction/start
Content-Type: application/json
```

Body: kompletter Kassenauftrag mit Bon-ID, Zeitpunkt, Tisch, Zahlart, Artikeln und Summen.

Beispielantwort:

```json
{
  "status": "STARTED",
  "transactionNumber": "12345",
  "signatureCounter": 987,
  "serialNumber": "TSE-SERIENNUMMER",
  "startedAt": "2026-07-06T17:45:00.000Z"
}
```

## Transaktion abschliessen

```http
POST /transaction/finish
Content-Type: application/json
```

Body:

```json
{
  "order": {},
  "transaction": {}
}
```

Beispielantwort:

```json
{
  "status": "FINISHED",
  "transactionNumber": "12345",
  "signatureCounter": 988,
  "signature": "BASE64_ODER_HERSTELLERFORMAT",
  "serialNumber": "TSE-SERIENNUMMER",
  "finishedAt": "2026-07-06T17:45:10.000Z"
}
```

## Wichtig

WebUSB ist in der Kasse als Erkennungsweg vorbereitet. Die echte Signatur sollte ueber ein zertifiziertes Herstellerprotokoll oder eine lokale Middleware erfolgen, weil Browser allein keine vollstaendige fiskalische TSE-Implementierung ersetzen.
