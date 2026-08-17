export default function CheckEmailPage() {
  return (
    <div className="mx-auto flex min-h-[80vh] w-full max-w-sm flex-col justify-center px-4 text-center">
      <h1 className="mb-2 font-serif text-3xl font-semibold text-charcoal">
        Check your email
      </h1>
      <p className="text-charcoal/60">
        We sent you a confirmation link. Click it to activate your account,
        then log in to start booking sessions.
      </p>
    </div>
  );
}
