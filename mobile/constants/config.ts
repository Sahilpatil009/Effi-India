/**
 * Central config for the mobile app.
 *
 * AGENT_API_URL should point at the deployed token server base path.
 * Use the /api base directly so the mobile app hits the function endpoint
 * without depending on a deployment rewrite.
 */
export const AGENT_API_URL =
  process.env.EXPO_PUBLIC_AGENT_API_URL ??
  "https://token-server-tawny.vercel.app/api";

export const COMPLAINT_CATEGORIES = [
  {
    id: "SANITATION" as const,
    label: "Sanitation",
    description: "Garbage overflow, missed pickup, waste complaints",
    iconName: "delete-outline" as const,
    color: "#10B981",
  },
  {
    id: "POTHOLE" as const,
    label: "Potholes",
    description: "Potholes, road damage, dangerous streets",
    iconName: "road-variant" as const,
    color: "#F97316",
  },
  {
    id: "POWER_OUTAGE" as const,
    label: "Power Outage",
    description: "No power, cuts, transformer issues",
    iconName: "transmission-tower" as const,
    color: "#F59E0B",
  },
] as const;

export type ComplaintCategoryId =
  (typeof COMPLAINT_CATEGORIES)[number]["id"];
