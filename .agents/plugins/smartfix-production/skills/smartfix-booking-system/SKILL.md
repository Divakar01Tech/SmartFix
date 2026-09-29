---
name: smartfix-booking-system
description: SmartFix booking lifecycle management skill covering job creation, status state machine, cancellation, and job completion.
---

# SmartFix Booking System Skill

## Booking Status State Machine

```
[Pending] ──(Assign Worker)──> [Assigned] ──(Worker Accepts)──> [Accepted]
   │                              │                                  │
   ├──(Cancel)──> [Cancelled]    ├──(Worker Rejects)──> [Pending]   ├──(Start Job)──> [In-Progress]
                                                                                       │
                                                                           (Complete Job)
                                                                                       │
                                                                                       v
                                                                                  [Completed] ──(Pay)──> [Paid]
```

## API Endpoints
- `POST /api/bookings`: Create new booking request.
- `GET /api/bookings`: List user/worker bookings with filters.
- `PATCH /api/bookings/:id/status`: Transition booking state with validation checks.
- `POST /api/bookings/:id/cancel`: Cancel booking with reason logging.
