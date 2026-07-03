// Utilitaire admin : ajoute des crédits à un utilisateur.
// Usage : node scripts/add-credits.mjs <email> <montant>
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envFile = readFileSync(join(root, ".env.local"), "utf8");
const getEnv = (k) => {
  const m = envFile.match(new RegExp(`^${k}=(.*)$`, "m"));
  return m ? m[1].trim() : undefined;
};

const url = getEnv("NEXT_PUBLIC_SUPABASE_URL");
const serviceKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
if (!url || !serviceKey) {
  console.error("NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquant dans .env.local");
  process.exit(1);
}

const email = process.argv[2];
const amount = parseInt(process.argv[3], 10);
if (!email || !Number.isFinite(amount)) {
  console.error("Usage : node scripts/add-credits.mjs <email> <montant>");
  process.exit(1);
}

const admin = createClient(url, serviceKey);

const { data: profile, error: profileError } = await admin
  .from("profiles")
  .select("id, email, full_name")
  .eq("email", email)
  .single();

if (profileError || !profile) {
  console.error(`Profil introuvable pour ${email}.`);
  const { data: all } = await admin.from("profiles").select("email").limit(20);
  console.error("Profils existants :", (all ?? []).map((p) => p.email).join(", ") || "(aucun)");
  process.exit(1);
}

const { data: balance } = await admin
  .from("credit_balances")
  .select("credits")
  .eq("user_id", profile.id)
  .single();

const current = balance?.credits ?? 0;
const next = current + amount;

const { error: upsertError } = await admin.from("credit_balances").upsert({
  user_id: profile.id,
  credits: next,
  updated_at: new Date().toISOString(),
});

if (upsertError) {
  console.error("Erreur de mise à jour :", upsertError.message);
  process.exit(1);
}

console.log(`${profile.email} : ${current} -> ${next} crédits (+${amount})`);
