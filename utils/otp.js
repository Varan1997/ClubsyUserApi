import Otp from "../models/Otp.js";
import { sendOtpSms } from "./sms.js";

export const generateOtpCode = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

// Create + send an OTP to a phone. Returns { dev, devCode }.
export async function issueOtp(phone) {
  const code = generateOtpCode();
  const expiresAt = new Date(
    Date.now() + Number(process.env.OTP_EXPIRES_MINUTES || 5) * 60 * 1000
  );
  await Otp.deleteMany({ phone, verified: false });
  await Otp.create({ phone, code, expiresAt });

  const result = await sendOtpSms(phone, code);
  if (!result.success) {
    const err = new Error("Failed to send OTP SMS. Please try again in a moment.");
    err.status = 502;
    throw err;
  }
  return { dev: !!result.dev, devCode: result.dev ? code : undefined };
}

// Verify (and consume) an OTP for a phone. Throws on failure.
export async function consumeOtp(phone, code) {
  if (!phone || !code) {
    const err = new Error("Phone and OTP are required");
    err.status = 400;
    throw err;
  }
  const record = await Otp.findOne({ phone, code, verified: false }).sort({
    createdAt: -1,
  });
  if (!record) {
    const err = new Error("Invalid OTP");
    err.status = 400;
    throw err;
  }
  if (record.expiresAt < new Date()) {
    const err = new Error("OTP has expired, please request a new one");
    err.status = 400;
    throw err;
  }
  record.verified = true;
  await record.save();
}
