import { motion } from 'framer-motion';
import { Check, Circle, AlertTriangle } from 'lucide-react';
import { FINANCE_STEPS, STATUS_STEP_ORDER } from '@/lib/statusConfig';
import { cn } from '@/lib/utils';

interface FinanceProgressStepperProps {
  currentStatus: string;
  className?: string;
}

const FinanceProgressStepper = ({ currentStatus, className }: FinanceProgressStepperProps) => {
  const currentStep = STATUS_STEP_ORDER[currentStatus] ?? 0;
  const isDeclined = currentStatus === 'declined';

  return (
    <div className={cn('w-full', className)}>
      {/* Desktop Stepper */}
      <div className="hidden md:flex items-center justify-between relative">
        {/* Progress Line Background */}
        <div className="absolute top-4 left-0 right-0 h-0.5 bg-border" />
        
        {/* Progress Line Fill */}
        <motion.div
          className="absolute top-4 left-0 h-0.5 bg-primary"
          initial={{ width: '0%' }}
          animate={{ width: isDeclined ? '0%' : `${(currentStep / (FINANCE_STEPS.length - 1)) * 100}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />

        {FINANCE_STEPS.map((step, index) => {
          const isCompleted = currentStep > index;
          const isCurrent = currentStep === index;
          const isPending = currentStep < index;

          return (
            <div key={step.key} className="relative flex flex-col items-center z-10">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: index * 0.05 }}
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all',
                  isDeclined && 'bg-red-500/20 text-red-400 border-2 border-red-500/30',
                  isCompleted && !isDeclined && 'bg-primary text-primary-foreground',
                  isCurrent && !isDeclined && 'bg-primary/20 text-primary border-2 border-primary animate-pulse',
                  isPending && !isDeclined && 'bg-muted text-muted-foreground border-2 border-border'
                )}
              >
                {isCompleted && !isDeclined ? (
                  <Check className="w-4 h-4" />
                ) : isDeclined && index === 0 ? (
                  <AlertTriangle className="w-4 h-4" />
                ) : (
                  step.shortLabel
                )}
              </motion.div>
              <span
                className={cn(
                  'mt-2 text-[10px] text-center max-w-[60px] leading-tight',
                  isCurrent && !isDeclined && 'text-primary font-semibold',
                  isCompleted && !isDeclined && 'text-primary',
                  isPending && 'text-muted-foreground',
                  isDeclined && 'text-red-400'
                )}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Mobile Stepper (Simplified) */}
      <div className="md:hidden">
        <div className="flex items-center gap-2 mb-2">
          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
            <motion.div
              className={cn(
                'h-full rounded-full',
                isDeclined ? 'bg-red-500' : 'bg-primary'
              )}
              initial={{ width: '0%' }}
              animate={{ width: isDeclined ? '0%' : `${((currentStep + 1) / FINANCE_STEPS.length) * 100}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </div>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {isDeclined ? 'Declined' : `Step ${currentStep + 1} of ${FINANCE_STEPS.length}`}
          </span>
        </div>
        <p className={cn(
          'text-sm font-medium',
          isDeclined ? 'text-red-400' : 'text-primary'
        )}>
          {isDeclined ? 'Application Declined' : FINANCE_STEPS[currentStep]?.label || 'Unknown'}
        </p>
      </div>
    </div>
  );
};

export default FinanceProgressStepper;
