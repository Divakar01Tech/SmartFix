---
name: smartfix-worker-matching
description: SmartFix worker recommendation skill using Gemini AI scoring, distance, ratings, and business availability checks.
---

# SmartFix Worker Matching Skill

## Matching Pipeline

1. **Spatial Filter**:
   Query MongoDB for candidate workers matching service category, with `isApproved: true`, `isAvailable: true`, and location near customer coordinates (Sivagangai District).

2. **Feature Extraction**:
   For each candidate worker, assemble:
   - Distance (km) from customer.
   - Star Rating (0 - 5) & Total Completed Jobs.
   - Response time / Acceptance rate.

3. **Gemini AI Scoring (`backend/services/geminiService.js`)**:
   Prompt Gemini model with candidate structured metadata to generate match confidence score (0 - 100%) and concise rationale.

4. **Business Rule Verification**:
   - Exclude offline workers.
   - Exclude workers currently on active bookings.
   - Fall back to standard distance/rating sorting if AI service is offline or unconfigured.
