// Multi-tenant schema setup — db-cargo (Vercel Postgres/Neon)
// Her proje kendi schema'sını kullanır (schema_courtcontrolai, schema_geolease, schema_idaim)
import pg from "pg";

const SCHEMAS = [
  "schema_courtcontrolai",
  "schema_geolease",
  "schema_idaim",
];

async function main() {
  const connStr = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL;
  if (!connStr) {
    console.error("❌ POSTGRES_URL tanımsız. Vercel `vercel env pull` çalıştır.");
    process.exit(1);
  }

  const client = new pg.Client({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false }, // Neon SSL
  });

  await client.connect();
  console.log("✅ Database'e bağlandı");

  // Version kontrol
  const { rows: vrows } = await client.query("SELECT version()");
  console.log("📦", vrows[0].version);

  // Mevcut schema'ları listele
  const { rows: existing } = await client.query(
    "SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'schema_%'"
  );
  console.log("📂 Mevcut schema'lar:", existing.map((r) => r.schema_name).join(", ") || "(yok)");

  // Her schema'yı oluştur (idempotent)
  for (const schema of SCHEMAS) {
    await client.query(`CREATE SCHEMA IF NOT EXISTS ${schema}`);
    console.log(`✓ ${schema} oluşturuldu (veya zaten vardı)`);
  }

  // Search path ayarla (Vercel Next.js'ten bağlanan uygulamalar için)
  // NOT: Her uygulama kendi Prisma `@@schema()` ile izole yazar.
  // Burada sadece bilgi amaçlı gösteriyoruz:
  await client.query(`
    COMMENT ON SCHEMA schema_courtcontrolai IS 'CourtControlAI tournament, match, bracket data'
  `);
  await client.query(`
    COMMENT ON SCHEMA schema_geolease IS 'Geolease property, lease, tenant data'
  `);
  await client.query(`
    COMMENT ON SCHEMA schema_idaim IS 'IDAIM Cyprus cells, traps, lab results'
  `);

  // Doğrulama
  const { rows: final } = await client.query(
    "SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'schema_%' ORDER BY schema_name"
  );
  console.log("\n📋 Son durum:");
  final.forEach((r) => console.log(`  ✓ ${r.schema_name}`));

  await client.end();
  console.log("\n🎉 Multi-tenant schema kurulumu tamamlandı!");
}

main().catch((err) => {
  console.error("❌ Hata:", err.message);
  process.exit(1);
});
