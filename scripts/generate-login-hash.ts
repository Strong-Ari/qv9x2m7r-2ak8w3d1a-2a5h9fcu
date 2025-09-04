import * as crypto from "crypto";
import * as dotenv from "dotenv";

dotenv.config(); // Charge les variables depuis .env

const email = process.env.METRICOOL_EMAIL;
const pass = process.env.METRICOOL_PASSWORD;

if (!email || !pass) {
  console.error("❌ METRICOOL_EMAIL or METRICOOL_PASSWORD is undefined");
  process.exit(1);
}

const hash = crypto
  .createHash("sha256")
  .update(`${email}:${pass}`)
  .digest("hex")
  .slice(0, 8);

console.log(`LOGIN_HASH=${hash}`);
