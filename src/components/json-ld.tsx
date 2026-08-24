// Schema.org structured data for search engines and AI answer engines.
// Only includes fields we actually know — never fabricates an address,
// phone number, or social link that isn't configured.
export function JsonLd() {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "ExerciseGym",
    name: "DANED Studio",
    description:
      "Estudio de Pilates y Asistencia Nutricional con reservas de sesiones en línea.",
    url: baseUrl,
    logo: `${baseUrl}/logoDaned.png`,
    image: `${baseUrl}/opengraph-image`,
  };

  if (process.env.NEXT_PUBLIC_BUSINESS_PHONE) {
    data.telephone = process.env.NEXT_PUBLIC_BUSINESS_PHONE;
  }

  if (process.env.NEXT_PUBLIC_BUSINESS_ADDRESS) {
    data.address = {
      "@type": "PostalAddress",
      streetAddress: process.env.NEXT_PUBLIC_BUSINESS_ADDRESS,
    };
  }

  const sameAs = [
    process.env.NEXT_PUBLIC_INSTAGRAM_URL,
    process.env.NEXT_PUBLIC_FACEBOOK_URL,
  ].filter((url): url is string => Boolean(url));
  if (sameAs.length > 0) data.sameAs = sameAs;

  return (
    <script
      type="application/ld+json"
      // Static, server-controlled JSON (never user input) — the standard,
      // safe way to embed Schema.org data in React.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
