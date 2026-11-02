import type { Company } from "./types";
export const companies: Company[] = [
  {
    id: "akar",
    name: "Akar Sepakat Sdn Bhd",
    short: "Akar Sepakat",
    initials: "AS",
    color: "#7954ed",
    light: "#f0ebff",
  },
  {
    id: "mastura",
    name: "Mastura",
    short: "Mastura",
    initials: "M",
    color: "#379b84",
    light: "#e7f5f0",
  },
  {
    id: "trust",
    name: "Trust Me",
    short: "Trust Me",
    initials: "TM",
    color: "#5b8fda",
    light: "#ebf2ff",
  },
  {
    id: "amiza",
    name: "Amiza",
    short: "Amiza",
    initials: "A",
    color: "#d59848",
    light: "#fcf3e6",
  },
  {
    id: "kugiran",
    name: "Kugiran Sdn Bhd",
    short: "Kugiran",
    initials: "K",
    color: "#cb7199",
    light: "#fbeef4",
  },
];
export const companyById = (id: string) => companies.find((c) => c.id === id)!;
export const workTypes = [
  "MULL & Pavement",
  "Resurface",
  "Curb",
  "Traffic Management Plan (TMP)",
  "CCTV",
  "Other",
];
export const expenseCategories = [
  "Materials",
  "Labour",
  "Transportation",
  "Equipment",
  "Property",
  "Subcontractor",
  "Other",
];
export const overheadCategories = [
  "Office Rental",
  "Administrative Salaries",
  "Utilities",
  "Internet",
  "Vehicle Maintenance",
  "Insurance",
  "Office Supplies",
  "Other Operating Expenses",
];
export const locations = [
  { name: "Shah Alam, Selangor", lat: 3.0738, lng: 101.5183 },
  { name: "Subang Jaya, Selangor", lat: 3.0567, lng: 101.5851 },
  { name: "Bandar Sunway, Selangor", lat: 3.0695, lng: 101.6068 },
  { name: "Petaling Jaya, Selangor", lat: 3.1073, lng: 101.6067 },
  { name: "Kuala Lumpur", lat: 3.139, lng: 101.6869 },
  { name: "Klang, Selangor", lat: 3.0449, lng: 101.4456 },
  { name: "Puchong, Selangor", lat: 3.0256, lng: 101.6186 },
  { name: "Putrajaya", lat: 2.9264, lng: 101.6964 },
];
