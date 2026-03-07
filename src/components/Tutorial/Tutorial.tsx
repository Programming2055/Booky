import { useState, useEffect, useCallback } from 'react';
import './Tutorial.css';

interface TutorialStep {
  id: string;
  title: string;
  description: string;
  target?: string; // CSS selector for element to highlight
  position: 'top' | 'bottom' | 'left' | 'right' | 'center';
  action?: string; // Optional action hint
}

const tutorialSteps: TutorialStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Booky! 📚',
    description: 'Your personal eBook library manager. Let me show you around! This quick tour will help you get started.',
    position: 'center',
  },
  {
    id: 'add-book',
    title: 'Adding Books',
    description: 'Click the "+ Add Book" button to add ebooks to your library. Booky supports PDF, EPUB, MOBI, FB2, DJVU, CBZ, and AZW3 formats.',
    target: '.btn--primary',
    position: 'bottom',
    action: 'Click to add your first book',
  },
  {
    id: 'import-books',
    title: 'Import Multiple Books',
    description: 'Use "Import Books" to add many ebooks at once from a folder. All supported formats will be detected automatically.',
    target: '.btn--ghost',
    position: 'bottom',
    action: 'Bulk import ebooks',
  },
  {
    id: 'search',
    title: 'Search Your Library',
    description: 'Use the search bar to quickly find books by title or author. Press Ctrl+K for quick access.',
    target: '.header__search',
    position: 'bottom',
    action: 'Type to search',
  },
  {
    id: 'sidebar',
    title: 'Collections & Organization',
    description: 'The sidebar shows your collections. Create new collections to organize your books by genre, topic, or any category you like.',
    target: '.sidebar',
    position: 'right',
    action: 'Click "+ New Collection"',
  },
  {
    id: 'view-modes',
    title: 'View Modes',
    description: 'Switch between Grid, List, and Compact views to display your library the way you prefer.',
    target: '.sidebar__view-buttons',
    position: 'right',
    action: 'Try different views',
  },
  {
    id: 'themes',
    title: 'Themes & Appearance',
    description: 'Choose from multiple themes: Light, Dark, Sepia, Nord, and Dracula. Click the settings icon (⚙) to customize.',
    target: '.header__toggle:last-of-type',
    position: 'bottom',
    action: 'Open settings',
  },
  {
    id: 'book-card',
    title: 'Opening Books',
    description: 'Click any book cover to open it in the built-in reader. Right-click for more options like edit, delete, or open with system app.',
    target: '.book-card',
    position: 'top',
    action: 'Click to read',
  },
  {
    id: 'reader-nav',
    title: 'Reader Navigation',
    description: 'In the reader, use arrow keys (← →) to navigate pages. Click the edges of the screen or use the toolbar for more controls.',
    position: 'center',
  },
  {
    id: 'pdf-tools',
    title: 'PDF Tools',
    description: 'When reading a PDF, click the 🔧 Tools button to access powerful features: compress, rotate, extract pages, add watermarks, and more!',
    position: 'center',
  },
  {
    id: 'keyboard',
    title: 'Keyboard Shortcuts',
    description: 'Speed up your workflow with shortcuts:\n• Ctrl+K - Quick search\n• ← → - Navigate pages\n• Esc - Close reader\n• +/- - Zoom in/out',
    position: 'center',
  },
  {
    id: 'complete',
    title: "You're All Set! 🎉",
    description: "That's everything you need to know to get started. Enjoy managing your eBook library with Booky!",
    position: 'center',
    action: 'Start exploring',
  },
];

interface TutorialProps {
  onComplete: () => void;
  isOpen: boolean;
}

