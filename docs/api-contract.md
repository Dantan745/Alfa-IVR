# ABank Auth API Contract (draft)

## POST `/v1/auth/register`
- request: `RegisterRequestDto`
- response: `AuthResponseDto`
- errors:
  - `409 USER_ALREADY_EXISTS`
  - `422 VALIDATION_ERROR`

## POST `/v1/auth/login`
- request: `AuthRequestDto`
- response: `AuthResponseDto`
- errors:
  - `404 USER_NOT_FOUND`
  - `401 INVALID_CREDENTIALS`

## GET `/v1/users/me`
- headers: `Authorization: Bearer <token>`
- response: `AuthResponseDto`
- errors:
  - `401 UNAUTHORIZED`
