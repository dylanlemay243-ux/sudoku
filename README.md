# Sudoku — ad-free

An offline sudoku app. No ads, no accounts, no trackers. The whole app is one
self-contained HTML file (`www/index.html`); Capacitor wraps it in an Android
shell and GitHub Actions builds the APK.

## Getting an APK

1. Create a new **empty** GitHub repository.
2. Push these files to it (`main` branch):

   ```
   .github/workflows/android.yml
   .github/workflows/release.yml
   www/index.html
   package.json
   capacitor.config.json
   .gitignore
   ```

3. The **Build APK** workflow runs automatically on push. Open the **Actions**
   tab, click the run, and download the `sudoku-debug-apk` artifact at the
   bottom. That APK installs on any Android phone with "install unknown apps"
   enabled.

No Android Studio, no local setup. The workflow generates the whole native
project from scratch each run, which is why `android/` is gitignored.

## Getting a Play Store build

Google Play needs a **signed .aab**, not an APK. That's the second workflow.

1. Make a keystore once, on your own machine, and never lose it — it is the only
   thing that can publish updates to your app:

   ```bash
   keytool -genkey -v -keystore sudoku.jks -keyalg RSA -keysize 2048 \
     -validity 10000 -alias sudoku
   base64 -w0 sudoku.jks > keystore.txt
   ```

2. In the repo, go to **Settings → Secrets and variables → Actions** and add:

   | Secret | Value |
   | --- | --- |
   | `ANDROID_KEYSTORE_BASE64` | the contents of `keystore.txt` |
   | `ANDROID_KEY_ALIAS` | `sudoku` |
   | `ANDROID_KEYSTORE_PASSWORD` | the keystore password you chose |
   | `ANDROID_KEY_PASSWORD` | the key password you chose |

3. Run **Release bundle (Play Store)** manually from the Actions tab. Download
   the artifact and upload the `.aab` in the Play Console.

Play Console also needs: a one-time $25 developer account, a privacy policy URL,
an app icon, a feature graphic, and at least two screenshots.

## Changing the app id and name

Edit `capacitor.config.json` before the first build. `appId` must be a domain
you control, reversed (`com.yourname.sudoku`) and **cannot be changed after
publishing**.

## What still needs doing before it ships

- **Fonts.** The app loads Cormorant Garamond and Lora from Google Fonts, so the
  first launch needs a connection; after that they're cached. To be fully
  offline, download the two `.woff2` files, drop them in `www/fonts/`, and swap
  the `<link>` for a local `@font-face`.
- **App icon.** Capacitor ships a placeholder. Replace the icons in
  `android/app/src/main/res/mipmap-*` (or use `@capacitor/assets`).
- **Connect the backend.** The app runs fine without it — it just shows sample
  standings and generates its own daily grid. To go live, deploy the Worker in
  `server/` (see `server/README.md`), then paste its URL into the `CONFIG` line
  near the top of `www/index.html` and push. The record screen's figures are
  still sample data.
- **Saved progress** lives in the webview's local storage — good enough, but it
  is cleared if the user clears app data.

## Leaderboards

`server/` holds a Cloudflare Worker and a D1 schema — about 150 lines, free to
run at this scale. No sign-in: each install generates a random device id and
sends it with the nickname from Settings. Uninstalling loses the history.

The daily puzzle is not downloaded. The server returns a seed string and every
phone generates the same grid from it, so the solution never leaves the device.

Times are self-reported, so they can be faked. `server/README.md` has the
one-line SQL to delete a bogus row.

## Editing the design

`www/index.html` is compiled output — don't edit it by hand. The source lives in
this project as `Sudoku.dc.html` (the design, shown in a phone frame) and
`SudokuApp.dc.html` (the same thing full-screen, which is what gets compiled).
