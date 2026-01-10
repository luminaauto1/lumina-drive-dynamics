import { useRef, useState } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Eraser, Save, PenTool } from 'lucide-react';

interface SignaturePadProps {
  onSave: (signatureDataUrl: string) => void;
  existingSignature?: string;
}

const SignaturePad = ({ onSave, existingSignature }: SignaturePadProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [hasSignature, setHasSignature] = useState(!!existingSignature);
  const sigCanvas = useRef<SignatureCanvas>(null);

  const handleClear = () => {
    sigCanvas.current?.clear();
    setHasSignature(false);
  };

  const handleSave = () => {
    if (sigCanvas.current && !sigCanvas.current.isEmpty()) {
      const dataUrl = sigCanvas.current.toDataURL('image/png');
      onSave(dataUrl);
      setHasSignature(true);
      setIsOpen(false);
    }
  };

  const handleEnd = () => {
    if (sigCanvas.current && !sigCanvas.current.isEmpty()) {
      setHasSignature(true);
    }
  };

  return (
    <>
      {existingSignature || hasSignature ? (
        <div className="space-y-2">
          <div className="p-4 bg-muted/50 rounded-lg border border-green-500/30">
            <p className="text-sm text-green-400 font-medium mb-2">✓ Signature Captured</p>
            {existingSignature && (
              <img 
                src={existingSignature} 
                alt="Signature" 
                className="h-16 object-contain bg-white rounded"
              />
            )}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsOpen(true)}
          >
            <PenTool className="w-4 h-4 mr-2" />
            Re-sign
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          onClick={() => setIsOpen(true)}
          className="w-full border-primary/50 hover:bg-primary/10"
        >
          <PenTool className="w-4 h-4 mr-2" />
          Sign to Accept
        </Button>
      )}

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Sign to Accept</DialogTitle>
            <DialogDescription>
              Please sign below to confirm your consent for POPIA processing.
            </DialogDescription>
          </DialogHeader>
          
          <div className="border rounded-lg bg-white p-2">
            <SignatureCanvas
              ref={sigCanvas}
              penColor="black"
              canvasProps={{
                className: 'w-full h-48 rounded cursor-crosshair',
                style: { width: '100%', height: '192px' }
              }}
              onEnd={handleEnd}
            />
          </div>

          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={handleClear}
              className="flex-1 sm:flex-none"
            >
              <Eraser className="w-4 h-4 mr-2" />
              Clear
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={!hasSignature}
              className="flex-1 sm:flex-none"
            >
              <Save className="w-4 h-4 mr-2" />
              Save Signature
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default SignaturePad;
