import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const EnvSchema = z.object({
  PORT: z.coerce.number().default(3000),
  WHATSAPP_VERIFY_TOKEN: z.string().default("botao-verify-token"),
  TIMEZONE: z.string().default("America/Sao_Paulo"),
});

export const env = EnvSchema.parse(process.env);
