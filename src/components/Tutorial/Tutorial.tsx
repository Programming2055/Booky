import { useState, useEffect, useCallback } from 'react';
import './Tutorial.css';

interface TutorialStep {
  id: string;
  title: string;
  description: string;
  target?: string; // CSS selector for element to highlight
  position: 'top' | 'bottom' | 'left' | 'right' | 'center';
  action?: string; // Optional action hint
  icon?: string; // Optional emoji icon
}

const tutorialSteps: TutorialStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Booky!',
    description: 'Your personal eBook library manager. Let me give you a quick tour to help you get started.',
    position: 'center',
    icon: '📚',
  },
  {
    id: 'add-book',
    title: 'Add Your First Book',
    description: 'Click this button to add ebooks to your library. We support PDF, EPUB, MOBI, FB2, DJVU, CBZ, and AZW3 formats.',
    target: '.btn--primary',
    position: 'bottom',
    action: 'Click to add a book',
    icon: '➕',
  },
  {
    id: 'import-books',
    title: 'Bulk Import',
    description: 'Have many ebooks? Use Import Books to add an entire folder at once. All supported formats will be detected automatically.',
    target: '.btn--ghost',
    position: 'bottom',
    action: 'Import multiple books',
    icon: '📁',
  },
  {
    id: 'search',
    title: 'Find Books Quickly',
    description: 'Use the search bar to instantly find books by title or author. Pro tip: Press Ctrl+K for quick access!',
    target: '.header__search',
    position: 'bottom',
    action: 'Start typing to search',
    icon: '🔍',
  },
  {
    id: 'sidebar',
    title: 'Organize with Collections',
    description: 'Create collections to organize your library by genre, topic, reading status, or any way you like.',
    target: '.sidebar',
    position: 'right',
    action: 'Create a new collection',
    icon: '📂',
  },
  {
    id: 'view-modes',
    title: 'Choose Your View',
    description: 'Switch between Grid, List, and Compact views to display your library exactly how you prefer.',
    target: '.sidebar__view-buttons',
    position: 'right',
    action: 'Try different layouts',
    icon: '🎨',
  },
  {
    id: 'themes',
    title: 'Personalize Your Theme',
    description: 'Choose from Light, Dark, Sepia, Nord, or Dracula themes. Click the settings gear to customize your experience.',
    target: '.header__toggle:last-of-type',
    position: 'bottom',
    action: 'Open settings',
    icon: '⚙️',
  },
  {
    id: 'book-card',
    title: 'Read Your Books',
    description: 'Click any book cover to open it in our built-in reader. Right-click for more options like edit, delete, or open with system app.',
    target: '.book-card',
    position: 'top',
    action: 'Click to start reading',
    icon: '📖',
  },
  {
    id: 'reader-nav',
    title: 'Navigate While Reading',
    description: 'Use arrow keys (← →) to flip pages, click screen edges, or use the toolbar. Reading progress is saved automatically.',
    position: 'center',
    icon: '📄',
  },
  {
    id: 'pdf-tools',
    title: 'Powerful PDF Tools',
    description: 'When reading PDFs, access tools to compress, rotate, extract pages, add watermarks, convert to images, and more!',
    position: 'center',
    action: 'Look for the 🔧 button',
    icon: '🛠️',
  },
  {
    id: 'keyboard',
    title: 'Pro Shortcuts',
    description: 'Master these shortcuts:\n• Ctrl+K — Quick search\n• ← → — Navigate pages\n• Esc — Close reader\n• +/- — Zoom in/out',
    position: 'center',
    icon: '⌨️',
  },
  {
    id: 'complete',
    title: "You're Ready!",
    description: "That's everything you need to know. Start building your digital library and enjoy reading with Booky!",
    position: 'center',
    action: 'Let\'s get started',
    icon: '🎉',
  },
];

interface TutorialProps {
  onComplete: () => void;
  isOpen: boolean;
}

export function Tutorial({ onComplete, isOpen }: TutorialProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [touchTimeout, setTouchTimeout] = useState<NodeJS.Timeout | null>(null);

  const step = tutorialSteps[currentStep];
  const progress = ((currentStep + 1) / tutorialSteps.length) * 100;

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 600);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Handle touch to show/hide controls on mobile
  const handleTouch = useCallback(() => {
    if (!isMobile) return;
    
    setShowControls(true);
    
    if (touchTimeout) {
      clearTimeout(touchTimeout);
    }
    
    const timeout = setTimeout(() => {
      setShowControls(false);
    }, 4000); // Hide after 4 seconds of no touch
    
    setTouchTimeout(timeout);
  }, [isMobile, touchTimeout]);

  // Reset controls visibility when step changes
  useEffect(() => {
    if (isMobile) {
      setShowControls(true);
      if (touchTimeout) {
        clearTimeout(touchTimeout);
      }
      const timeout = setTimeout(() => {
        setShowControls(false);
      }, 4000);
      setTouchTimeout(timeout);
    }
    return () => {
      if (touchTimeout) {
        clearTimeout(touchTimeout);
      }
    };
  }, [currentStep, isMobile]);

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

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'Enter') {
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      } else if (e.key === 'Escape') {
        handleSkip();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentStep]);

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

  const getTooltipPosition = (): React.CSSProperties => {
    // Mobile: always position at bottom
    if (isMobile) {
      return {};
    }

    if (!targetRect || step.position === 'center') {
      return {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      };
    }

    const padding = 24;
    const tooltipWidth = 420;
    const tooltipHeight = 280;

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
    <div 
      className="tutorial-overlay" 
      onClick={handleTouch}
      onTouchStart={handleTouch}
    >
      {/* Spotlight effect for targeted element */}
      {targetRect && !isMobile && (
        <div
          className="tutorial-spotlight"
          style={{
            top: targetRect.top - 16,
            left: targetRect.left - 16,
            width: targetRect.width + 32,
            height: targetRect.height + 32,
          }}
        />
      )}

      {/* Tutorial tooltip */}
      <div 
        className="tutorial-tooltip" 
        style={getTooltipPosition()}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Progress bar */}
        <div className="tutorial-progress">
          <div className="tutorial-progress-bar" style={{ width: `${progress}%` }} />
        </div>

        {/* Content */}
        <div className="tutorial-content">
          {/* Step indicator */}
          <div className="tutorial-step-indicator">
            Step {currentStep + 1} of {tutorialSteps.length}
          </div>

          {/* Title with icon */}
          <h3 className="tutorial-title">
            {step.icon && <span style={{ marginRight: '8px' }}>{step.icon}</span>}
            {step.title}
          </h3>
          
          <p className="tutorial-description">{step.description}</p>
        </div>

        {step.action && (
          <div className="tutorial-action-hint">
            {step.action}
          </div>
        )}

        {/* Navigation */}
        <div className={`tutorial-nav ${isMobile ? (showControls ? 'mobile-show-controls' : 'mobile-hide-controls') : ''}`}>
          <button className="tutorial-btn tutorial-btn--skip" onClick={handleSkip}>
            Skip
          </button>
          
          <div className="tutorial-nav-main">
            {currentStep > 0 && (
              <button className="tutorial-btn tutorial-btn--prev" onClick={handlePrev}>
                <span>←</span> Back
              </button>
            )}
            <button className="tutorial-btn tutorial-btn--next" onClick={handleNext}>
              {currentStep === tutorialSteps.length - 1 ? 'Finish' : 'Next'} <span>→</span>
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
              aria-label={`Go to step ${index + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
