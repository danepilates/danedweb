export const USERNAME_PATTERN = "^[A-Za-z0-9]{3,20}$";
const USERNAME_REGEX = /^[A-Za-z0-9]{3,20}$/;

// Trims whitespace but preserves casing — uniqueness is enforced
// case-insensitively at the DB level (lower(username) unique index), so
// "AndyFer98" displays as typed while still blocking "andyfer98".
export function normalizeUsername(raw: string): string {
  return raw.trim();
}

export function isValidUsername(username: string): boolean {
  return USERNAME_REGEX.test(username);
}
