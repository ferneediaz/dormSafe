# DormSafe

> Taiwan's disaster app routes people to shelters. DormSafe works inside the dorm: it tracks who's missing, reroutes around blocked exits, and tells staff who to rescue first.

## Inspiration
Taiwan has a strong nationwide disaster response system. It routes people to shelters and helps rescuers plan their routes. But in an earthquake, typhoon, fire or gas leak, the first critical minutes happen inside the building. Taiwan's university dorm staff train for these emergencies, but they have no tool to coordinate during one. Who is still missing? Which staircase is blocked? Who is trapped and can't get out? We built DormSafe to answer those questions quickly.

## What it does
DormSafe is a live command dashboard for dorm staff and students during an emergency:
- **Accountability:** tracks who has checked in safe and flags who is still missing, floor by floor.
- **Route status:** marks stairwells and exits as available or blocked, so people aren't sent toward danger.
- **Priority list:** tells responders where to go first and who to rescue first.
- **3D building view:** shows the dorm floor by floor, with markers for incidents and residents.
- **Real Taiwan data:** pulls official NCDR emergency alerts (CAP) and NFA shelter locations, so the dorm's response connects to the national system.

## How we built it
- **Frontend:** Expo (React Native) with Expo Router, in TypeScript, so one codebase runs on iOS, Android and Web.
- **3D:** three.js through React Three Fiber and drei, running inside Expo DOM components. The same 3D scene works on web and in mobile apps.
- **State:** Zustand stores the dorm, residents, incidents and routes, plus selectors that work out who is missing and who comes first.
- **Backend:** a Python FastAPI service with Pydantic models for the dorm, residents, incidents and access points.
- **Open data:** adapters for NCDR CAP alerts and NFA shelters. Each one can use live data, cached data or a stored snapshot, so the demo works without internet.
- **Demo setup:** a fixed test dorm with 8 floors, 96 simulated residents, 2 stairwells and 2 exits, plus a pytest test suite.

## Challenges we ran into
- **3D on every platform:** the native React Three Fiber renderer doesn't support most drei helpers. Running the scene as an Expo DOM component meant we only had to build it once.
- **Parsing government feeds:** CAP alert XML and the shelter CSV needed careful parsing to turn them into clean data.
- **Working offline:** during a disaster you can't count on the network. We added fallbacks from live data to cached data to a stored snapshot.
- **Keeping it readable under stress:** the dashboard has to answer "who's missing and where do I go" at a glance.

## Accomplishments that we're proud of
- A working 3D model of the dorm that responders can read at a glance.
- Real Taiwan emergency alerts and shelter data running in the app.
- A complete demo scenario with 96 residents that plays out the same way every time.
- One codebase for phone, tablet and the command-desk browser.

## What we learned
- Most of the danger in an emergency comes from poor coordination, not lack of training.
- Taiwan's open data is a strong base to build on. Local tools can connect to it instead of replacing it.
- Plan for the network to fail, and design for people who are stressed, from the start.

## What's next for DormSafe
- Live sync between devices with Supabase Realtime, with logins and access rules for students, RAs and staff.
- Student check-in, confirming a neighbor is safe, and hazard reports from phones.
- Push alerts when NCDR issues an alert, plus Traditional Chinese and English versions.
- Automatic rerouting when a stairwell is reported blocked.
- A PDF report to hand to firefighters when they arrive.
- Expanding beyond dorms to schools, apartment buildings and small communities.
