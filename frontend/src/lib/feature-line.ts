export function featureMetaLine(film: {
  year: number | null;
  genres: string[];
  runtime: number | null;
  service: string | null;
}): string {
  const parts: string[] = [];
  if (film.year) parts.push(String(film.year));
  const genre = film.genres.find((item) => item.trim().length > 0);
  if (genre) parts.push(genre);
  if (film.runtime && film.runtime > 0) parts.push(`${film.runtime}m`);
  if (film.service) parts.push(film.service);
  return parts.join(" · ");
}

const SERVICE_ORDER = ["flatrate", "ads", "rent", "buy"] as const;

export function primaryServiceName(
  categories: { type: string; providers: { provider_name: string }[] }[],
): string | null {
  for (const type of SERVICE_ORDER) {
    const category = categories.find((item) => item.type === type);
    const name = category?.providers.find((provider) => provider.provider_name.trim())?.provider_name;
    if (name) return name;
  }
  for (const category of categories) {
    const name = category.providers.find((provider) => provider.provider_name.trim())?.provider_name;
    if (name) return name;
  }
  return null;
}
