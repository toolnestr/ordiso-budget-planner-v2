import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// OpenNext Cloudflare adapter — builds the Next.js app for Cloudflare Workers
// with full Node.js runtime support (nodejs_compat). This lets us use NextAuth,
// bcryptjs, and the Firebase Firestore SDK without Edge Runtime restrictions.
export default defineCloudflareConfig();
