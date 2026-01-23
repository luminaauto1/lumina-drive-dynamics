import { useState, useEffect } from 'react';
import { FileText, Image as ImageIcon, Download, Eye, Loader2, FolderOpen, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import AdminDocumentUpload from './AdminDocumentUpload';

interface ClientDocumentViewerProps {
  accessToken: string | null;
  clientName?: string;
}

interface StorageFile {
  name: string;
  id: string;
  created_at: string;
  metadata?: Record<string, any>;
}

interface DocumentCategory {
  id: string;
  label: string;
  files: StorageFile[];
}

const DOCUMENT_CATEGORIES = [
  { id: 'id-card', label: 'ID Card' },
  { id: 'drivers-license', label: "Driver's License" },
  { id: 'payslips', label: 'Payslips' },
  { id: 'bank-statements', label: 'Bank Statements' },
];

const ClientDocumentViewer = ({ accessToken, clientName }: ClientDocumentViewerProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [documents, setDocuments] = useState<DocumentCategory[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<'image' | 'pdf' | null>(null);
  const [previewName, setPreviewName] = useState<string>('');
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  useEffect(() => {
    if (accessToken) {
      fetchDocuments();
    }
  }, [accessToken]);

  const fetchDocuments = async () => {
    if (!accessToken) return;
    
    setIsLoading(true);
    const categories: DocumentCategory[] = [];

    try {
      for (const category of DOCUMENT_CATEGORIES) {
        const folderPath = `${accessToken}/${category.id}`;
        
        const { data, error } = await supabase.storage
          .from('client-docs')
          .list(folderPath);

        if (error) {
          console.error(`Error listing ${category.id}:`, error);
          continue;
        }

        if (data && data.length > 0) {
          categories.push({
            id: category.id,
            label: category.label,
            files: data.filter(f => f.name !== '.emptyFolderPlaceholder') as StorageFile[],
          });
        }
      }

      setDocuments(categories);
    } catch (err) {
      console.error('Error fetching documents:', err);
      toast.error('Failed to load documents');
    } finally {
      setIsLoading(false);
    }
  };

  const getFileUrl = async (categoryId: string, fileName: string): Promise<string | null> => {
    if (!accessToken) return null;
    
    const filePath = `${accessToken}/${categoryId}/${fileName}`;
    
    const { data, error } = await supabase.storage
      .from('client-docs')
      .createSignedUrl(filePath, 3600); // 1 hour expiry

    if (error) {
      console.error('Error getting signed URL:', error);
      return null;
    }

    return data.signedUrl;
  };

  const handlePreview = async (categoryId: string, file: StorageFile) => {
    const url = await getFileUrl(categoryId, file.name);
    if (!url) {
      toast.error('Failed to load preview');
      return;
    }

    const isImage = file.name.match(/\.(jpg|jpeg|png|gif|webp)$/i);
    const isPdf = file.name.match(/\.pdf$/i);

    setPreviewUrl(url);
    setPreviewType(isImage ? 'image' : isPdf ? 'pdf' : null);
    setPreviewName(file.name);
    setIsPreviewOpen(true);
  };

  const handleDownload = async (categoryId: string, file: StorageFile) => {
    const url = await getFileUrl(categoryId, file.name);
    if (!url) {
      toast.error('Failed to download file');
      return;
    }

    // Open in new tab to trigger download
    window.open(url, '_blank');
    toast.success('File opened in new tab');
  };

  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return 'Unknown size';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-ZA', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const totalFiles = documents.reduce((sum, cat) => sum + cat.files.length, 0);

  if (!accessToken) {
    return (
      <div className="glass-card rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <FolderOpen className="w-5 h-5 text-muted-foreground" />
          <h3 className="font-semibold">Client Documents</h3>
        </div>
        <p className="text-sm text-muted-foreground">No access token available for this application.</p>
      </div>
    );
  }

  return (
    <>
      <div className="glass-card rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">Client Documents</h3>
            {totalFiles > 0 && (
              <Badge variant="secondary" className="ml-2">
                {totalFiles} file{totalFiles !== 1 ? 's' : ''}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <AdminDocumentUpload
              accessToken={accessToken}
              clientName={clientName}
              onUploadComplete={fetchDocuments}
            />
            <Button variant="ghost" size="sm" onClick={fetchDocuments} disabled={isLoading}>
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Refresh'}
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : documents.length === 0 ? (
          <div className="text-center py-8">
            <FolderOpen className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
            <p className="text-muted-foreground">No documents uploaded yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Documents will appear here once the client uploads them
            </p>
          </div>
        ) : (
          <Tabs defaultValue={documents[0]?.id} className="w-full">
            <TabsList className="w-full flex flex-wrap h-auto gap-1 bg-muted/30 p-1">
              {documents.map((category) => (
                <TabsTrigger
                  key={category.id}
                  value={category.id}
                  className="flex-1 min-w-[100px] text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  {category.label}
                  <Badge variant="outline" className="ml-1.5 h-5 px-1.5 text-[10px]">
                    {category.files.length}
                  </Badge>
                </TabsTrigger>
              ))}
            </TabsList>

            {documents.map((category) => (
              <TabsContent key={category.id} value={category.id} className="mt-4">
                <ScrollArea className="h-[250px]">
                  <div className="space-y-2">
                    {category.files.map((file) => {
                      const isImage = file.name.match(/\.(jpg|jpeg|png|gif|webp)$/i);
                      
                      return (
                        <div
                          key={file.id}
                          className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="w-8 h-8 rounded flex items-center justify-center bg-muted">
                              {isImage ? (
                                <ImageIcon className="w-4 h-4 text-blue-400" />
                              ) : (
                                <FileText className="w-4 h-4 text-orange-400" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium truncate" title={file.name}>
                                {file.name.replace(/^\d+-/, '')}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatFileSize(file.metadata?.size || 0)} • {formatDate(file.created_at)}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handlePreview(category.id, file)}
                              title="Preview"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleDownload(category.id, file)}
                              title="Download"
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </TabsContent>
            ))}
          </Tabs>
        )}
      </div>

      {/* Preview Dialog */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center justify-between pr-8">
              <span className="truncate">{previewName.replace(/^\d+-/, '')}</span>
              {previewUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(previewUrl, '_blank')}
                  className="ml-4 flex-shrink-0"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Open Full
                </Button>
              )}
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-auto min-h-[400px] bg-muted/30 rounded-lg flex items-center justify-center">
            {previewType === 'image' && previewUrl && (
              <img
                src={previewUrl}
                alt={previewName}
                className="max-w-full max-h-[70vh] object-contain"
              />
            )}
            {previewType === 'pdf' && previewUrl && (
              <iframe
                src={previewUrl}
                className="w-full h-[70vh] rounded"
                title={previewName}
              />
            )}
            {!previewType && (
              <div className="text-center py-12">
                <FileText className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">Preview not available for this file type</p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => previewUrl && window.open(previewUrl, '_blank')}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download Instead
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ClientDocumentViewer;
