# Bohnenrunde

Ein lokales Browsergame für zwei Menschen am selben Gerät. HTML, CSS und JavaScript, ohne externe Bibliotheken, Fonts, Tracker oder Netzwerkzugriffe. Kein Computergegner.

## Start

`index.html` per Doppelklick in einem aktuellen Browser öffnen. Eine Installation oder ein Server ist nicht nötig. Alle Dateien im selben Ordner behalten.

Alternativ im Projektordner:

```sh
python3 -m http.server 8080
```

Danach http://localhost:8080 öffnen. Auf einem Tablet funktioniert das Spiel ebenfalls in einem aktuellen Browser; der Projektordner kann dazu über einen lokalen Webserver bereitgestellt werden.

## Bedienung

Spieler A spielt unten und beginnt, B oben. Wähle eine hervorgehobene gefüllte Mulde. Anschließend verteilt das Spiel automatisch. Die eingesammelten Vorräte zeigen neben der Zahl jede einzelne Bohne grafisch in einer großen Holzschale im Stil der Spielmulden; jede Schale hat Platz für alle 48 Bohnen. Zahlen an den Mulden zeigen den tatsächlichen Muldeninhalt; der Handzähler zeigt noch nicht abgelegte Bohnen. Während einer Verteilung sind alle Mulden gesperrt.

„Zug rückgängig“ stellt den Zustand vor der letzten Muldenauswahl wieder her, einschließlich Vorräten und aktivem Spieler. Das funktioniert auch mitten in einer Animation und mehrfach hintereinander. „Neues Spiel“ verwirft die Partie. Der Temporegler wirkt unmittelbar; „Sofort“ berechnet ohne Einzelschrittanimation. Die Bedienung ist auch mit Tab und Enter/Leertaste möglich.

## Tests

Benötigt Node.js ab Version 18, keine npm-Installation:

```sh
node --test tests/*.test.cjs
```

Oder `npm test`. Die Tests prüfen Richtung und Reihenwechsel, Vierergruppen mitten in der Hand und am Handende, die symmetrische Gegner-Ausnahme, Weiteraufnahme, Überspringen, Sieg/Remis, Zustandskopien, Wiederholungsschutz und die Erhaltung aller 48 Bohnen in jedem Rechenschritt. Dazu kommen eine feste Kette mit 104 Schritten und 100 deterministisch simulierte Partien mit jeweils bis zu 2000 Zügen. Alle 100 simulierten Partien müssen mit der Acht-Bohnen-Endregel innerhalb des Testlimits regulär enden. Das Testlimit ist keine Spielregel. Zusätzliche Tests prüfen die sofortige Restvergabe mitten in einer Hand, den tatsächlichen letzten Empfänger einschließlich Gegner-Ausnahme, Sieg/Remis und unveränderte Undo-Snapshots.

## Dateien und Erweiterung

- `game.js`: reine Regel-Engine ohne DOM, Timer oder Zufall. Jede Operation liefert einen neuen Zustand und eine Ereignisliste. Die Eingabe bleibt unverändert.
- `app.js`: Darstellung, Animation, Tempo, Eingabesperre und Undo-Historie.
- `style.css`: responsive Gestaltung und Animationen.
- `index.html`: Oberfläche und ausklappbare Spielregeln.
- `tests/rules.test.cjs`: automatisierte Tests mit dem eingebauten Node-Testframework.

`BeanGame.createState()` erzeugt einen Anfangszustand. `legalMoves(state)` gibt erlaubte Ausgangsmulden zurück. `begin(state, index)` beginnt einen Zug, `advance(state)` führt einen einzelnen Ablege- oder Aufnahmeschritt aus. Beide liefern `{state, events}`. `playMove(state, index, callback)` berechnet eine ganze Kette synchron und ohne Animation. Der optionale Callback erhält jeden Schritt. Diese Funktionen bilden die Schnittstelle für einen späteren Computergegner oder eine Strategieanalyse.

Die Zustände enthalten nur JSON-Daten und sind damit serialisierbar. Spätere Ladefunktionen sollten zusätzlich zu `validate` auch Schema, Phase, Cursor, aktiven Spieler und Versionsnummer prüfen. Speicherung und Computergegner sind noch nicht implementiert.

