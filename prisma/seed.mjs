import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL;
if (!connectionString) {
  console.error("No database connection string found. Set POSTGRES_URL_NON_POOLING or DATABASE_URL.");
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = process.env.AUTH_TEST_USER_EMAIL || "test@courtcontrolai.local";
  const id = "test-user-e2e";

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      id,
      email,
      name: "E2E Test User",
      emailVerified: new Date(),
      role: "USER",
    },
  });

  console.log("Seeded test user:", user.id, user.email);
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
