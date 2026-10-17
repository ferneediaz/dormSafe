# DormSafe

**Real-time dormitory emergency accountability and coordination for Taiwan universities.**

> Taiwan universities already train students to evacuate during earthquakes and fires. DormSafe helps answer the harder questions after the alarm goes off: **Who is safe? Who is missing? Who needs help? What parts of the building are still usable?**

DormSafe turns a university dormitory into a live emergency coordination network during earthquakes, fires, and other disasters.

It combines student check-ins, roommate confirmation, floor-level incident reports, internal building hazards, and official Taiwan disaster information into a single operational view for students, resident assistants, dorm managers, campus security, and arriving responders.

---

## Problem

Taiwanese university dormitories regularly conduct disaster-preparedness drills.

Typical workflows are based on:

1. alarm;
2. evacuation;
3. assembly at a designated area;
4. QR-code, student-card, or manual attendance.

This works well for drills.

A real emergency creates a much harder information problem.

Knowing that a student has **not checked in** does not tell dorm staff:

- whether the student was in the building;
- whether they are safe somewhere else;
- whether they are injured;
- which room or floor they may be on;
- whether they have mobility limitations;
- whether their exit route is blocked;
- whether a roommate has already seen them;
- whether somebody is already assisting them.

At the same time, students may report hazards such as smoke, structural damage, blocked staircases, or injuries through phone calls and group chats.

The result can be fragmented information precisely when rapid coordination matters most.

DormSafe structures that information.

---

# Core Idea

DormSafe maintains a live emergency state for the dormitory.

For every resident:

\[
\text{Resident State}
\in
\{
\text{Safe},
\text{Still Inside},
\text{Needs Help},
\text{Peer Confirmed},
\text{Unknown}
\}
\]

For every part of the building:

\[
\text{Building State}
=
\{
\text{accessible},
\text{blocked},
\text{hazard reported},
\text{verified}
\}
\]

These are combined into one operational picture.

Instead of:

> 27 students did not scan the evacuation QR code.

DormSafe can provide:

> **27 residents remain unaccounted for.**  
> 3 people have requested assistance.  
> 2 are believed to be on floors 9–10.  
> East Stairwell B is reported blocked on floor 9.  
> West Stairwell A has been confirmed usable.

---

# Example Scenario

An earthquake affects a university campus.

Dorm A contains **812 registered residents**.

Immediately after the earthquake:

```text
812 residents

0 confirmed safe
0 needing assistance
812 unknown
```

Students begin checking in through DormSafe.

Several minutes later:

```text
Dorm A

623 confirmed safe
43 still inside
5 need assistance
141 unknown
```

A student on floor 9 reports:

```text
East stairwell blocked
Debris between floors 9 and 10
```

Another student reports:

```text
Room 912
Resident cannot descend stairs
No serious injury
```

A floor leader confirms that the west stairwell remains usable.

DormSafe now produces:

```text
PRIORITY

1. Room 912 — mobility assistance required
2. Floors 10–12 — 18 residents still unaccounted for
3. Floor 9 east stairwell — blocked
4. Floor 6 — possible gas smell reported
```

When campus security or firefighters arrive, staff can provide a structured emergency handoff rather than reconstructing the situation from messages and phone calls.

---

# Student Interface

The student interface is intentionally minimal.

During an emergency, a resident can report:

### Personal status

- ✅ Safe / evacuated
- 🟡 Safe but still inside
- 🔴 Need assistance
- ❓ Other

Optional information:

- current floor / room;
- injury;
- mobility limitation;
- trapped;
- smoke or fire nearby;
- blocked exit.

---

## Peer Confirmation

Dormitories have an important advantage over generic residential buildings: residents already have a known social structure.

Students know their roommates.

A student can therefore report:

> “My roommate is safe and is currently with me.”

Statuses maintain provenance:

```text
SELF_CONFIRMED
PEER_CONFIRMED
STAFF_CONFIRMED
UNKNOWN
```

A peer confirmation does not have the same authority as a staff confirmation, but it provides valuable information while the dorm is being accounted for.

---

# Floor Leader / RA Interface

Resident assistants or floor leaders receive a floor-specific dashboard.

Example:

```text
FLOOR 9

42 registered residents

31 confirmed safe
3 still inside
1 needs assistance
7 unknown

East stairwell: BLOCKED
West stairwell: CONFIRMED OPEN
Elevator: UNAVAILABLE
```

The floor leader can:

- confirm a resident's status;
- report a room checked;
- verify a hazard;
- mark an evacuation route usable/unusable;
- claim an assistance task;
- escalate an incident to dorm management.

---

# Dorm Command Dashboard

Dorm managers and campus security see the complete dormitory state.

Example:

```text
DORM A

Residents: 812

SAFE                  763
STILL INSIDE           16
NEED ASSISTANCE         6
UNKNOWN                 27
```

Floor overview:

