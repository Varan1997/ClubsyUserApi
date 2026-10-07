// SMS OTP delivery via 2Factor.in (https://2factor.in/API/DOCS/SMS_OTP.html).
// If TWOFACTOR_API_KEY is not set, OTPs are logged to the console (dev mode).
//
// We generate/store/verify the OTP ourselves (see authController + Otp model),
// so this uses 2Factor's "send a caller-supplied OTP" endpoint rather than
// their auto-generate-and-verify flow.
export async function sendOtpSms(phone, otp) {
  const apiKey = process.env.TWOFACTOR_API_KEY;

  if (!apiKey) {
    console.log(`[DEV MODE] OTP for ${phone}: ${otp}`);
    return { success: true, dev: true };
  }

  // Indian carriers require transactional SMS to use a DLT-approved template.
  // If you've registered one in your 2Factor dashboard, set its name here.
  const templateName = process.env.TWOFACTOR_TEMPLATE_NAME;
  const path = templateName
    ? `SMS/${phone}/${otp}/${encodeURIComponent(templateName)}`
    : `SMS/${phone}/${otp}`;

  try {
    const res = await fetch(`https://2factor.in/API/V1/${apiKey}/${path}`);
    const data = await res.json().catch(() => ({}));

    if (data.Status !== "Success") {
      console.error(`[2Factor] Failed to send OTP to ${phone}:`, data.Details || data);
      return { success: false, dev: false, error: data.Details || "Unknown error" };
    }

    return { success: true, dev: false, sessionId: data.Details };
  } catch (error) {
    console.error(`[2Factor] Error sending OTP to ${phone}:`, error.message);
    return { success: false, dev: false, error: error.message };
  }
}
