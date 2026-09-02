import Link from "next/link";
import { signup } from "@/lib/actions/auth";
import { USERNAME_PATTERN } from "@/lib/username";
import { PasswordInput } from "@/components/password-input";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="mx-auto flex min-h-[80vh] w-full max-w-sm flex-col justify-center px-4">
      <h1 className="mb-6 font-serif text-3xl font-semibold text-charcoal">
        Crea tu cuenta
      </h1>

      {error && (
        <p className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <form action={signup} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm text-charcoal">
          Nombre completo
          <input
            name="fullName"
            type="text"
            required
            className="rounded-lg border border-charcoal/20 px-3 py-2 text-base focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-charcoal">
          Usuario
          <input
            name="username"
            type="text"
            pattern={USERNAME_PATTERN}
            title="3-20 caracteres: solo letras y números"
            autoCapitalize="off"
            autoCorrect="off"
            required
            className="rounded-lg border border-charcoal/20 px-3 py-2 text-base focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
          />
          <span className="text-xs font-normal text-charcoal/50">
            3-20 caracteres: solo letras y números
          </span>
        </label>
        <label className="flex flex-col gap-1 text-sm text-charcoal">
          Teléfono
          <input
            name="phone"
            type="tel"
            required
            className="rounded-lg border border-charcoal/20 px-3 py-2 text-base focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-charcoal">
          Correo electrónico
          <input
            name="email"
            type="email"
            required
            className="rounded-lg border border-charcoal/20 px-3 py-2 text-base focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-charcoal">
          Contraseña
          <PasswordInput name="password" required minLength={6} />
        </label>
        <button
          type="submit"
          className="mt-2 rounded-full bg-charcoal px-3 py-3 text-base text-white transition-colors hover:bg-gold hover:text-charcoal"
        >
          Registrarse
        </button>
      </form>

      <p className="mt-4 text-sm text-charcoal/60">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="text-charcoal underline decoration-gold decoration-2 underline-offset-2">
          Inicia sesión
        </Link>
      </p>
    </div>
  );
}
