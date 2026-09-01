// Supabase Auth returns error messages in English with internal wording
// (e.g. "Email rate limit exceeded") that shouldn't reach end users
// verbatim. Maps the common ones to Spanish; anything unrecognized falls
// back to a generic message rather than leaking raw internal text.
const KNOWN_PATTERNS: [RegExp, string][] = [
  [/email rate limit exceeded/i, "Hemos alcanzado el límite de correos por ahora. Inténtalo de nuevo en unos minutos."],
  [/user already registered/i, "Ya existe una cuenta con ese correo electrónico."],
  [/password should be at least/i, "La contraseña debe tener al menos 6 caracteres."],
  [/unable to validate email address/i, "El correo electrónico no es válido."],
  [/for security purposes.*after \d+ seconds/i, "Por seguridad, espera unos segundos antes de intentarlo de nuevo."],
  [/invalid login credentials/i, "Usuario o contraseña inválidos."],
];

export function translateAuthError(message: string): string {
  for (const [pattern, translation] of KNOWN_PATTERNS) {
    if (pattern.test(message)) return translation;
  }
  return "Ocurrió un error. Inténtalo de nuevo en unos minutos.";
}
