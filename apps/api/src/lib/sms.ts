import { config } from "../config";
import { logger } from "./logger";

export async function sendSms(phone: string, message: string): Promise<void> {
  if (config.smsProvider === "mock") {
    logger.info({ phone, message }, "SMS mock send");
    return;
  }

  if (config.smsProvider === "msg91" && config.msg91AuthKey) {
    const body = {
      template_id: config.msg91TemplateId,
      short_url: "0",
      recipients: [{ mobiles: phone.replace(/\D/g, ""), var: message }],
    };
    const res = await fetch("https://control.msg91.com/api/v5/flow/", {
      method: "POST",
      headers: {
        authkey: config.msg91AuthKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`MSG91 failed: ${res.status}`);
    }
    return;
  }

  if (config.smsProvider === "twilio" && config.twilioAccountSid) {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${config.twilioAccountSid}/Messages.json`;
    const params = new URLSearchParams({
      To: phone,
      From: config.twilioFrom,
      Body: message,
    });
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization:
          "Basic " +
          Buffer.from(`${config.twilioAccountSid}:${config.twilioAuthToken}`).toString("base64"),
      },
      body: params,
    });
    if (!res.ok) {
      throw new Error(`Twilio failed: ${res.status}`);
    }
    return;
  }

  logger.warn("SMS provider not configured, falling back to mock");
  logger.info({ phone, message }, "SMS mock send");
}
