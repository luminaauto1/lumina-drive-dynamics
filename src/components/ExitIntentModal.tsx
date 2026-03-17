import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

const ExitIntentModal = () => {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const shown = () => sessionStorage.getItem('exitIntentShown');
    const trigger = () => {
      if (!shown()) {
        setIsOpen(true);
        sessionStorage.setItem('exitIntentShown', 'true');
      }
    };

    // Desktop: mouse leaves viewport
    const handleMouseLeave = (e: MouseEvent) => {
      if (e.clientY <= 0) trigger();
    };
    document.addEventListener('mouseleave', handleMouseLeave);

    // Mobile: rapid scroll-up near top of page
    let lastScrollY = window.scrollY;
    const handleScroll = () => {
      const currentY = window.scrollY;
      const delta = lastScrollY - currentY;
      if (delta > 50 && currentY < 100) trigger();
      lastScrollY = currentY;
    };
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      document.removeEventListener('mouseleave', handleMouseLeave);
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">
            Wait! Don't leave without knowing your true budget.
          </DialogTitle>
          <DialogDescription className="text-muted-foreground pt-2">
            Find out exactly what premium vehicles you qualify for with our
            secure, confidential pre-qualification process.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col sm:flex-row gap-3 pt-4">
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Close
          </Button>
          <Button
            onClick={() => {
              setIsOpen(false);
              navigate('/finance-application');
            }}
          >
            Get a 60-Second Soft Approval
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ExitIntentModal;
