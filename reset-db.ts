// reset-db.ts
import * as dotenv from "dotenv";

// 1. Cargar variables ANTES de importar nada más
dotenv.config({ path: ".env.local" });

async function main() {
  console.log("🗑️  Iniciando limpieza de base de datos...");

  // Verificación de seguridad
  if (!process.env.TURSO_DATABASE_URL) {
    console.error(
      "❌ Error: No se encontró TURSO_DATABASE_URL. Revisa tu archivo .env.local",
    );
    process.exit(1);
  }

  // 2. Importación DINÁMICA (Aquí ya existen las variables de entorno)
  const { db } = await import("@/db");
  const { transactions, presupuestos, recurringServices, clients } =
    await import("@/db/schema");
  const { sql } = await import("drizzle-orm");

  try {
    // 1. Borrar tablas hijas primero
    console.log(" - Borrando Transacciones...");
    await db.delete(transactions);

    console.log(" - Borrando Presupuestos...");
    await db.delete(presupuestos);

    console.log(" - Borrando Servicios Recurrentes...");
    await db.delete(recurringServices);

    // 2. Borrar tabla padre al final
    console.log(" - Borrando Clientes...");
    await db.delete(clients);

    // 3. Resetear contadores SQLite
    try {
      await db.run(sql`DELETE FROM sqlite_sequence`);
      console.log(" - Contadores de ID reseteados.");
    } catch (e) {
      console.warn(" - No se pudo resetear sqlite_sequence.");
    }

    console.log("✅ Base de datos limpia y lista para usar.");
  } catch (error) {
    console.error("❌ Error al limpiar:", error);
  }
  process.exit(0);
}

main();
