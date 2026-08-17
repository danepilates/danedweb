import { updatePassword } from "@/lib/actions/auth";

export default async function UpdatePasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="mx-auto flex min-h-[80vh] w-full max-w-sm flex-col justify-center px-4">
      <h1 className="mb-6 font-serif text-3xl font-semibold text-charcoal">
        Set a new password
      </h1>

      {error && (
        <p className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <form action={updatePassword} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm text-charcoal">
          New password
          <input
            name="password"
            type="password"
            required
            minLength={6}
            className="rounded-lg border border-charcoal/20 px-3 py-2 text-base focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
          />
        </label>
        <button
          type="submit"
          className="mt-2 rounded-full bg-charcoal px-3 py-3 text-base text-white transition-colors hover:bg-gold hover:text-charcoal"
        >
          Update password
        </button>
      </form>
    </div>
  );
}
