// PushToSignioButton.tsx
// Drop into the Deal Room (detailed finance app view) header, next to Edit / Download PDF.
// Usage:  <PushToSignioButton application={application} />
//
// It opens the Signio "Online Finance Application" and hands the data to the
// Tampermonkey autofill script via window.name (keeps PII out of the URL/history).
// The script fills steps 1–5 automatically and stops at the Declaration; the human
// ticks the declaration + reCAPTCHA and clicks Submit (reCAPTCHA can't be automated).
//
// Prerequisite: each F&I user installs the companion userscript "signio-autofill.user.js"
// in Tampermonkey (one-time).

import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";

// Your dealer integration link:
const SIGNIO_URL =
  "https://goa.signio.co.za/ThirdPartyIntegration/?uuid=0000019d-8b14-51e0-a0c4-f22179bee56a";

const HANDOFF_PREFIX = "LUMINA_SIGNIO:";

// Pass RAW fields — the userscript handles all normalization (gender, bank→branch,
// employment_type, qualification, ID-Luhn, etc.) and flags anything it can't fill.
function buildSignioPayload(app: any) {
  // Best-effort suburb from the free-text address until a structured `suburb` column exists.
  const parts = String(app.street_address || "")
    .split(/[,\n]/)
    .map((s: string) => s.trim())
    .filter(Boolean);
  const suburb = app.suburb || (parts.length >= 2 ? parts[parts.length - 2] : "");

  const kinTokens = String(app.kin_name || "").trim().split(/\s+/).filter(Boolean);

  return {
    // Basic
    id_number: app.id_number,
    id_type: app.id_type,
    first_name: app.first_name,
    last_name: app.last_name,
    full_name: app.full_name || [app.first_name, app.last_name].filter(Boolean).join(" "),
    email: app.email,
    phone: app.phone,
    // Personal
    gender: app.gender,
    marital_status: app.marital_status,
    marriage_type: app.marriage_type,
    spouse_first_name: app.spouse_first_name,
    spouse_surname: app.spouse_surname,
    nationality: app.nationality,
    qualification: app.qualification,
    street_address: app.street_address,
    suburb,
    area_code: app.area_code,
    // Next of kin (split combined name until structured columns exist)
    kin_relation: app.kin_relation, // undefined until column added → userscript flags it
    kin_first_name: app.kin_first_name || kinTokens[0],
    kin_surname: app.kin_surname || kinTokens.slice(1).join(" ") || undefined,
    kin_contact: app.kin_contact,
    // Employment
    employer_name: app.employer_name,
    job_title: app.job_title,
    employment_type: app.employment_type,
    employment_period: app.employment_period, // "X Years, Y Months" → employer tenure
    employer_address: app.employer_address,
    employer_suburb: app.employer_suburb,
    // Banking
    bank_name: app.bank_name,
    account_type: app.account_type,
    account_number: app.account_number,
    // Income / expenses
    gross_salary: app.gross_salary,
    net_salary: app.net_salary,
    additional_income: app.additional_income,
    total_expenses: app.expenses_summary,
  };
}

export function PushToSignioButton({ application }: { application: any }) {
  const handlePush = () => {
    const payload = buildSignioPayload(application);

    // Open a blank tab first, stamp the payload onto window.name, THEN navigate.
    const win = window.open("about:blank", "_blank");
    if (!win) {
      alert("Allow pop-ups for Lumina so it can open Signio.");
      return;
    }
    win.name = HANDOFF_PREFIX + JSON.stringify(payload);
    win.location.href = SIGNIO_URL;
  };

  return (
    <Button onClick={handlePush} variant="default" className="gap-2">
      <Send className="h-4 w-4" />
      Push to Signio
    </Button>
  );
}
