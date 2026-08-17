import Link from "next/link";
import { login } from "@/lib/actions/auth";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="mx-auto flex min-h-[80vh] w-full max-w-sm flex-col justify-center px-4">
      <h1 className="mb-6 font-serif text-3xl font-semibold text-charcoal">
        Iniciar sesión
      </h1>

      {error && (
        <p className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <form action={login} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm text-charcoal">
          Usuario
          <input
            name="username"
            type="text"
            autoCapitalize="off"
            autoCorrect="off"
            required
            className="rounded-lg border border-charcoal/20 px-3 py-2 text-base focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-charcoal">
          Contraseña
          <input
            name="password"
            type="password"
            required
            className="rounded-lg border border-charcoal/20 px-3 py-2 text-base focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
          />
        </label>
        <button
          type="submit"
          className="mt-2 rounded-full bg-charcoal px-3 py-3 text-base text-white transition-colors hover:bg-gold hover:text-charcoal"
        >
          Iniciar sesión
        </button>
      </form>

      <p className="mt-4 text-sm text-charcoal/60">
        ¿No tienes cuenta?{" "}
        <Link href="/signup" className="text-charcoal underline decoration-gold decoration-2 underline-offset-2">
          Regístrate
        </Link>
      </p>
    </div>
  );
}