```text
12F   🟡 8 unknown
11F   🔴 2 assistance requests
10F   🟡 6 unknown
 9F   🔴 east stairwell blocked
 8F   🟢
 7F   🟢
 6F   🔴 possible gas leak
 5F   🟢
...
```

The goal is not to replace emergency responders.

The goal is to provide responders with better information when they arrive.

---

# Emergency Handoff

DormSafe automatically generates a concise responder-oriented incident summary.

Example:

## Dorm A — Emergency Handoff

**Registered residents:** 812  
**Accounted for:** 785  
**Unknown:** 27  
**Confirmed assistance requests:** 3

### Priority residents

**Room 912**
- mobility assistance required;
- resident conscious;
- unable to use stairs.

**Room 1104**
- injury reported;
- severity unknown.

### Building conditions

- East Stairwell B blocked between floors 9–10.
- West Stairwell A confirmed usable.
- Elevator unavailable.
- Possible gas leak reported on floor 6.

### Unknown residents

- Floor 12: 8
- Floor 11: 7
- Floor 10: 6
- Other floors: 6

This can be displayed directly to campus responders or exported as a compact incident report.

---

# Incident Reporting

Residents can report building conditions such as:

- fire;
- smoke;
- gas smell;
- structural damage;
- fallen objects;
- blocked hallway;
- blocked staircase;
- flooding;
- electrical hazard;
- injured resident;
- trapped resident.

Reports retain:

```text
report type
floor
room / approximate location
timestamp
reporter
verification state
description
```

Multiple reports referring to the same event can be grouped into a single incident.

For example:

```text
Student A:
"Stairs blocked near 9F"

Student B:
"Debris in east staircase floor 9"

RA:
"East staircase 9-10 blocked"
```

becomes:

```text
INCIDENT #14

East Stairwell B
Floors 9–10

BLOCKED

3 reports
1 staff verified
```

---

# Task Coordination

DormSafe can create simple emergency tasks from confirmed needs.

Examples:

```text
Check Room 912
Verify Stairwell B
Assist resident on Floor 7
Check Floor 10 rooms
Bring first-aid kit to lobby
```

Tasks can be:

```text
UNASSIGNED
ASSIGNED
IN_PROGRESS
COMPLETED
```

This reduces duplicated effort and makes it visible when an important request still has no responder.

DormSafe is **not** intended to automatically dispatch professional emergency personnel.

Local tasks are intended for trained dorm staff, resident assistants, campus personnel, or other authorized community responders.

---

# Taiwan Open Data Integration

DormSafe complements the dorm's live emergency state with real Taiwan public data.

Potential sources include:

### NCDR disaster alerts

Official CAP-based warnings and disaster information provide the external emergency context.

Examples:

- earthquake;
- heavy rain;
- flooding;
- strong wind;
- other civil-protection warnings.

### NFA shelters

Nearby official evacuation shelters can be displayed if the dorm must be evacuated beyond the campus.

### Medical resources

Nearby hospitals, clinics, and emergency medical resources can be retrieved from Taiwan public datasets.

### AED locations

Nearby AED information can support campus emergency response.

### Geographic data

OpenStreetMap or Taiwan geographic datasets can provide:

- campus roads;
- building footprints;
- nearby roads;
- evacuation destinations.

---

# Simulated Data

Some information necessarily cannot come from open government datasets.

The following data may therefore be simulated for the hackathon prototype:

- student roster;
- room assignments;
- resident emergency reports;
- resident medical/mobility assistance requests;
- internal stairwell status;
- dorm personnel assignments.

All simulated data should be clearly marked as **SIMULATED**.

The disaster context, shelters, public infrastructure, and other external information should use real Taiwan open data whenever possible.

---

# Why Dorms?

University dormitories are particularly suitable for this model because they already have:

- a defined resident roster;
- known room assignments;
- dorm managers;
- floor leaders / resident assistants;
- campus security;
- emergency procedures;
- evacuation assembly points;
- periodic disaster drills.

This means DormSafe does not need to invent a new emergency organization.

It digitizes the information flow inside one that already exists.

---

# Existing Systems

DormSafe does **not** claim that emergency accountability software does not exist.

International platforms such as boarding-school and school-safety systems already provide emergency roll calls and student accountability.

Taiwan also already has:

- official disaster-alert applications;
- university evacuation procedures;
- QR/student-card attendance during drills;
- residential-management applications;
- campus emergency communication systems.

The proposed distinction is the combination of:

\[
\boxed{
\text{resident accountability}
+
\text{room/floor incidents}
+
\text{internal route status}
+
\text{assistance requests}
+
\text{local task coordination}
+
\text{responder handoff}
}
\]

designed specifically around **Taiwan university dormitories and earthquake/disaster response**.

The project should therefore be presented as improving the operational workflow between evacuation attendance and professional emergency response—not as replacing Taiwan's existing disaster infrastructure.

---

# Hackathon MVP

The prototype should remain intentionally focused.

## Required

