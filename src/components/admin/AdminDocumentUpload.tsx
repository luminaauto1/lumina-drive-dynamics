import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Upload, Loader2, FileText, X, Check, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AdminDocumentUploadProps {
  applicationId: string | null;
  accessToken?: string | null; // Legacy fallback  
  clientName?: string;
  onUploadComplete?: () => void;
}

const DOCUMENT_CATEGORIES = [
  { id: 'id-card', label: 'ID Card' },
  { id: 'drivers-license', label: "Driver's License" },
  { id: 'payslips', label: 'Payslips' },
  { id: 'bank-statements', label: 'Bank Statements' },
];

const AdminDocumentUpload = ({ applicationId, accessToken, clientName, onUploadComplete }: AdminDocumentUploadProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, 'pending' | 'uploading' | 'done' | 'error'>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Use applicationId as primary, fallback to accessToken for legacy
  const uploadPath = applicationId || accessToken;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setSelectedFiles(prev => [...prev, ...files]);
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (!uploadPath || !selectedCategory || selectedFiles.length === 0) {
      toast.error('Please select a category and at least one file');
      return;
    }

    setIsUploading(true);
    const newProgress: Record<string, 'pending' | 'uploading' | 'done' | 'error'> = {};
    selectedFiles.forEach(f => newProgress[f.name] = 'pending');
    setUploadProgress(newProgress);

    let successCount = 0;
    let errorCount = 0;

    for (const file of selectedFiles) {
      setUploadProgress(prev => ({ ...prev, [file.name]: 'uploading' }));
      
      try {
        const timestamp = Date.now();
        const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const filePath = `${uploadPath}/${selectedCategory}/${timestamp}-${sanitizedName}`;

        const { error } = await supabase.storage
          .from('client-docs')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false,
          });

        if (error) throw error;

        setUploadProgress(prev => ({ ...prev, [file.name]: 'done' }));
        successCount++;
      } catch (error: any) {
        console.error('Upload error:', error);
        setUploadProgress(prev => ({ ...prev, [file.name]: 'error' }));
        errorCount++;
      }
    }

    setIsUploading(false);

    if (successCount > 0) {
      toast.success(`${successCount} file(s) uploaded successfully`);
      onUploadComplete?.();
    }
    if (errorCount > 0) {
      toast.error(`${errorCount} file(s) failed to upload`);
    }

    // Reset after delay
    setTimeout(() => {
      setSelectedFiles([]);
      setSelectedCategory('');
      setUploadProgress({});
      if (successCount > 0) {
        setIsOpen(false);
      }
    }, 1500);
  };

  if (!uploadPath) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Upload className="w-4 h-4" />
          Upload for Client
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-primary" />
            Upload Documents for {clientName || 'Client'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Category Selection */}
          <div className="space-y-2">
            <Label>Document Category</Label>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Select category..." />
              </SelectTrigger>
              <SelectContent>
                {DOCUMENT_CATEGORIES.map(cat => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* File Selection */}
          <div className="space-y-2">
            <Label>Files</Label>
            <div 
              className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,.pdf"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Click to select files or drag and drop
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                PDF, JPG, PNG up to 10MB each
              </p>
            </div>
          </div>

          {/* Selected Files List */}
          {selectedFiles.length > 0 && (
            <div className="space-y-2">
              <Label>Selected Files ({selectedFiles.length})</Label>
              <div className="max-h-40 overflow-y-auto space-y-2">
                {selectedFiles.map((file, index) => (
                  <motion.div
                    key={`${file.name}-${index}`}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center justify-between p-2 bg-muted/30 rounded-lg text-sm"
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <FileText className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
                      <span className="truncate">{file.name}</span>
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        ({(file.size / 1024 / 1024).toFixed(2)} MB)
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {uploadProgress[file.name] === 'uploading' && (
                        <Loader2 className="w-4 h-4 animate-spin text-primary" />
                      )}
                      {uploadProgress[file.name] === 'done' && (
                        <Check className="w-4 h-4 text-green-500" />
                      )}
                      {uploadProgress[file.name] === 'error' && (
                        <X className="w-4 h-4 text-destructive" />
                      )}
                      {!isUploading && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => removeFile(index)}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Upload Button */}
          <Button
            onClick={handleUpload}
            disabled={!selectedCategory || selectedFiles.length === 0 || isUploading}
            className="w-full gap-2"
          >
            {isUploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Upload {selectedFiles.length} File(s)
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AdminDocumentUpload;