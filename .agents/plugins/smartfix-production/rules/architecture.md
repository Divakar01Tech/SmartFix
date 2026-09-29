# MERN Architecture & Design Rules

## System Topology
SmartFix consists of 1 unified backend service and 4 frontend React applications:

1. **Backend (`smartfix/backend`)**:
   - Node.js + Express framework
   - MongoDB + Mongoose ODM
   - Socket.IO server for real-time tracking & events
   - Gemini AI Service integration for worker matching
   - Twilio OTP Service integration for phone verification
   - Razorpay Payment Gateway Service integration

2. **Frontend Applications**:
   - `smartfix/customer-app`: Customer service booking & live tracking interface
   - `smartfix/provider-app`: Service provider job acceptance, availability & location broadcast interface
   - `smartfix/admin-app`: Admin verification dashboard, worker KYC approval, service category & booking management
   - `smartfix/frontend`: Unified main web application

## Code Organization Rules
- **Backend**:
  - `controllers/`: Handles HTTP request logic, status codes, and response payloads.
  - `models/`: Mongoose schemas defining data structures, validations, and indexes.
  - `routes/`: Express router files mapping endpoints to controller functions with middleware.
  - `middleware/`: Authentication (`auth.js`), validation (`validate.js`), rate limiting, error handling (`errorHandler.js`).
  - `services/`: External integrations (Gemini AI, Twilio, Razorpay, Socket.IO handlers).
  - `utils/`: Helper functions (distance formulas, logger, token generation).

- **Frontends**:
  - Component-driven architecture using functional React components and React Hooks (`useState`, `useEffect`, `useContext`, `useCallback`).
  - Modular API clients using Axios with standardized error handling and authorization token injection.
