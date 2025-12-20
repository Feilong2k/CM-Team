# Feature 2 - Task 0 - Subtask 2 (F2-T0-S2) API Specification Draft

## Overview
This subtask implements the REST API endpoints for interacting with the chat messages stored in the `chat_messages` table. The API enables creating new chat messages and retrieving existing messages filtered by project ID.

## API Endpoints

### POST /api/chat/messages
- **Description:** Create a new chat message.
- **Request Body:**
  ```json
  {
    "external_id": "string",  // includes project ID prefix, e.g. "p1-xyz"
    "sender": "user" | "orion" | "system",
    "content": "string",
    "metadata": { "optional": "object" }
  }
  ```
- **Response:**
  - `201 Created` with created message object including `id`, `created_at`, `updated_at`.
  - `400 Bad Request` for validation errors.

### GET /api/chat/messages
- **Description:** Retrieve chat messages filtered by project ID.
- **Query Parameters:**
  - `project_id` (required): string, e.g. "p1"
  - `limit` (optional): integer, max number of messages to return (default 50)
  - `offset` (optional): integer, pagination offset (default 0)
- **Behavior:**
  - Filters messages where `external_id` starts with the `project_id` prefix (e.g., `external_id LIKE 'p1%'`).
  - Returns messages sorted by `created_at` ascending.
- **Response:**
  - `200 OK` with array of message objects.
  - `400 Bad Request` if `project_id` is missing or invalid.

## Data Model Notes
- `external_id` serves as a composite identifier including project ID.
- No direct `project_id` column; filtering is done via prefix matching on `external_id`.
- Pagination parameters support efficient data retrieval.

## Acceptance Criteria
- API endpoints implemented as specified.
- Input validation and error handling in place.
- Unit and integration tests cover all API behaviors.
- API documentation updated for frontend integration.

## Dependencies
- Requires `chat_messages` table migration (F2-T0-S1) to be completed.
- Backend routing and controller framework in place.

## Next Steps
- Draft test cases for the above API endpoints.
- Implement backend routes and controllers.
- Coordinate with frontend for integration.

---
Document created by Adam (Architect) on 2025-12-18.
