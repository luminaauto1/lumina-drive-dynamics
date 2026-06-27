import * as React from 'react';
import {
  DollarSign, Phone, MapPin, CreditCard, Users, Mail, Building2, Shield, FileText,
  Landmark, Plug, MessageCircle, ListChecks, LayoutDashboard, type LucideIcon,
} from 'lucide-react';

import BankIntegrationsTab from '@/components/admin/BankIntegrationsTab';
import TeamManagementTab from '@/components/admin/TeamManagementTab';
import RolePermissionsTab from '@/components/admin/RolePermissionsTab';
import DocumentSettingsTab from '@/components/admin/DocumentSettingsTab';
import BankBranchCodesTab from '@/components/admin/BankBranchCodesTab';
import EasySocialTab from '@/components/admin/EasySocialTab';
import WhatsAppTemplatesTab from '@/components/admin/WhatsAppTemplatesTab';
import StatusesTab from '@/components/admin/StatusesTab';
import EmailTemplatesTab from '@/components/admin/EmailTemplatesTab';
import AppearanceNavTab from '@/components/admin/AppearanceNavTab';
import { FinanceBody, SalesBody, ContactBody, LocationBody, FeaturesBody } from './SettingsFormBodies';

/**
 * Single source of truth for the routed Settings hub.
 *
 * Each entry maps a URL key (`/admin/settings/<key>`) to its title, one-line
 * description, icon, group, super-admin gate, and the React body to render on
 * its own page. The index page (`AdminSettings`) builds its grouped link list
 * from this, and the per-setting page (`AdminSettingPage`) looks the body up by
 * `:key`. Add a setting in ONE place and both the index and its route follow.
 */
export interface SettingDef {
  key: string;
  title: string;
  description: string;
  icon: LucideIcon;
  /** When true, only super-admins see the link AND can open the route. */
  requireSuperAdmin?: boolean;
  /** Page body. */
  body: React.ReactNode;
}

export interface SettingsGroup {
  label: string;
  items: SettingDef[];
}

// Documents body keeps its glass-card wrapper (as it had inside the old tab).
const DocumentsBody = () => (
  <div className="glass-card rounded-xl p-6">
    <DocumentSettingsTab />
  </div>
);

// Team page = team management + role permissions stacked (as the old tab did).
const TeamBody = () => (
  <div className="space-y-6">
    <TeamManagementTab />
    <RolePermissionsTab />
  </div>
);

export const SETTINGS_GROUPS: SettingsGroup[] = [
  {
    label: 'Business Profile',
    items: [
      { key: 'contact', title: 'Contact & Social', description: 'Phone, email, WhatsApp and review/social links shown across the site.', icon: Phone, body: <ContactBody /> },
      { key: 'location', title: 'Location', description: 'Show or hide the dealership address and map on the Contact page.', icon: MapPin, body: <LocationBody /> },
      { key: 'documents', title: 'Documents', description: 'Company, banking and VAT details printed on invoices and offers to purchase.', icon: FileText, requireSuperAdmin: true, body: <DocumentsBody /> },
    ],
  },
  {
    label: 'Finance & Deals',
    items: [
      { key: 'finance', title: 'Finance Calculator', description: 'Interest, deposit and balloon defaults and slider ranges for the public calculator.', icon: DollarSign, body: <FinanceBody /> },
      { key: 'banks', title: 'Banks', description: 'Finance partner banks and their application links.', icon: Building2, body: <BankIntegrationsTab /> },
      { key: 'sales', title: 'Sales Team & Target', description: 'Monthly sales target and the sales reps used when finalizing deals.', icon: Users, body: <SalesBody /> },
      { key: 'branches', title: 'Bank Branch Codes', description: 'Universal branch codes printed on finance-application PDFs by client bank.', icon: Landmark, requireSuperAdmin: true, body: <BankBranchCodesTab /> },
    ],
  },
  {
    label: 'Workflow',
    items: [
      { key: 'statuses', title: 'Statuses', description: 'Rename, recolour, reorder and message statuses for the finance pipeline.', icon: ListChecks, requireSuperAdmin: true, body: <StatusesTab /> },
      { key: 'appearance', title: 'Appearance & Navigation', description: 'Hide, show and reorder the admin sidebar sections and items.', icon: LayoutDashboard, requireSuperAdmin: true, body: <AppearanceNavTab /> },
    ],
  },
  {
    label: 'Communications',
    items: [
      { key: 'email', title: 'Email Templates', description: 'Status-driven client email templates (subject, heading, body, CTA).', icon: Mail, requireSuperAdmin: true, body: <EmailTemplatesTab /> },
      { key: 'whatsapp', title: 'WhatsApp Templates', description: 'Reusable WhatsApp message bodies used by click-to-chat links.', icon: MessageCircle, requireSuperAdmin: true, body: <WhatsAppTemplatesTab /> },
      { key: 'easysocial', title: 'EasySocial', description: 'EasySocial integration key and per-status tag overrides.', icon: Plug, requireSuperAdmin: true, body: <EasySocialTab /> },
    ],
  },
  {
    label: 'Access & Team',
    items: [
      { key: 'team', title: 'Team & Permissions', description: 'Invite staff, set roles, and control which sections each role can access.', icon: Shield, requireSuperAdmin: true, body: <TeamBody /> },
    ],
  },
  {
    label: 'System',
    items: [
      { key: 'features', title: 'Features & Diagnostics', description: 'Toggle storefront features (finance tab, trade-in, signature) and test email.', icon: CreditCard, body: <FeaturesBody /> },
    ],
  },
];

/** Flat lookup of every setting by its URL key. */
export const SETTINGS_BY_KEY: Record<string, SettingDef> = Object.fromEntries(
  SETTINGS_GROUPS.flatMap((g) => g.items).map((s) => [s.key, s]),
);
