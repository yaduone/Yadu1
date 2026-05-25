export function matchesSearch(search, values) {
  const query = search.trim().toLowerCase();
  if (!query) return true;

  return values.some((value) => String(value ?? '').toLowerCase().includes(query));
}
