require("dotenv").config();
const crypto = require("crypto");
const { Client } = require("pg");

function sha256(input) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

async function main() {
  const customerId = process.argv[2];
  if (!customerId) {
    console.error("Usage: node scripts/create-magic-link.js <customer_uuid>");
    process.exit(1);
  }

  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();

  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = sha256(token);

  const expires = new Date();
  expires.setDate(expires.getDate() + 30);

  await db.query(
    `insert into public.magic_link_tokens (customer_id, token_hash, expires_at)
     values ($1, $2, $3)`,
    [customerId, tokenHash, expires.toISOString()],
  );

  await db.end();

  console.log("✅ Token created.");
  console.log("Token:", token);
  console.log("URL:  http://localhost:3000/r/" + token);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