export function Tutorial({ onComplete, isOpen }: TutorialProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  const step = tutorialSteps[currentStep];
  const progress = ((currentStep + 1) / tutorialSteps.length) * 100;

  const updateTargetRect = useCallback(() => {
    if (step.target) {
      const element = document.querySelector(step.target);
      if (element) {
        setTargetRect(element.getBoundingClientRect());
      } else {
        setTargetRect(null);
      }
    } else {
      setTargetRect(null);
    }
  }, [step.target]);

  useEffect(() => {
    if (isOpen) {
      updateTargetRect();
      window.addEventListener('resize', updateTargetRect);
      window.addEventListener('scroll', updateTargetRect);
      return () => {
        window.removeEventListener('resize', updateTargetRect);
        window.removeEventListener('scroll', updateTargetRect);
      };
    }
  }, [isOpen, updateTargetRect]);

  useEffect(() => {
    if (isOpen) {
      updateTargetRect();
    }
  }, [currentStep, isOpen, updateTargetRect]);

  const handleNext = () => {
    if (currentStep < tutorialSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    setCurrentStep(0);
    localStorage.setItem('booky-tutorial-completed', 'true');
    onComplete();
  };

  const handleSkip = () => {
    handleComplete();
  };

  if (!isOpen) return null;

  const getTooltipPosition = () => {
    if (!targetRect || step.position === 'center') {
      return {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      };
    }

    const padding = 20;
    const tooltipWidth = 380;
    const tooltipHeight = 200;

    switch (step.position) {
      case 'top':
        return {
          bottom: `${window.innerHeight - targetRect.top + padding}px`,
          left: `${Math.max(padding, Math.min(targetRect.left + targetRect.width / 2 - tooltipWidth / 2, window.innerWidth - tooltipWidth - padding))}px`,
        };
      case 'bottom':
        return {
          top: `${targetRect.bottom + padding}px`,
          left: `${Math.max(padding, Math.min(targetRect.left + targetRect.width / 2 - tooltipWidth / 2, window.innerWidth - tooltipWidth - padding))}px`,
        };
      case 'left':
        return {
          top: `${Math.max(padding, targetRect.top + targetRect.height / 2 - tooltipHeight / 2)}px`,
          right: `${window.innerWidth - targetRect.left + padding}px`,
        };
      case 'right':
        return {
          top: `${Math.max(padding, targetRect.top + targetRect.height / 2 - tooltipHeight / 2)}px`,
          left: `${targetRect.right + padding}px`,
        };
      default:
        return {
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        };
    }
  };

  return (
    <div className="tutorial-overlay">
      {/* Spotlight effect for targeted element */}
      {targetRect && (
        <div
          className="tutorial-spotlight"
          style={{
            top: targetRect.top - 12,
            left: targetRect.left - 12,
            width: targetRect.width + 24,
            height: targetRect.height + 24,
          }}
        />
      )}

      {/* Tutorial tooltip */}
      <div className="tutorial-tooltip" style={getTooltipPosition()}>
        {/* Progress bar */}
        <div className="tutorial-progress">
          <div className="tutorial-progress-bar" style={{ width: `${progress}%` }} />
        </div>

        {/* Step indicator */}
        <div className="tutorial-step-indicator">
          Step {currentStep + 1} of {tutorialSteps.length}
        </div>

        {/* Content */}
        <h3 className="tutorial-title">{step.title}</h3>
        <p className="tutorial-description">{step.description}</p>

        {step.action && (
          <div className="tutorial-action-hint">
            💡 {step.action}
          </div>
        )}

        {/* Navigation */}
        <div className="tutorial-nav">
          <button className="tutorial-btn tutorial-btn--skip" onClick={handleSkip}>
            Skip Tutorial
          </button>
          
          <div className="tutorial-nav-main">
            {currentStep > 0 && (
              <button className="tutorial-btn tutorial-btn--prev" onClick={handlePrev}>
                ← Back
              </button>
            )}
            <button className="tutorial-btn tutorial-btn--next" onClick={handleNext}>
              {currentStep === tutorialSteps.length - 1 ? 'Finish' : 'Next →'}
            </button>
          </div>
        </div>

        {/* Step dots */}
        <div className="tutorial-dots">
          {tutorialSteps.map((_, index) => (
            <button
              key={index}
              className={`tutorial-dot ${index === currentStep ? 'active' : ''} ${index < currentStep ? 'completed' : ''}`}
              onClick={() => setCurrentStep(index)}
              title={`Step ${index + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
