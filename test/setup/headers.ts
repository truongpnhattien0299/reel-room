/**
 * Stand-in for `next/headers`: one cookie jar shared by the whole test, as if
 * every call came from the same browser. `clearCookies` starts a new visitor.
 */
const jar = new Map<string, string>();

export function clearCookies() {
  jar.clear();
}

export async function cookies() {
  return {
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    has: (name: string) => jar.has(name),
    set: (name: string, value: string) => void jar.set(name, value),
    delete: (name: string) => void jar.delete(name),
  };
}

export async function headers() {
  return new Headers();
}
