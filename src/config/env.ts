import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const EnvSchema = z.object({
  PORT: z.coerce.number().default(3000),
  WHATSAPP_VERIFY_TOKEN: z.string().default("botao-verify-token"),
  TIMEZONE: z.string().default("America/Sao_Paulo"),
  PERSISTENCE_PROVIDER: z.enum(["in_memory", "google_sheets"]).default("in_memory"),
  GOOGLE_SHEETS_SPREADSHEET_ID: z.string().optional(),
  GOOGLE_SHEETS_PREDICTIONS_RANGE: z.string().default("Palpites!A:G"),
  GOOGLE_SERVICE_ACCOUNT_EMAIL: z.string().optional(),
  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: z.string().optional(),
});

export const env = EnvSchema.parse(process.env);
