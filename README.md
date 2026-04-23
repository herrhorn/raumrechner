# Floorplan Area Measurement (local)

Lokale Web-Anwendung zum Hochladen von Grundriss-PDFs, interaktiven Markieren von Bereichen und Flächenberechnung in Quadratmetern.

**Kernfunktionen**
- PDF-Upload (lokal, über Flask-Endpoint)
- PDF-Anzeige (PDF.js)
- Interaktive Bereichsmarkierung (SVG-Overlay)
- Kalibrierung: definiere 2 Punkte und weise ihnen reale Länge zu
- Flächenberechnung via Shoelace-Formel und Umrechnung anhand Kalibrierung

## Architektur-Entscheidungen
- Backend: **Flask (Python)** — leichtgewichtig, einfach zu starten, dient nur zum Speichern und Bereitstellen hochgeladener PDFs.
- Frontend: Static HTML + Vanilla JavaScript — einfache Oberfläche, keine Build-Tools nötig.
- PDF Rendering: **PDF.js** (npm `pdfjs-dist`) — robuste PDF-Rendering-Lösung im Browser.
- Annotation: **SVG overlay** über dem Canvas — einfacher Zugriff auf Vektor-Elemente (Polygone, Punkte).
- Kalibrierung: Benutzer klickt zwei Punkte auf dem Bild und gibt reale Länge in Metern ein. Der gemessene Pixelabstand zwischen den Punkten ergibt `pxPerMeter`.
- Flächenberechnung: Shoelace-Formel auf Polygon-Koordinaten (Pixel^2), dann Umrechnung: `m² = px² / (pxPerMeter²)`.

## Installation (macOS)
In einem Terminal im Ordner `floorplan-app` führe folgende Schritte aus:

1. Python-Umgebung einrichten und Abhängigkeiten installieren:

```bash
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
```

2. Frontend-Abhängigkeiten (PDF.js) holen — wechsle in das `frontend` Verzeichnis und installiere:

```bash
cd frontend
npm install
```

Der `postinstall`-Script kopiert die notwendigen `pdfjs-dist`-Build-Dateien automatisch nach `static/vendor/pdfjs`.

3. Zurück zum Projektordner und Server starten:

```bash
cd ..
python server.py
```

Der Server läuft standardmäßig auf `http://127.0.0.1:5000/`.

## Nutzung
- Öffne `http://127.0.0.1:5000/` im Browser.
- PDF hochladen mit dem Dateiupload-Button (wird im Ordner `uploads/` gespeichert).
- Optional: Lade eine bereits hochgeladene Datei über den Button "Load uploaded PDF URL" (z.B. `/uploads/mein.pdf`).
- Kalibrieren: Klicke auf "Kalibrieren (2 Punkte)", klicke zwei Punkte im Grundriss und gib die reale Länge in Metern ein.
- Zeichnen: Klicke "Polygon zeichnen", füge Punkte durch Klicken hinzu und drücke "Fertig" zum Berechnen der Fläche.

## Hinweise & nächste Schritte
- Verbesserung: Zoom- und Pan-Unterstützung (re-rendering mit PDF.js) für präzisere Punkte.
- Bessere UX: Möglichkeit Punkte zu verschieben, Kanten abzurunden und Flächen zu editieren.
- Export: CSV/JSON Export der markierten Flächen mit Koordinaten und Flächenangaben.