1. One real Taiwan dorm/campus map.
2. Simulated resident roster.
3. Student emergency check-in.
4. Safe / inside / needs-help / unknown states.
5. Peer confirmation.
6. Floor-level dashboard.
7. Hazard reporting.
8. Live dorm command dashboard.
9. Priority assistance list.
10. Responder handoff summary.
11. At least one real Taiwan disaster-data integration.

## Nice to Have

- live updates through WebSockets;
- incident deduplication;
- room-level floor plan;
- QR emergency check-in;
- nearby shelter layer;
- nearby hospital/AED layer;
- multilingual interface;
- offline/local-network mode;
- responder export.

---

# Demo Flow

### 1. Earthquake

A real NCDR earthquake event or replayed official event triggers the scenario.

```text
EARTHQUAKE DETECTED
Dorm A emergency mode activated
```

### 2. Accountability

The dashboard starts:

```text
0 / 812 residents accounted for
```

Simulated residents begin reporting.

```text
623 safe
43 inside
5 need help
141 unknown
```

### 3. Internal hazard

A resident reports:

```text
East stairwell blocked on Floor 9
```

The building view immediately changes.

### 4. Assistance request

Room 912 reports:

```text
Resident cannot descend stairs
```

The system raises the request in the floor and command dashboards.

### 5. Verification

A floor leader confirms:

```text
East stairwell blocked
West stairwell usable
```

### 6. Handoff

Click:

**Generate Responder Handoff**

DormSafe produces:

```text
27 residents unaccounted for
3 confirmed assistance requests
East Stairwell B blocked
West Stairwell A usable
Possible gas leak F6
Priority room: 912
```

That is the core demonstration.

---

# Architecture

A possible architecture:

```text
                     Taiwan Open Data
                           │
                ┌──────────┴──────────┐
                │                     │
             NCDR                  NFA / NHI
            Alerts              Shelters / Health
                │                     │
                └──────────┬──────────┘
                           │
                      DormSafe API
                           │
       ┌───────────────────┼───────────────────┐
       │                   │                   │
 Resident Reports     Dorm Roster       Building State
       │                   │                   │
       └───────────────────┼───────────────────┘
                           │
                     Incident Engine
                           │
             ┌─────────────┴─────────────┐
             │                           │
       Accountability              Incident State
             │                           │
             └─────────────┬─────────────┘
                           │
                    Priority Engine
                           │
              ┌────────────┼────────────┐
              │            │            │
          Student UI    RA Dashboard  Command View
                                        │
                                        ▼
                              Responder Handoff
```

---

# Suggested Data Model

```text
Resident
- resident_id
- dorm
- floor
- room
- emergency_assistance_profile

ResidentStatus
- resident_id
- status
- reported_by
- confidence_type
- timestamp
- location

Incident
- incident_id
- type
- floor
- location
- severity
- verification_state
- created_at
- updated_at

IncidentReport
- reporter_id
- incident_id
- description
- timestamp

BuildingRoute
- staircase / hallway / exit
- location
- status
- verified_by
- timestamp

Task
- task_id
- type
- target
- priority
- assigned_to
- status
```

---

# Privacy and Safety

DormSafe would handle sensitive emergency information.

A production system would therefore require:

- role-based access;
- minimal collection of personal information;
- encrypted communication;
- clear data-retention policies;
- audit logs;
- explicit university authorization;
- emergency-only access to sensitive resident information.

The public should not be able to view student room assignments, disabilities, medical information, or emergency status.

The hackathon prototype should use fictional student identities.

DormSafe also does not determine structural safety.

Reports such as:

> staircase blocked

represent observations from users or authorized staff.

The system should distinguish clearly between:

```text
REPORTED
CORROBORATED
STAFF_VERIFIED
```

and should not present unverified reports as engineering assessments.

---

# Non-Goals

DormSafe is not intended to:

- replace 119;
- replace firefighters;
- replace campus security;
- determine whether a building is structurally safe;
- autonomously issue evacuation orders;
- provide medical diagnoses;
- replace Taiwan's official disaster-warning systems.

It is an **information and coordination layer for the first minutes of a dormitory emergency**.

---

# Vision

Taiwan already has strong national disaster-warning and emergency-management infrastructure.

The missing information during the first minutes of a disaster can be much more local:

> Is Room 912 occupied?

> Did the Floor 10 residents evacuate?

> Which staircase is blocked?

> Who needs help descending?

> Who is still missing?

DormSafe makes that local state visible.

The long-term goal is simple:

\[
\boxed{
\text{from evacuation attendance}
\rightarrow
\text{real-time dorm emergency awareness}
}
\]

so that students can help one another, dorm staff can coordinate effectively, and professional responders arrive with a clearer picture of what is happening inside the building.

---

# One-Line Pitch

> **DormSafe turns Taiwan university dorm disaster response from a headcount into a live operational picture of who is safe, who needs help, what parts of the building are blocked, and where responders should look first.**