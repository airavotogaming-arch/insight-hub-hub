/**
 * Resolves a public/ asset to a URL that works both when the app is served
 * from "/" and when the static zip build is hosted from an arbitrary
 * sub-folder (portals like Playgama serve /qa-tool/<id>/index.html).
 */
export function asset(path: string): string {
  const clean = path.replace(/^\/+/, "");
  const base = import.meta.env.BASE_URL || "/";
  return base.endsWith("/") ? base + clean : `${base}/${clean}`;
}
