import jwt from "jsonwebtoken";
import Owner from "../models/Owner.js";
import Otp from "../models/Otp.js";
import { sendOtpSms } from "../utils/sms.js";
import { issueOtp } from "../utils/otp.js";

const PHONE_REGEX = /^[0-9]{10}$/;

const generateOtpCode = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

function signToken(owner) {
  return jwt.sign({ id: owner._id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
}

// POST /api/auth/send-otp  -> used for both signup and login
export async function sendOtp(req, res) {
  const { phone } = req.body;

  if (!phone || !PHONE_REGEX.test(phone)) {
    res.status(400);
    throw new Error("A valid 10-digit phone number is required");
  }

  const code = generateOtpCode();
  const expiresAt = new Date(
    Date.now() + Number(process.env.OTP_EXPIRES_MINUTES || 5) * 60 * 1000
  );

  // Clear any previous unverified OTPs for this phone, then store a fresh one.
  await Otp.deleteMany({ phone, verified: false });
  await Otp.create({ phone, code, expiresAt });

  const result = await sendOtpSms(phone, code);
  if (!result.success) {
    res.status(502);
    throw new Error("Failed to send OTP SMS. Please try again in a moment.");
  }

  // Tell the client whether this phone already has an account, so the UI can
  // decide whether to ask for a name during verification.
  const existing = await Owner.findOne({ phone });

  res.json({
    message: "OTP sent successfully",
    isNewOwner: !existing,
    // Only exposed in dev mode (no SMS provider configured). Never leaked
    // once a real SMS has gone out.
    devOtp: result.dev ? code : undefined,
  });
}

// POST /api/auth/verify-otp  -> verify code, then register (new) or log in
export async function verifyOtp(req, res) {
  const { phone, otp, name } = req.body;

  if (!phone || !otp) {
    res.status(400);
    throw new Error("Phone and OTP are required");
  }

  const otpRecord = await Otp.findOne({ phone, code: otp, verified: false }).sort({
    createdAt: -1,
  });

  if (!otpRecord) {
    res.status(400);
    throw new Error("Invalid OTP");
  }
  if (otpRecord.expiresAt < new Date()) {
    res.status(400);
    throw new Error("OTP has expired, please request a new one");
  }

  let owner = await Owner.findOne({ phone });

  if (!owner) {
    // New owner -> registration requires a name. Don't burn the OTP yet;
    // the client resubmits the same code once it collects the name.
    if (!name || !name.trim()) {
      res.status(400);
      throw new Error("Name is required to create your account");
    }
    owner = await Owner.create({ name: name.trim(), phone });
  }

  otpRecord.verified = true;
  await otpRecord.save();

  res.json({ token: signToken(owner), owner });
}

// POST /api/auth/my-otp  -> send an OTP to the logged-in owner's own phone
// (used to confirm sensitive actions like changing plan prices)
export async function sendMyOtp(req, res) {
  const { dev, devCode } = await issueOtp(req.owner.phone);
  res.json({ message: "OTP sent", devOtp: dev ? devCode : undefined });
}

// GET /api/auth/me
export async function me(req, res) {
  res.json({ owner: req.owner });
}
