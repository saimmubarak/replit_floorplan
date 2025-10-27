import { Check } from "lucide-react";
import { type WizardStep } from "@shared/schema";

interface StepConfig {
  id: WizardStep;
  label: string;
  number: number;
}

const steps: StepConfig[] = [
  { id: 'plot-size', label: 'Plot Size', number: 1 },
  { id: 'house-shape', label: 'House Shape', number: 2 },
  { id: 'details', label: 'Details', number: 3 },
  { id: 'export-save', label: 'Export/Save', number: 4 },
];

interface WizardStepsProps {
  currentStep: WizardStep;
  completedSteps: WizardStep[];
  onStepClick?: (step: WizardStep) => void;
}

export function WizardSteps({ currentStep, completedSteps, onStepClick }: WizardStepsProps) {
  const currentIndex = steps.findIndex(s => s.id === currentStep);
  
  return (
    <div className="flex items-center justify-center gap-2" data-testid="wizard-steps">
      {steps.map((step, index) => {
        const isCompleted = completedSteps.includes(step.id);
        const isCurrent = step.id === currentStep;
        const isPast = index < currentIndex;
        const isClickable = isPast || isCompleted;
        
        return (
          <div key={step.id} className="flex items-center gap-2">
            <button
              onClick={() => isClickable && onStepClick?.(step.id)}
              disabled={!isClickable}
              className={`
                flex flex-col items-center gap-1.5 transition-all
                ${isClickable ? 'cursor-pointer' : 'cursor-default'}
              `}
              data-testid={`step-${step.id}`}
            >
              <div className="relative">
                <div
                  className={`
                    w-10 h-10 rounded-full flex items-center justify-center
                    border-2 transition-all font-semibold text-sm
                    ${isCurrent ? 'border-primary bg-primary text-primary-foreground ring-4 ring-primary/20' : ''}
                    ${isCompleted ? 'border-primary bg-primary text-primary-foreground' : ''}
                    ${!isCurrent && !isCompleted ? 'border-border bg-background text-muted-foreground' : ''}
                  `}
                >
                  {isCompleted ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    <span>{step.number}</span>
                  )}
                </div>
              </div>
              <span
                className={`
                  text-sm transition-all
                  ${isCurrent ? 'font-semibold text-foreground' : ''}
                  ${!isCurrent ? 'text-muted-foreground' : ''}
                `}
              >
                {step.label}
              </span>
            </button>
            
            {index < steps.length - 1 && (
              <div
                className={`
                  h-0.5 w-12 mx-2 transition-all
                  ${index < currentIndex || isCompleted ? 'bg-primary' : 'bg-border'}
                `}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
