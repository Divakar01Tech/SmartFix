# Testing Strategy & Guidelines

## Backend Testing (Jest & Supertest)
- Backend tests live in `smartfix/backend/tests/` or unit test files.
- Supertest simulates HTTP calls against Express endpoints without starting external network ports.
- Detect open handles and force exit during CLI runs: `jest --detectOpenHandles --forceExit`.

## Frontend Testing
- Use Vite build checks (`npm run build`) to ensure build-time syntax and JSX correctness.
- Playwright E2E tests target critical user journeys:
  1. Customer signup -> login -> book service -> payment verification.
  2. Provider login -> set status online -> accept booking -> location broadcast.
  3. Admin login -> view pending workers -> approve KYC.

## Verification Checklist Before Committing
1. Execute `npm test` in `smartfix/backend`.
2. Run build verification on `customer-app`, `provider-app`, `admin-app`, and `frontend`.
3. Verify no environment keys or hardcoded passwords exist in git commit diffs.
