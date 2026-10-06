// NextAuth.js v5 route handler — /api/auth/[...nextauth]
// GET + POST otomatik olarak handlers'dan geliyor
import { handlers } from "@/lib/auth";

export const { GET, POST } = handlers;