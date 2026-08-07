/**
 * Sample user records for the CRUD data table.
 */

export type UserRole = "admin" | "editor" | "viewer";
export type UserStatus = "active" | "inactive" | "pending";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  plan: "free" | "pro" | "enterprise";
  joined: string;
}

const FIRST = [
  "Olivia", "Jackson", "Isabella", "William", "Sofia", "Ethan", "Ava",
  "Noah", "Mia", "Liam", "Amelia", "Lucas", "Harper", "Mason", "Evelyn",
  "Logan", "Luna", "Elijah", "Aria", "Henry",
];

const LAST = [
  "Martin", "Lee", "Nguyen", "Kim", "Davis", "Chen", "Rodriguez", "Patel",
  "Thompson", "Walker", "Brown", "Garcia", "Miller", "Wilson", "Moore",
  "Taylor", "Anderson", "Thomas", "Jackson", "White",
];

const ROLES: UserRole[] = ["admin", "editor", "viewer"];
const STATUSES: UserStatus[] = ["active", "active", "active", "inactive", "pending"];
const PLANS = ["free", "pro", "pro", "enterprise"] as const;

export const USERS: User[] = FIRST.map((first, i) => {
  const last = LAST[i % LAST.length];
  return {
    id: `usr_${String(i + 1).padStart(3, "0")}`,
    name: `${first} ${last}`,
    email: `${first.toLowerCase()}.${last.toLowerCase()}@${["acme.io", "wave.dev", "gleam.co", "orbital.app"][i % 4]}`,
    role: ROLES[i % ROLES.length],
    status: STATUSES[i % STATUSES.length],
    plan: PLANS[i % PLANS.length],
    joined: new Date(2024 + (i % 2), (i * 3) % 12, (i % 27) + 1).toLocaleDateString(
      "en-US",
      { month: "short", day: "numeric", year: "numeric" }
    ),
  };
});
