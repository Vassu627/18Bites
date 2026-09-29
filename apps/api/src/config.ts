import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

export const config = {
  port: parseInt(process.env.API_PORT || "4000", 10),
  jwtSecret: process.env.JWT_SECRET || "dev-secret-change-me",
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || "dev-refresh-secret",
  accessTokenTtl: "15m",
  refreshTokenTtl: "7d",
  smsProvider: process.env.SMS_PROVIDER || "mock",
  msg91AuthKey: process.env.MSG91_AUTH_KEY || "",
  msg91TemplateId: process.env.MSG91_TEMPLATE_ID || "",
  twilioAccountSid: process.env.TWILIO_ACCOUNT_SID || "",
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN || "",
  twilioFrom: process.env.TWILIO_FROM_NUMBER || "",
  deliveryBufferMinutes: 15,
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:3000",
};
