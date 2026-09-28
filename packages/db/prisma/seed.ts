import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const vendor1 = await prisma.vendor.upsert({
    where: { id: "00000000-0000-4000-8000-000000000001" },
    update: {},
    create: {
      id: "00000000-0000-4000-8000-000000000001",
      name: "18Bites Food Court — North",
      prepTimeDefaultMinutes: 25,
    },
  });

  const vendor2 = await prisma.vendor.upsert({
    where: { id: "00000000-0000-4000-8000-000000000002" },
    update: {},
    create: {
      id: "00000000-0000-4000-8000-000000000002",
      name: "18Bites Food Court — South",
      prepTimeDefaultMinutes: 20,
    },
  });

  const grounds = [
    {
      id: "10000000-0000-4000-8000-000000000001",
      name: "City Cricket Arena",
      address: "Sector 12 Sports Complex",
      lat: 28.6139,
      lng: 77.209,
      vendorId: vendor1.id,
      serviceHours: "6:00–22:00",
    },
    {
      id: "10000000-0000-4000-8000-000000000002",
      name: "Greenfield Turf Ground",
      address: "MG Road, Plot 4",
      lat: 28.5355,
      lng: 77.391,
      vendorId: vendor1.id,
      serviceHours: "7:00–21:00",
    },
    {
      id: "10000000-0000-4000-8000-000000000003",
      name: "Riverside Cricket Nets",
      address: "Yamuna Bank Sports Hub",
      lat: 28.6517,
      lng: 77.2673,
      vendorId: vendor2.id,
      serviceHours: "6:30–20:30",
    },
  ];

  for (const g of grounds) {
    await prisma.ground.upsert({
      where: { id: g.id },
      update: g,
      create: g,
    });
  }

  const catMain = await prisma.menuCategory.upsert({
    where: { id: "20000000-0000-4000-8000-000000000001" },
    update: {},
    create: {
      id: "20000000-0000-4000-8000-000000000001",
      vendorId: vendor1.id,
      name: "Meals",
      sortOrder: 1,
    },
  });

  const catSnacks = await prisma.menuCategory.upsert({
    where: { id: "20000000-0000-4000-8000-000000000002" },
    update: {},
    create: {
      id: "20000000-0000-4000-8000-000000000002",
      vendorId: vendor1.id,
      name: "Snacks & Drinks",
      sortOrder: 2,
    },
  });

  const menuItems = [
    {
      id: "30000000-0000-4000-8000-000000000001",
      vendorId: vendor1.id,
      categoryId: catMain.id,
      name: "Chicken Biryani Box",
      description: "Post-match fuel",
      pricePaise: 22000,
      isVeg: false,
      prepMinutes: 20,
    },
    {
      id: "30000000-0000-4000-8000-000000000002",
      vendorId: vendor1.id,
      categoryId: catMain.id,
      name: "Veg Thali",
      description: "Balanced meal",
      pricePaise: 18000,
      isVeg: true,
      prepMinutes: 15,
    },
    {
      id: "30000000-0000-4000-8000-000000000003",
      vendorId: vendor1.id,
      categoryId: catSnacks.id,
      name: "Energy Shake",
      description: "Banana peanut protein",
      pricePaise: 12000,
      isVeg: true,
      prepMinutes: 5,
    },
    {
      id: "30000000-0000-4000-8000-000000000004",
      vendorId: vendor1.id,
      categoryId: catSnacks.id,
      name: "Grilled Sandwich",
      pricePaise: 15000,
      isVeg: true,
      prepMinutes: 10,
    },
    {
      id: "30000000-0000-4000-8000-000000000005",
      vendorId: vendor2.id,
      categoryId: null,
      name: "Paneer Wrap",
      pricePaise: 16000,
      isVeg: true,
      prepMinutes: 12,
    },
  ];

  for (const item of menuItems) {
    await prisma.menuItem.upsert({
      where: { id: item.id },
      update: item,
      create: item,
    });
  }

  const adminHash = await bcrypt.hash("admin123", 10);
  await prisma.user.upsert({
    where: { email: "admin@18bites.local" },
    update: {},
    create: {
      email: "admin@18bites.local",
      passwordHash: adminHash,
      name: "Platform Admin",
      roles: [UserRole.ADMIN],
    },
  });

  const kitchenHash = await bcrypt.hash("kitchen123", 10);
  await prisma.user.upsert({
    where: { email: "kitchen@18bites.local" },
    update: {},
    create: {
      email: "kitchen@18bites.local",
      passwordHash: kitchenHash,
      name: "North Kitchen",
      roles: [UserRole.KITCHEN],
      kitchenVendorId: vendor1.id,
    },
  });

  await prisma.user.upsert({
    where: { phone: "+919999000001" },
    update: {},
    create: {
      phone: "+919999000001",
      name: "Rider Rahul",
      roles: [UserRole.RIDER, UserRole.PLAYER],
      riderProfile: { create: { vehicle: "Bike", isAvailable: true } },
    },
  });

  await prisma.user.upsert({
    where: { phone: "+919999000002" },
    update: {},
    create: {
      phone: "+919999000002",
      name: "Rider Priya",
      roles: [UserRole.RIDER, UserRole.PLAYER],
      riderProfile: { create: { vehicle: "Scooter", isAvailable: false } },
    },
  });

  console.log("Seed complete.");
  console.log("Admin: admin@18bites.local / admin123");
  console.log("Kitchen: kitchen@18bites.local / kitchen123");
  console.log("Riders: +919999000001, +919999000002 (OTP in API logs when SMS_PROVIDER=mock)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
