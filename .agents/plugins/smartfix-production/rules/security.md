# Security & Authorization Rules

## Role-Based Access Control (RBAC)
- Roles: `customer`, `worker`, `admin`.
- Protection middleware MUST verify JWT tokens in `Authorization: Bearer <token>` header.
- `authorizeRole(...roles)` MUST verify `req.user.role` matches allowed roles before permitting endpoint access.

## Password & Authentication Handling
- Passwords must be hashed using `bcryptjs` with salt rounds >= 10.
- JWT tokens should have a defined expiration (e.g., 7d or 30d).
- Sensitive fields (`password`, `otp`, `resetPasswordToken`) MUST be explicitly excluded from default queries via `.select('-password')`.

## KYC & Worker Verification
- Workers cannot accept bookings or appear in public listings until `isApproved` flag is set to `true` by an `admin`.
- Admin endpoints (`/api/admin/workers/:id/approve`) require explicit `admin` role authorization.

## Rate Limiting & Input Sanitization
- Express rate limiting (`express-rate-limit`) MUST be active on auth and sensitive API routes.
- Prevent MongoDB injection by ensuring user input is parsed and sanitized before query execution.
- CORS configuration MUST specify allowed origins.
