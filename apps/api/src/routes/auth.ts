import { Router } from "express";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
import { prisma, UserRole } from "@18bites/db";
import { otpRequestSchema, otpVerifySchema, kitchenLoginSchema } from "@18bites/shared";
import { generateOtp, hashOtp } from "../lib/crypto";
import { sendSms } from "../lib/sms";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../lib/jwt";
import type { AuthRequest } from "../middleware/auth";
import { authenticate } from "../middleware/auth";
import type { UserRole as SharedUserRole } from "@18bites/shared";

const router = Router();

const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Too many OTP requests" },
});

router.post("/otp/request", otpLimiter, async (req, res) => {
  const parsed = otpRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { phone, role } = parsed.data;
  const code = generateOtp();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  let user = await prisma.user.findUnique({
    where: { phone },
    include: { riderProfile: true },
  });
  if (!user) {
    user = await prisma.user.create({
      data: {
        phone,
        roles: [role as UserRole],
      },
      include: { riderProfile: true },
    });
  } else if (!user.roles.includes(role as UserRole)) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { roles: { set: [...new Set([...user.roles, role as UserRole])] } },
      include: { riderProfile: true },
    });
  }

  if (role === "RIDER" && !user.riderProfile) {
    await prisma.riderProfile.create({ data: { userId: user.id } });
  }

  await prisma.otpChallenge.create({
    data: {
      phone,
      codeHash: hashOtp(code),
      expiresAt,
      userId: user.id,
    },
  });

  await sendSms(phone, `Your 18Bites verification code is ${code}. Valid for 10 minutes.`);

  const devPayload =
    process.env.SMS_PROVIDER === "mock" ? { devCode: code } : {};

  res.json({ ok: true, message: "OTP sent", ...devPayload });
});

router.post("/otp/verify", async (req, res) => {
  const parsed = otpVerifySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { phone, code } = parsed.data;

  const challenge = await prisma.otpChallenge.findFirst({
    where: { phone },
    orderBy: { createdAt: "desc" },
  });

  if (!challenge || challenge.expiresAt < new Date()) {
    res.status(400).json({ error: "OTP expired or not found" });
    return;
  }
  if (challenge.attempts >= 5) {
    res.status(429).json({ error: "Too many attempts" });
    return;
  }

  if (challenge.codeHash !== hashOtp(code)) {
    await prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { attempts: challenge.attempts + 1 },
    });
    res.status(400).json({ error: "Invalid OTP" });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { phone },
    include: { riderProfile: true },
  });
  if (!user) {
    res.status(400).json({ error: "User not found" });
    return;
  }

  const payload = {
    sub: user.id,
    roles: user.roles as SharedUserRole[],
    vendorId: user.kitchenVendorId ?? undefined,
  };

  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.json({
    accessToken,
    user: {
      id: user.id,
      phone: user.phone,
      name: user.name,
      roles: user.roles,
    },
  });
});

router.post("/kitchen/login", async (req, res) => {
  const parsed = kitchenLoginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });
  if (
    !user?.passwordHash ||
    (!user.roles.includes("KITCHEN") && !user.roles.includes("ADMIN"))
  ) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const payload = {
    sub: user.id,
    roles: user.roles as SharedUserRole[],
    vendorId: user.kitchenVendorId ?? undefined,
  };

  res.json({
    accessToken: signAccessToken(payload),
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      roles: user.roles,
      vendorId: user.kitchenVendorId,
    },
  });
});

router.post("/refresh", async (req, res) => {
  const token = req.cookies?.refreshToken as string | undefined;
  if (!token) {
    res.status(401).json({ error: "No refresh token" });
    return;
  }
  try {
    const payload = verifyRefreshToken(token);
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) {
      res.status(401).json({ error: "User not found" });
      return;
    }
    const fresh = {
      sub: user.id,
      roles: user.roles as SharedUserRole[],
      vendorId: user.kitchenVendorId ?? undefined,
    };
    res.json({ accessToken: signAccessToken(fresh) });
  } catch {
    res.status(401).json({ error: "Invalid refresh token" });
  }
});

router.get("/me", authenticate, async (req: AuthRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.sub } });
  if (!user) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json({
    id: user.id,
    phone: user.phone,
    email: user.email,
    name: user.name,
    roles: user.roles,
    vendorId: user.kitchenVendorId,
  });
});

export default router;
