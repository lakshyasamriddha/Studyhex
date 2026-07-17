# StudyHex → PWA (installable in seconds)

This makes StudyHex installable straight from the browser — a real icon on
your home screen or desktop, opens full-screen, no app store, no signing
keys, no Android Studio.

It works on **Android, desktop Chrome/Edge, and (with limits) iOS Safari** —
one set of files, all platforms.

## What's in this folder

```
manifest.json         → app name, icons, colors, how it should open
service-worker.js     → makes it load instantly + work if network drops
js/pwa.js             → registers the above + optional "Install" button
icons/icon-192.png     → placeholder icon (swap for your real logo)
icons/icon-512.png     → placeholder icon (swap for your real logo)
```

## Step 1 — Copy files into your repo

Copy into `public/` so the final layout looks like:

```
public/
├── manifest.json          ← new
├── service-worker.js      ← new
├── icons/                 ← new
│   ├── icon-192.png
│   └── icon-512.png
├── js/
│   ├── pwa.js              ← new
│   └── ...(your existing files, untouched)
├── index.html              (existing — one line added, see Step 2)
├── dashboard.html           (existing — one line added, see Step 2)
└── ...
```

Nothing existing is deleted or rewritten — only new files land, plus two
lines added to each HTML page's `<head>`.

## Step 2 — Add two lines to each HTML page

In every `public/*.html` file, inside the `<head>`, add:

```html
<link rel="manifest" href="/manifest.json">
<meta name="theme-color" content="#1e2327">
<script src="/js/pwa.js" defer></script>
```

That's it — no other markup, CSS, or JS changes needed. (If you want the
custom install button instead of relying on the browser's automatic
prompt, add `<button id="install-app-btn" hidden>Install App</button>`
somewhere in the page — `js/pwa.js` will wire it up automatically.)

## Step 3 — Replace the placeholder icons (optional but recommended)

`icons/icon-192.png` and `icons/icon-512.png` are plain placeholders.
Swap in your real logo at those exact sizes and filenames and it just works.

## Step 4 — Deploy and test

PWAs require HTTPS (localhost is exempt, for testing). Deploy using the
`render.yaml` from the earlier Capacitor add-on, or any host that gives you
HTTPS. Once live:

- **Android (Chrome):** visit the site → a banner or the address-bar icon
  offers "Install app" → tap it → home screen icon appears.
- **Desktop (Chrome/Edge):** an install icon (⊕) appears in the address bar
  → click it → opens like a native app window, no browser chrome.
- **iOS (Safari):** Share button → "Add to Home Screen" (iOS doesn't show
  an automatic install prompt like Android/desktop, but the result is the
  same — a home screen icon that opens full-screen).

## How this compares to the native (Capacitor) route from before

| | PWA (this) | Native (Capacitor) |
|---|---|---|
| Setup time | Minutes | Hours, needs Android Studio/Xcode |
| Signing keys needed | No | Yes |
| App store listing | No (installs from browser) | Yes, if you want Play Store |
| Push notifications, deeper native APIs | Limited | Full access |
| Works on desktop too | Yes | No (Android/iOS only) |

For a study tracker with no heavy native feature needs, the PWA is
genuinely the better fit — the native route only pays off if you later
want Play Store distribution or native-only APIs.
