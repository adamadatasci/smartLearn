# InteractiveLearn — iOS App

A collection of touch-based learning games for kids, packaged so it can run as a
standalone app on iPhone (built and tuned for iPhone 13, 390 × 844 pt).

The webcam / body-tracking "Ball Physics" experience has been removed — every
remaining game is tap/touch only and works on a phone.

## What's in here

- `index.html` — the home screen (game launcher menu).
- `*.html` / `*.css` / `js/*.js` — the individual games.
- `manifest.json`, `sw.js`, `icons/` — PWA assets (installable + offline).
- `capacitor.config.json`, `package.json`, `build.js` — native iOS packaging.

## Option A — Install directly on iPhone (no Mac needed)

1. Host this folder over HTTPS (any static host, e.g. GitHub Pages, Netlify) **or**
   serve it locally and open it in Safari on the iPhone.
2. In Safari, open the site, tap the **Share** button → **Add to Home Screen**.
3. It installs as a full-screen app icon. The service worker caches everything, so
   it keeps working offline after the first load.

## Option B — Build a native iOS app (requires a Mac with Xcode)

Capacitor wraps the web app in a real iOS project you can run on a device or submit
to the App Store.

```bash
# 1. Install dependencies
npm install

# 2. Copy the web app into ./www and add the iOS platform
npm run ios:add

# 3. Open the project in Xcode
npm run ios:open
```

In Xcode: pick your device / simulator, set your signing team, then **Run**.

After changing any HTML/CSS/JS, re-sync the web assets:

```bash
npm run ios:sync
```

### App identity

Edit `capacitor.config.json` to change:
- `appId` — the bundle identifier (`com.interactivelearn.app`).
- `appName` — the display name (`InteractiveLearn`).

App icons live in `icons/`. To use custom icons in the native build, you can also
add `@capacitor/assets` and run `npx capacitor-assets generate --ios`.
