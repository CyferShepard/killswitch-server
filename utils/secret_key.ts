const secret = Deno.env.get("JWT_SECRET_KEY") ?? "your-fallback-secret";
export const SECRET_KEY: CryptoKey = await crypto.subtle.importKey(
  "raw",
  new TextEncoder().encode(secret),
  { name: "HMAC", hash: "SHA-256" },
  false,
  ["sign", "verify"]
);
