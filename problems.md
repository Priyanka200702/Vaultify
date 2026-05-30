# Problems

The biggest lag sources are likely these, in order:

## 1. App.jsx
- The whole app blocks behind `fetchMe()` during startup.
- While that runs, a full-screen spinner is shown, so any slow auth request feels like the app is hanging.

## 2. Workspace.jsx
- It fires a lot of requests on mount: workspace, vault keys, active tokens, recent activity, and pending requests.
- That means multiple state updates and rerenders right after opening the page.

## 3. Dashboard.jsx
- It also loads several things at once: stats, tokens, and audit logs.
- This makes the dashboard feel heavier on first render than a simpler page.

## 4. index.css
- The fixed background gradients, glass blur, shadows, and layered cards are visually expensive.
- `backdrop-blur` and large shadow stacks can stutter on slower laptops or integrated graphics.

## 5. Global store updates
- Your pages fetch data, then push it into Zustand/store state, which causes rerenders across the visible layout.
- On pages with tables/cards, that can feel like a noticeable pause.

## Most Likely Worst Offender
If I had to guess the single worst offender, it’s the combination of `App.jsx` startup auth plus `Workspace.jsx` loading too much at once.
