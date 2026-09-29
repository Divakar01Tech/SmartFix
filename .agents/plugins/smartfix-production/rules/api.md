# Express API Standards & Conventions

## Response Format
All API endpoints MUST respond with consistent JSON structures:

- **Success Response**:
  ```json
  {
    "success": true,
    "data": { ... },
    "message": "Optional descriptive message"
  }
  ```
- **Error Response**:
  ```json
  {
    "success": false,
    "error": "Error description message"
  }
  ```

## HTTP Status Codes
- `200 OK`: Request succeeded.
- `201 Created`: Resource successfully created.
- `400 Bad Request`: Client input validation error.
- `401 Unauthorized`: Missing or invalid JWT token.
- `403 Forbidden`: Authenticated user lacks permission for operation.
- `404 Not Found`: Resource does not exist.
- `500 Internal Server Error`: Unexpected server error.

## Error Handling Middleware
- Async controller functions MUST wrap database and external API calls in `try/catch` or use `express-async-handler`.
- Global error handler in `middleware/errorHandler.js` formats error responses and prevents leaking internal server trace details in production.
