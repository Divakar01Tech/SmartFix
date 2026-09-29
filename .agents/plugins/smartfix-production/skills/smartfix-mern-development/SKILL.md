---
name: smartfix-mern-development
description: SmartFix MERN stack development skill for orchestrating React, Vite, Node.js, Express, and MongoDB.
---

# SmartFix MERN Development Skill

## Purpose
Provides instructions and patterns for developing features in the SmartFix full-stack codebase.

## Workflow Patterns

### 1. Adding a New API Endpoint
1. Define schema fields in `backend/models/<Model>.js`.
2. Implement controller logic in `backend/controllers/<controller>.js`.
3. Export router in `backend/routes/<route>.js` with `protect` and `authorizeRole` middleware.
4. Mount router in `backend/server.js`.
5. Add client function in relevant frontend API helper.

### 2. Standard Port Configuration
- Backend Server: `http://localhost:5000` (or `PORT` from `.env`)
- Customer App: `http://localhost:5173`
- Provider App: `http://localhost:5174`
- Admin App: `http://localhost:5175`
- Frontend Main: `http://localhost:3000` or `5176`

### 3. Environment Variables
Check `.env` in `backend/` for:
- `PORT`, `MONGO_URI`, `JWT_SECRET`
- `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`
- `GEMINI_API_KEY`
