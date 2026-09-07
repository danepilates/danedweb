import Link from "next/link";

export default function ForgotPasswordCheckEmailPage() {
  return (
    <div className="mx-auto flex min-h-[80vh] w-full max-w-sm flex-col justify-center px-4 text-center">
      <h1 className="mb-2 font-serif text-3xl font-semibold text-charcoal">
        Revisa tu correo
      </h1>
      <p className="mb-6 text-charcoal/60">
        Si ese correo está registrado, te enviamos un enlace para
        restablecer tu contraseña. Ábrelo desde este mismo dispositivo.
      </p>
      <Link
        href="/login"
        className="text-sm text-charcoal underline decoration-gold decoration-2 underline-offset-2"
      >
        Volver a iniciar sesión
      </Link>
    </div>
  );
}
