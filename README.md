# Fireflies Action Cards

Swipe through the action items from your [Fireflies](https://fireflies.ai) meetings
and triage them into a to-do list — Tinder-style.

- **Review** — each action item from your recent meetings becomes a card.
  Swipe **right** (or `→`) to add it to your to-do list, **left** (or `←`) to archive it.
  Time-sensitive follow-ups (anything mentioning a date, deadline, "by Friday", etc.)
  are flagged and shown first.
- **To-do** — everything you kept. Tick items off when done, or set a target
  completion date. Overdue items are highlighted.
- **Archive** — items you swiped away, with the option to restore them.
- **Admin** —
  - **Focus & priorities:** add focus prompts (a keyword, phrase, project, or person's name),
    each tagged **High** or **Medium**. Any action item whose text, meeting, or assignee
    matches is flagged at that priority and floated to the top of the review deck and to-do
    list. A toggle can make all your own action items High. Every card and to-do item shows a
    priority badge, and you can tap a to-do's badge to override its priority.
  - **Daily review:** set a **time of day** for the app to auto-refresh your Fireflies meetings
    and rebuild the review deck. Toggle a browser notification that tells you how many new
    action items are waiting, choose how many recent meetings to scan, run a review on
    demand ("Run now"), and manage the Fireflies connection. The scheduled run fires while
    the app is open in a browser tab.

Focus matching is plain keyword/phrase matching evaluated in the browser — no backend, no
external calls beyond Fireflies.

## How it works

The app talks to the Fireflies GraphQL API directly from your browser. On first run
you paste your Fireflies API key (Fireflies → **Settings → Developer Settings**). The
key and all your triage decisions are stored only in your browser's `localStorage` —
nothing is sent anywhere except Fireflies.

Action items come from each meeting's AI summary (`summary.action_items`). They're
parsed per assignee, so you can optionally filter to just **your** items.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
```

Build for production:

```bash
npm run build
npm run preview
```

## Stack

React + Vite, no backend. Swipe gestures are handled with native pointer events,
so it works with touch on mobile and mouse on desktop.