## Regeln und ausdrücklich getroffene Annahmen

1. **Umlauf:** Indizes 0–5 entsprechen A von links nach rechts, Indizes 6–11 B von rechts nach links. Der nächste Index ist immer `(index + 1) % 12`: unten nach rechts, rechts hinauf, oben nach links, links hinunter. Die Ausgangsmulde wird bei einem vollständigen Umlauf wieder normal bedient; es gibt keine Überspringregel.
2. **Anfangsbestand:** Die zwölf anfänglichen Vierergruppen werden nicht eingesammelt. Nur das Ablegen einer Bohne löst die Viererprüfung aus.
3. **Handende:** „Letzte Bohne“ bezieht sich immer auf die aktuell verteilte Hand, auch nach einer Weiteraufnahme. Vierergruppen werden vor jeder möglichen Weiteraufnahme eingesammelt. Eine Vierergruppe am Handende beendet gemäß Vorgabe den ganzen Zug.
4. **Wiederholung in einer Zugkette:** Tritt am Punkt einer Weiteraufnahme dieselbe Kombination aus Brett, Vorräten, Spieler und letzter Mulde erneut auf, wäre die weitere Kette deterministisch endlos. Das Spiel hält ohne zusätzliche Punktevergabe an. Die Bohnen bleiben auf dem Brett, die Hand ist leer. Undo oder Neustart bleiben möglich. Diese ergänzte Schutzregel ist in `repeatPolicy` isoliert.
5. **Keine Zugmöglichkeit:** Nach dem Zugende prüft `finish` beide Spieler. Eine leere Reihe wird übersprungen. Sind beide Reihen leer, obwohl noch nicht 48 Bohnen eingesammelt wurden, zeigt die Engine einen Sonderfall statt weiterzuschalten. In einem gültigen Zustand ohne Bohnen in der Hand ist dieser Fall mathematisch ausgeschlossen; die zusätzliche Prüfung ist defensiv. Verlorene oder doppelte Bohnen erkennt `validate` separat.
6. **Acht-Bohnen-Endregel (nachträglich ergänzt und bestätigt):** Sobald durch eine Einsammlung nur noch genau acht Bohnen auf Brett und Hand zusammen übrig sind, endet die Partie sofort, auch mitten in einer laufenden Hand. Der tatsächliche Empfänger der zuletzt eingesammelten Vierergruppe erhält alle acht Restbohnen, einschließlich noch gehaltener Bohnen. Das kann auch der Gegner des aktiven Spielers sein. Die Ausnahme für die letzte Bohne gilt weiterhin und bestimmt dann auch den Restempfänger. Brett und Hand werden geleert, die Summe der Vorräte ist 48. Erst danach wird Sieg oder Remis bestimmt. Die Regel liegt isoliert in `collectFinalEight`; `lastCollector` im Zustand merkt den tatsächlichen Empfänger und wird beim Rückgängigmachen ebenfalls zurückgesetzt. Es gibt keine zusätzliche Zugzahlgrenze.
7. **Bohnenerhaltung:** Während der Verteilung gilt `Brett + Vorrat A + Vorrat B + Hand = 48`. Zwischen den Zügen ist die Hand leer. Nach jeder Engine-Operation wird diese Invariante geprüft.

## Prüfstand dieser Lieferung

Alle 19 automatisierten Engine-Tests bestanden. Mit der ergänzten Acht-Bohnen-Endregel endeten alle 100 simulierten Partien regulär innerhalb von 2000 Zügen. Die längste dabei beobachtete Kette hatte 52 Schritte; zusätzlich bestand die feste 104-Schritte-Referenzkette. Die Invariante von 48 Bohnen wurde bei jedem einzelnen Schritt geprüft. Eine visuelle Browser- und Tabletprüfung konnte in der Entwicklungsumgebung nicht stattfinden: Das Starten eines lokalen Servers war gesperrt, ebenso das Öffnen von `file:`-URLs im integrierten Browser. Die Oberfläche enthält responsive Layouts für Desktop, Tablets und kleine Bildschirme; ihre Darstellung auf realen Geräten ist noch nicht visuell bestätigt.
