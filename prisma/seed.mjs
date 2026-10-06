// Creates the starting departments, categories and locations. Safe to run
// again: everything is upserted by its unique name.
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { PrismaClient } = require("../src/generated/prisma");

const prisma = new PrismaClient();

const DEPARTMENTS = [
  {
    name: "IT",
    slug: "it",
    color: "#2563eb",
    description: "Computers, iPads, printers, Wi-Fi, accounts and classroom AV",
    categories: ["Hardware", "Software", "Account & password", "Network / Wi-Fi", "Printer", "Classroom AV"],
  },
  {
    name: "Facilities",
    slug: "facilities",
    color: "#d97706",
    description: "Building maintenance, repairs, heating, furniture and room setups",
    categories: ["Electrical", "Plumbing", "Heating / AC", "Furniture", "Cleaning", "Room setup", "Grounds"],
  },
  {
    name: "Reception",
    slug: "reception",
    color: "#059669",
    description: "Visitors and incoming deliveries",
    takesTickets: false,
    categories: [],
  },
];

const LOCATIONS = [
  "Palazzo Main",
  "Lodge",
  "Belvedere",
  "Hadsall House",
  "Science Center",
  "Library",
  "Gymnasium",
  "Theater",
  "Dining Hall",
  "Art Center",
];

for (const { categories, ...dept } of DEPARTMENTS) {
  const d = await prisma.department.upsert({
    where: { slug: dept.slug },
    update: {},
    create: dept,
  });
  for (const name of categories) {
    await prisma.category.upsert({
      where: { departmentId_name: { departmentId: d.id, name } },
      update: {},
      create: { departmentId: d.id, name },
    });
  }
}

for (const name of LOCATIONS) {
  await prisma.location.upsert({ where: { name }, update: {}, create: { name } });
}

console.log("Seeded departments, categories and locations.");
await prisma.$disconnect();
