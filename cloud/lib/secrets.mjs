// Server consumers only; never import credential values into client components.
export function get_secret(name, env = process.env) {
  const value = env[name];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
