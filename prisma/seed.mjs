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
    name: "Kitchen & Dining",
    slug: "kitchen",
    color: "#dc2626",
    description: "Catering for events, special diets and allergies, dining hall and kitchen equipment",
    categories: ["Catering request", "Special diet / allergies", "Dining hall", "Kitchen equipment", "Menu feedback", "Hygiene"],
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

// The school's network printers (same list as the control-room dashboard).
// Added to IT only while there are no printers yet, so ones deleted later stay
// deleted. Model, serial number and toner levels are read from the printers
// themselves once the app is running.
const PRINTERS = [
  ["Art Center", "172.25.200.2"],
  ["De Nobili Registrar", "172.25.200.3"],
  ["Aurora", "172.25.200.4"],
  ["Monticello PT", "172.25.200.5"],
  ["MacDermid", "172.25.200.6"],
  ["Gatto P2", "172.25.200.9"],
  ["De Nobili Dorm", "172.25.200.11"],
  [null, "172.25.200.12"],
  ["Photolab", "172.25.200.30"],
  ["Censi", "172.25.200.33"],
  [null, "172.25.200.35"],
  [null, "172.25.200.38"],
  ["Coach House", "172.25.200.40"],
  [null, "172.25.200.41"],
  [null, "172.25.200.55"],
  ["Boglia 1", "172.25.200.57"],
  ["Focolare", "172.25.200.61"],
  ["Sport Office", "172.25.200.70"],
  ["De Nobili Faculty", "172.25.200.73"],
  [null, "172.25.200.75"],
  ["Security", "172.25.200.93"],
  ["Lanterna", "172.25.200.99"],
  ["Gatto PT", "172.25.200.100"],
  ["De Nobili LRC", "172.25.200.105"],
  [null, "172.25.200.106"],
  ["Kitchen", "172.25.200.109"],
  ["HR", "172.25.200.120"],
  ["Business Office", "172.25.200.125"],
  ["Fiammetta", "172.25.200.129"],
  ["Music 1", "172.25.200.130"],
  ["Del Sole", "172.25.200.141"],
  ["Hadsall Faculty", "172.25.200.192"],
  ["Science", "172.25.200.194"],
  ["Monticello Faculty", "172.25.200.205"],
  ["Palmer", "172.25.200.206"],
  ["Monticello Dorm", "172.25.200.207"],
  ["Reception", "172.25.200.210"],
  [null, "172.25.200.211"],
  [null, "172.25.200.231"],
  ["Library", "172.25.200.250"],
  ["Giani", "172.25.200.253"],
];

const it = await prisma.department.findUnique({ where: { slug: "it" } });
if (it && !(await prisma.asset.count({ where: { type: "Printer" } }))) {
  const locations = new Map((await prisma.location.findMany()).map((l) => [l.name.toLowerCase(), l.id]));
  const last = await prisma.asset.findFirst({ where: { tag: { startsWith: "TAS-" } }, orderBy: { tag: "desc" } });
  let n = last ? Number.parseInt(last.tag.slice(4), 10) + 1 : 1;
  for (const [name, ip] of PRINTERS) {
    await prisma.asset.create({
      data: {
        tag: `TAS-${String(n++).padStart(5, "0")}`,
        name: name ? `${name} printer` : `Printer ${ip}`,
        type: "Printer",
        departmentId: it.id,
        locationId: (name && locations.get(name.toLowerCase())) || null,
        extra: JSON.stringify({ "IP address": ip }),
        activity: { create: { body: "added from the network printer list" } },
      },
    });
  }
  console.log(`Added ${PRINTERS.length} printers.`);
}

console.log("Seeded departments, categories and locations.");
await prisma.$disconnect();
