import type { Dictionary } from "../types";

const en: Dictionary = {
  meta: {
    siteName: "Tenant Portal",
    description: "View rent bills, payments, and lease dates.",
    homeTitle: "Tenant Portal",
    loginTitle: "Tenant sign in",
    adminTitle: "Admin - Reset room code",
    adminLoginTitle: "Admin sign in",
  },
  common: {
    room: "Room",
    sampleData: "sample data",
    logOut: "Log out",
    switchLocale: "繁體中文",
    switchLocaleLabel: "View this page in Traditional Chinese",
  },
  login: {
    heading: "Tenant sign in",
    subtitle: "Select your room and enter your access code.",
    roomLabel: "Room",
    codeLabel: "Access code",
    codePlaceholder: "10-character code",
    checking: "Checking...",
    signIn: "Sign in",
    landlordPrompt: "Landlord?",
    adminArea: "Admin area",
    errors: {
      invalidCredentials: "Invalid room or access code",
    },
  },
  room: {
    headingTemplate: "Room {room}",
    placeholderBadge: "Placeholder data - for demonstration only",
    bills: "Bills",
    payments: "Payments",
    leaseDates: "Lease dates",
    sampleDataCaption: "(sample data)",
    due: "due",
    received: "received",
    status: {
      open: "open",
      paid: "paid",
    },
    labels: {
      rentCurrentMonth: "Rent - current month",
      utilities: "Utilities",
      rentPreviousMonth: "Rent - previous month",
    },
    leaseStart: "Lease start",
    leaseEnd: "Lease end",
    renewalDue: "Renewal decision due",
  },
  denied: {
    heading: "Not authorized",
    message: "You are not authorized to view this room's dashboard.",
    backToDashboard: "Back to your dashboard",
  },
  adminLogin: {
    heading: "Admin sign in",
    subtitle: "Landlord access only.",
    passwordLabel: "Admin password",
    checking: "Checking...",
    signIn: "Sign in",
    errors: {
      accessDenied: "Access denied",
    },
  },
  admin: {
    heading: "Room access codes",
    subtitle:
      "Reset the access code for any room. A new code is shown once - copy it before leaving this page.",
    roomLabel: "Room",
    newCodeLabel: "New 10-character code (leave blank to generate one)",
    codePlaceholder: "e.g. R3turnK3y55",
    resetting: "Resetting...",
    resetCode: "Reset code",
    errors: {
      accessDenied: "Access denied",
      invalidRoom: "Select a room (A-E).",
    },
    successTemplate: "Room {room} access code reset.",
    copy: "Copy",
    copied: "Copied",
    warning: "This code is shown only once. It is stored only as a bcrypt hash from now on.",
    resetAnother: "Reset another room",
  },
};

export default en;
