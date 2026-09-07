import Link from "next/link";
import { requestPasswordReset } from "@/lib/actions/auth";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="mx-auto flex min-h-[80vh] w-full max-w-sm flex-col justify-center px-4">
      <h1 className="mb-2 font-serif text-3xl font-semibold text-charcoal">
        Recupera tu contraseña
      </h1>
      <p className="mb-6 text-sm text-charcoal/60">
        Ingresa tu correo electrónico y te enviaremos un enlace para
        restablecer tu contraseña.
      </p>

      {error && (
        <p className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <form action={requestPasswordReset} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm text-charcoal">
          Correo electrónico
          <input
            name="email"
            type="email"
            autoCapitalize="off"
            autoCorrect="off"
            required
            className="rounded-lg border border-charcoal/20 px-3 py-2 text-base focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
          />
        </label>
        <button
          type="submit"
          className="mt-2 rounded-full bg-charcoal px-3 py-3 text-base text-white transition-colors hover:bg-gold hover:text-charcoal"
        >
          Enviar enlace de restablecimiento
        </button>
      </form>

      <p className="mt-4 text-sm text-charcoal/60">
        <Link href="/login" className="text-charcoal underline decoration-gold decoration-2 underline-offset-2">
          Volver a iniciar sesión
        </Link>
      </p>
    </div>
  );
}
