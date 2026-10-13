<p align="center">
  <img src="public/logo.png" alt="psn logo" width="96" />
</p>

<h1 align="center">psn checker</h1>

<p align="center">
  minimal, oled-native playstation library inspector and entitlement fetcher.
</p>

<p align="center">
  <a href="#features">features</a> &bull;
  <a href="#quick-start">quick start</a> &bull;
  <a href="#token-guide">token guide</a> &bull;
  <a href="#export-options">export</a>
</p>

---

### features

- **zero fluff**: pure black #000000 oled interface with sharp zero-radius layout.
- **accurate separation**: distinguishes owned purchases from playstation plus claims.
- **real-time streaming**: live server-sent events (sse) pipeline tracking fetch progress with live eta.
- **list exporter**: one-tap simplified text list grouped by platform (ps4 and ps5 sections).
- **csv download**: full spreadsheet export with title ids, platforms, and license statuses.

---

### quick start

```bash
# install dependencies
npm install

# launch web server
npm run web
```

open `http://localhost:3000` in your browser.

---

### token guide

1. sign into your official account at [playstation.com](https://www.playstation.com).
2. open sony's security cookie endpoint in another tab:
   ```text
   https://ca.account.sony.com/api/v1/ssocookie
   ```
3. copy the 64-character token inside the json quotes:
   ```json
   {"npsso": "your_64_character_token_here"}
   ```
4. paste it into the token field and click **connect & fetch**.

---

### export options

- **copy simple list**:
  - `copy without ps+ list`: copies owned digital purchases only.
  - `copy with ps+ list`: copies all games including claimed ps+ titles.
  - clean format: games grouped under ps4 and ps5 headers, sorted a-z.
- **csv export**: full dataset saved as `psn-game-library.csv`.

---

<p align="center">
  <sub>built by <a href="https://github.com/nimalanrao">@nimalanrao</a></sub>
</p>
