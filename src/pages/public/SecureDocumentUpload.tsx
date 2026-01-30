import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import { Upload, FileText, Check, AlertTriangle, Loader2, X, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ApplicationData {
  application_id: string;
  first_name: string;
  status: string;
  access_token: string;
}

interface UploadedFile {
  name: string;
  type: string;
  path: string;
  uploadedAt: Date;
}

const DOCUMENT_TYPES = [
  { id: 'id_card', label: 'ID Card', description: 'Front and back of your ID document', accept: 'image/*,.pdf' },
  { id: 'drivers_license', label: "Driver's License", description: 'Valid driver\'s license', accept: 'image/*,.pdf' },
  { id: 'payslip', label: 'Payslips (3 months)', description: 'Latest 3 months payslips', accept: 'image/*,.pdf', multiple: true },
  { id: 'bank_statement', label: 'Bank Statements (3 months)', description: 'Latest 3 months bank statements', accept: 'image/*,.pdf', multiple: true },
];

const SecureDocumentUpload = () => {
  const { token } = useParams<{ token: string }>();
  const [application, setApplication] = useState<ApplicationData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<Record<string, UploadedFile[]>>({});
  const [uploadingType, setUploadingType] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isSubmitted, setIsSubmitted] = useState(false);

  useEffect(() => {
    if (token) {
      fetchApplication();
    }
  }, [token]);

  const fetchApplication = async () => {
    if (!token) {
      setError('Invalid access link');
      setIsLoading(false);
      return;
    }

    try {
      // Use secure edge function to verify token instead of direct DB query
      const { data, error: fetchError } = await supabase.functions.invoke('verify-upload-token', {
        body: { token },
      });

      if (fetchError || !data?.valid) {
        setError(data?.error || 'Application not found or link has expired');
        setIsLoading(false);
        return;
      }

      setApplication({
        application_id: data.application_id,
        first_name: data.first_name,
        status: data.status,
        access_token: data.access_token,
      });

      // Check if already submitted documents
      if (data.status === 'documents_received' || ['validations_pending', 'validations_complete', 'contract_sent', 'contract_signed', 'vehicle_delivered'].includes(data.status)) {
        setIsSubmitted(true);
      }
    } catch (err) {
      console.error('Fetch error:', err);
      setError('Failed to load application');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (docType: string, files: FileList | null) => {
    if (!files || files.length === 0 || !application) return;

    setUploadingType(docType);
    setUploadProgress(0);

    const newFiles: UploadedFile[] = [];
    const totalFiles = files.length;

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileName = `${application.access_token}/${docType}/${Date.now()}-${file.name}`;

        const { error: uploadError } = await supabase.storage
          .from('client-docs')
          .upload(fileName, file, { upsert: true });

        if (uploadError) {
          console.error('Upload error:', uploadError);
          toast.error(`Failed to upload ${file.name}`);
          continue;
        }

        newFiles.push({
          name: file.name,
          type: docType,
          path: fileName,
          uploadedAt: new Date(),
        });

        setUploadProgress(((i + 1) / totalFiles) * 100);
      }

      if (newFiles.length > 0) {
        setUploadedFiles(prev => ({
          ...prev,
          [docType]: [...(prev[docType] || []), ...newFiles],
        }));
        toast.success(`${newFiles.length} file(s) uploaded successfully`);
      }
    } catch (err) {
      console.error('Upload error:', err);
      toast.error('Failed to upload files');
    } finally {
      setUploadingType(null);
      setUploadProgress(0);
    }
  };

  const handleRemoveFile = async (docType: string, index: number) => {
    const file = uploadedFiles[docType]?.[index];
    if (!file) return;

    try {
      await supabase.storage.from('client-docs').remove([file.path]);
      setUploadedFiles(prev => ({
        ...prev,
        [docType]: prev[docType].filter((_, i) => i !== index),
      }));
      toast.success('File removed');
    } catch (err) {
      toast.error('Failed to remove file');
    }
  };

  const handleSubmitDocuments = async () => {
    if (!application || !token) return;

    const totalUploaded = Object.values(uploadedFiles).flat().length;
    if (totalUploaded === 0) {
      toast.error('Please upload at least one document');
      return;
    }

    try {
      // Use secure edge function to update status
      const { data, error: updateError } = await supabase.functions.invoke('verify-upload-token?action=update-status', {
        body: { 
          token,
          status: 'documents_received'
        },
      });

      if (updateError || !data?.success) {
        throw new Error(data?.error || 'Failed to update status');
      }

      setIsSubmitted(true);
      toast.success('Documents submitted successfully!');
    } catch (err) {
      console.error('Submit error:', err);
      toast.error('Failed to submit documents');
    }
  };

  const getUploadedCount = (docType: string): number => {
    return uploadedFiles[docType]?.length || 0;
  };

  const firstName = application?.first_name || 'Client';

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading your application...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-md w-full text-center">
          <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-red-500" />
          <h1 className="text-2xl font-bold mb-2">Access Error</h1>
          <p className="text-muted-foreground mb-6">{error}</p>
          <p className="text-sm text-muted-foreground">
            If you believe this is an error, please contact Lumina Auto support.
          </p>
        </div>
      </div>
    );
  }

  if (isSubmitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full text-center"
        >
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-500/20 flex items-center justify-center">
            <Check className="w-10 h-10 text-green-500" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Documents Received!</h1>
          <p className="text-muted-foreground mb-6">
            Thank you {firstName}! We have received your documents and will verify them shortly.
            You will be notified via WhatsApp once the verification is complete.
          </p>
          <Alert className="bg-primary/10 border-primary/30 text-left">
            <FileText className="h-4 w-4 text-primary" />
            <AlertTitle className="text-primary">What happens next?</AlertTitle>
            <AlertDescription>
              Our team will review your documents and submit your application to the bank.
              This typically takes 1-2 business days.
            </AlertDescription>
          </Alert>
        </motion.div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Upload Documents | Lumina Auto Finance</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="min-h-screen bg-background py-8 px-4">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <img
              src="/lovable-uploads/16189aee-0fe1-4c9b-9a90-bcb743ad9a1d.png"
              alt="Lumina Auto"
              className="h-12 mx-auto mb-6"
            />
            <h1 className="text-3xl font-bold mb-2">
              Hi {firstName}! 👋
            </h1>
            <p className="text-muted-foreground">
              Please upload the required documents to continue with your application.
            </p>
          </motion.div>

          {/* Document Submission Info */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-8"
          >
            <Alert className="bg-primary/10 border-primary/30">
              <FileText className="h-4 w-4 text-primary" />
              <AlertTitle className="text-primary">Next Step: Document Submission</AlertTitle>
              <AlertDescription>
                Please upload the required documents below so our finance team can proceed with your application validation.
              </AlertDescription>
            </Alert>
          </motion.div>

          {/* Document Upload Cards */}
          <div className="space-y-4">
            {DOCUMENT_TYPES.map((docType, index) => (
              <motion.div
                key={docType.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + index * 0.05 }}
                className="glass-card rounded-xl p-6"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-semibold flex items-center gap-2">
                      {docType.label}
                      {getUploadedCount(docType.id) > 0 && (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-green-500/20 text-green-500">
                          {getUploadedCount(docType.id)} uploaded
                        </span>
                      )}
                    </h3>
                    <p className="text-sm text-muted-foreground">{docType.description}</p>
                  </div>
                </div>

                {/* Uploaded Files List */}
                {uploadedFiles[docType.id]?.length > 0 && (
                  <div className="mb-4 space-y-2">
                    {uploadedFiles[docType.id].map((file, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between p-2 rounded bg-muted/50"
                      >
                        <div className="flex items-center gap-2">
                          {file.name.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                            <ImageIcon className="w-4 h-4 text-blue-400" />
                          ) : (
                            <FileText className="w-4 h-4 text-blue-400" />
                          )}
                          <span className="text-sm truncate max-w-[200px]">{file.name}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveFile(docType.id, i)}
                          className="h-8 w-8 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Upload Button / Drop Zone */}
                <label className="block">
                  <input
                    type="file"
                    accept={docType.accept}
                    multiple={docType.multiple}
                    onChange={(e) => handleFileUpload(docType.id, e.target.files)}
                    className="hidden"
                    disabled={uploadingType !== null}
                  />
                  <div
                    className={`
                      border-2 border-dashed rounded-lg p-6 text-center cursor-pointer
                      transition-colors hover:border-primary/50 hover:bg-primary/5
                      ${uploadingType === docType.id ? 'border-primary bg-primary/10' : 'border-border'}
                    `}
                  >
                    {uploadingType === docType.id ? (
                      <div className="space-y-2">
                        <Loader2 className="w-8 h-8 mx-auto animate-spin text-primary" />
                        <p className="text-sm text-muted-foreground">Uploading...</p>
                        <Progress value={uploadProgress} className="h-2 max-w-xs mx-auto" />
                      </div>
                    ) : (
                      <>
                        <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">
                          Click or drag files to upload
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Accepts images and PDFs
                        </p>
                      </>
                    )}
                  </div>
                </label>
              </motion.div>
            ))}
          </div>

          {/* Submit Button */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mt-8"
          >
            <Button
              onClick={handleSubmitDocuments}
              disabled={Object.values(uploadedFiles).flat().length === 0}
              className="w-full h-12 text-lg"
              size="lg"
            >
              <Check className="w-5 h-5 mr-2" />
              Submit Documents
            </Button>
            <p className="text-center text-xs text-muted-foreground mt-4">
              By submitting, you confirm that all documents are accurate and belong to you.
            </p>
          </motion.div>
        </div>
      </div>
    </>
  );
};

export default SecureDocumentUpload;
