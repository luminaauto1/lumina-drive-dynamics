import { Helmet } from 'react-helmet-async';
import { FolderOpen, FileText, HardDrive, Users, Car, FileSignature, Building2, Database } from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import DocumentManager from '@/components/admin/DocumentManager';
import {
  useDocumentStats, useStorageStats, STORAGE_LIMIT_BYTES,
  DOC_CATEGORY_LABELS, DocCategory,
} from '@/hooks/useDocuments';
import { formatBytes } from '@/lib/compressFile';

const CATEGORY_ICONS: Record<DocCategory, any> = {
  client: Users,
  vehicle: Car,
  deal: FileSignature,
  business: Building2,
};

const AdminDocumentsHub = () => {
  const { data: stats } = useDocumentStats();
  const { data: storage } = useStorageStats();

  const usedBytes = storage?.total_bytes ?? 0;
  const usedPct = Math.min(100, Math.round((usedBytes / STORAGE_LIMIT_BYTES) * 100));
  const remainingBytes = Math.max(0, STORAGE_LIMIT_BYTES - usedBytes);

  return (
    <AdminLayout>
      <Helmet>
        <title>Documents Hub | Lumina Admin</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* HEADER */}
        <div className="flex items-center gap-3">
          <FolderOpen className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Documents Hub</h1>
            <p className="text-sm text-muted-foreground">
              Central store for all client, vehicle, deal and business documents.
            </p>
          </div>
        </div>

        {/* TOP DASHBOARD */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Total documents */}
          <Card className="p-5">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <FileText className="w-4 h-4" /> Total documents
            </div>
            <p className="text-3xl font-bold">{stats?.totalCount ?? 0}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {formatBytes(stats?.totalBytes ?? 0)} stored in the hub
            </p>
          </Card>

          {/* Storage used */}
          <Card className="p-5">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <HardDrive className="w-4 h-4" /> Storage used
            </div>
            <p className="text-3xl font-bold">{formatBytes(usedBytes)}</p>
            <div className="mt-3 h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${usedPct >= 90 ? 'bg-destructive' : usedPct >= 70 ? 'bg-amber-500' : 'bg-primary'}`}
                style={{ width: `${usedPct}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {usedPct}% of {formatBytes(STORAGE_LIMIT_BYTES)} used
            </p>
          </Card>

          {/* Storage left */}
          <Card className="p-5">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Database className="w-4 h-4" /> Storage left
            </div>
            <p className="text-3xl font-bold">{formatBytes(remainingBytes)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {storage?.total_files ?? 0} files across all storage
            </p>
          </Card>
        </div>

        {/* BY TYPE */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {(Object.keys(DOC_CATEGORY_LABELS) as DocCategory[]).map((cat) => {
            const Icon = CATEGORY_ICONS[cat];
            const c = stats?.byCategory?.[cat];
            return (
              <Card key={cat} className="p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <Icon className="w-4 h-4" /> {DOC_CATEGORY_LABELS[cat]}
                </div>
                <p className="text-2xl font-bold">{c?.count ?? 0}</p>
                <p className="text-xs text-muted-foreground">{formatBytes(c?.bytes ?? 0)}</p>
              </Card>
            );
          })}
        </div>

        {/* QUICK ACCESS: BUSINESS DOCS */}
        <Card className="p-5">
          <DocumentManager
            title="Business documents (quick access)"
            description="Company registration, bank templates, supplier agreements, licenses, etc."
            category="business"
          />
        </Card>

        {/* BROWSE BY TYPE */}
        <Card className="p-5">
          <h2 className="text-sm font-semibold mb-3">Browse all documents</h2>
          <Tabs defaultValue="client">
            <TabsList>
              {(Object.keys(DOC_CATEGORY_LABELS) as DocCategory[]).map((cat) => (
                <TabsTrigger key={cat} value={cat}>{DOC_CATEGORY_LABELS[cat]}</TabsTrigger>
              ))}
            </TabsList>
            {(Object.keys(DOC_CATEGORY_LABELS) as DocCategory[]).map((cat) => (
              <TabsContent key={cat} value={cat} className="mt-4">
                <DocumentManager
                  category={cat}
                  emptyHint={`No ${DOC_CATEGORY_LABELS[cat].toLowerCase()} yet.`}
                />
              </TabsContent>
            ))}
          </Tabs>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminDocumentsHub;
