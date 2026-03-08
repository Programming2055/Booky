import { useState, useEffect, useCallback, useRef } from 'react';
import './Tutorial.css';

interface TutorialStep {
  id: string;
  title: string;
  description: string;
  target?: string;
  position: 'top' | 'bottom' | 'left' | 'right' | 'center';
  action?: string;
  icon: string;
}

const tutorialSteps: TutorialStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Booky!',
    description: 'Your personal eBook library manager. This quick tour will help you get started with managing your digital book collection.',
    position: 'center',
    icon: '📚',
  },
  {
    id: 'add-book',
    title: 'Add Your First Book',
    description: 'Click this button to add individual ebooks to your library. Supports PDF, EPUB, MOBI, FB2, DJVU, CBZ, and AZW3 formats.',
    target: '.btn--primary',
    position: 'bottom',
    action: 'Click to add a book',
    icon: '➕',
  },
  {
    id: 'import-books',
    title: 'Bulk Import',
    description: 'Import multiple ebooks at once from any folder. All supported formats will be automatically detected and added.',
    target: '.btn--ghost',
    position: 'bottom',
    action: 'Import many books at once',
    icon: '📥',
  },
  {
    id: 'search',
    title: 'Quick Search',
    description: 'Find any book instantly by title or author. Pro tip: Use Ctrl+K for lightning-fast access from anywhere.',
    target: '.header__search',
    position: 'bottom',
    action: 'Start typing to search',
    icon: '🔍',
  },
  {
    id: 'sidebar',
    title: 'Organize with Collections',
    description: 'Create custom collections to organize your books by genre, topic, reading status, or any category you prefer.',
    target: '.sidebar',
    position: 'right',
    action: 'Create a new collection',
    icon: '📁',
  },
  {
    id: 'view-modes',
    title: 'Choose Your View',
    description: 'Switch between Grid, List, and Bookshelf views. Click these icons to find the layout that works best for you.',
    target: '.book-grid__view-tabs',
    position: 'bottom',
    action: 'Try different layouts',
    icon: '🎨',
  },
  {
    id: 'themes',
    title: 'Personalize Your Theme',
    description: 'Choose from 5 beautiful themes: Light, Dark, Sepia, Nord, and Dracula. Access settings by clicking the gear icon.',
    target: '.header__toggle:nth-of-type(2)',
    position: 'bottom',
    action: 'Customize appearance',
    icon: '🎭',
  },
  {
    id: 'book-card',
    title: 'Read Your Books',
    description: 'Click any book cover to open it in the built-in reader. Right-click for more options like edit, delete, or open externally.',
    target: '.book-card',
    position: 'right',
    action: 'Click to start reading',
    icon: '📖',
  },
  {
    id: 'reader-nav',
    title: 'Navigate While Reading',
    description: 'Use arrow keys (← →) or click screen edges to turn pages. The toolbar provides zoom, bookmarks, and more controls.',
    position: 'center',
    icon: '⌨️',
  },
  {
    id: 'pdf-tools',
    title: 'Powerful PDF Tools',
    description: 'When reading PDFs, access tools to compress, rotate, extract pages, add watermarks, convert to images, and more!',
    position: 'center',
    icon: '🔧',
  },
  {
    id: 'keyboard',
    title: 'Keyboard Shortcuts',
    description: 'Master these shortcuts for efficiency:\n\n• Ctrl+K — Quick search\n• ← → — Turn pages\n• Escape — Close reader\n• +/- — Zoom controls',
    position: 'center',
    icon: '⚡',
  },
  {
    id: 'complete',
    title: 'Ready to Go!',
    description: "You're all set to build your digital library. Start by adding some books and enjoy the reading experience!",
    position: 'center',
    action: 'Start exploring',
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
  const [showControls, setShowControls] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const touchTimeoutRef = useRef<number | null>(null);

  const step = tutorialSteps[currentStep];
  const progress = ((currentStep + 1) / tutorialSteps.length) * 100;

  // Detect mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Handle touch for mobile - show controls on touch
  const handleTouch = useCallback(() => {
    if (isMobile) {
      setShowControls(true);
      if (touchTimeoutRef.current) {
        clearTimeout(touchTimeoutRef.current);
      }
      touchTimeoutRef.current = window.setTimeout(() => {
        setShowControls(false);
      }, 4000);
    }
  }, [isMobile]);

  // Show controls initially on mobile
  useEffect(() => {
    if (isMobile && isOpen) {
      setShowControls(true);
      touchTimeoutRef.current = window.setTimeout(() => {
        setShowControls(false);
      }, 4000);
    }
    return () => {
      if (touchTimeoutRef.current) {
        clearTimeout(touchTimeoutRef.current);
      }
    };
  }, [isMobile, isOpen, currentStep]);

  const updateTargetRect = useCallback(() => {
    if (step.target) {
      const element = document.querySelector(step.target);
      if (element) {
        const rect = element.getBoundingClientRect();
        // On mobile, don't highlight sidebar elements (they might be hidden)
        if (isMobile && step.target.includes('sidebar')) {
          setTargetRect(null);
        } else {
          setTargetRect(rect);
        }
      } else {
        setTargetRect(null);
      }
    } else {
      setTargetRect(null);
    }
  }, [step.target, isMobile]);

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

  const handleComplete = useCallback(() => {
    setCurrentStep(0);
    localStorage.setItem('booky-tutorial-completed', 'true');
    onComplete();
  }, [onComplete]);

  const handleNext = useCallback(() => {
    if (currentStep < tutorialSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  }, [currentStep, handleComplete]);

  const handlePrev = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  }, [currentStep]);

  const handleSkip = useCallback(() => {
    handleComplete();
  }, [handleComplete]);

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
  }, [isOpen, handleNext, handlePrev, handleSkip]);

  if (!isOpen) return null;

  const getTooltipPosition = (): React.CSSProperties => {
    // On mobile, always show at bottom as a card
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

    const padding = 32;
    const tooltipWidth = 480;
    const tooltipHeight = 350;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let top: number | undefined;
    let left: number | undefined;
    let bottom: number | undefined;
    let right: number | undefined;

    // Calculate space available in each direction from the target
    const spaceTop = targetRect.top;
    const spaceBottom = viewportHeight - targetRect.bottom;
    const spaceLeft = targetRect.left;
    const spaceRight = viewportWidth - targetRect.right;

    // Determine best position - prefer the side with most space
    let bestPosition = step.position;
    
    // For 'top' position, check if there's enough space above
    if (step.position === 'top' && spaceTop < tooltipHeight + padding) {
      // Not enough space above, try bottom
      if (spaceBottom >= tooltipHeight + padding) {
        bestPosition = 'bottom';
      } else if (spaceRight >= tooltipWidth + padding) {
        bestPosition = 'right';
      } else if (spaceLeft >= tooltipWidth + padding) {
        bestPosition = 'left';
      }
    }
    
    // For 'bottom' position, check if there's enough space below
    if (step.position === 'bottom' && spaceBottom < tooltipHeight + padding) {
      if (spaceTop >= tooltipHeight + padding) {
        bestPosition = 'top';
      } else if (spaceRight >= tooltipWidth + padding) {
        bestPosition = 'right';
      } else if (spaceLeft >= tooltipWidth + padding) {
        bestPosition = 'left';
      }
    }

    // Calculate position based on best position
    switch (bestPosition) {
      case 'top':
        top = targetRect.top - tooltipHeight - padding;
        left = targetRect.left + targetRect.width / 2 - tooltipWidth / 2;
        break;
      case 'bottom':
        top = targetRect.bottom + padding;
        left = targetRect.left + targetRect.width / 2 - tooltipWidth / 2;
        break;
      case 'left':
        top = targetRect.top + targetRect.height / 2 - tooltipHeight / 2;
        right = viewportWidth - targetRect.left + padding;
        break;
      case 'right':
        top = targetRect.top + targetRect.height / 2 - tooltipHeight / 2;
        left = targetRect.right + padding;
        break;
    }

    // Ensure tooltip stays within viewport horizontally
    if (left !== undefined) {
      left = Math.max(padding, Math.min(left, viewportWidth - tooltipWidth - padding));
    }
    if (right !== undefined) {
      right = Math.max(padding, right);
    }

    // Ensure tooltip stays within viewport vertically
    if (top !== undefined) {
      top = Math.max(padding, Math.min(top, viewportHeight - tooltipHeight - padding));
    }

    const style: React.CSSProperties = {};
    if (top !== undefined) style.top = `${top}px`;
    if (left !== undefined) style.left = `${left}px`;
    if (bottom !== undefined) style.bottom = `${bottom}px`;
    if (right !== undefined) style.right = `${right}px`;

    return style;
  };

  return (
    <div 
      className={`tutorial-overlay ${isMobile ? 'tutorial-overlay--mobile' : ''}`}
      onTouchStart={handleTouch}
      onClick={isMobile ? handleTouch : undefined}
    >
      {/* Spotlight effect for targeted element */}
      {targetRect && (
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
        className={`tutorial-tooltip ${isMobile ? 'tutorial-tooltip--mobile' : ''} ${showControls ? 'show-controls' : 'hide-controls'}`}
        style={getTooltipPosition()}
      >
        {/* Progress bar */}
        <div className="tutorial-progress">
          <div className="tutorial-progress-bar" style={{ width: `${progress}%` }} />
        </div>

        <div className="tutorial-content">
          {/* Step icon */}
          <div className="tutorial-icon">{step.icon}</div>

          {/* Step indicator */}
          <div className="tutorial-step-indicator">
            Step {currentStep + 1} of {tutorialSteps.length}
          </div>

          {/* Content */}
          <h3 className="tutorial-title">{step.title}</h3>
          <p className="tutorial-description">{step.description}</p>

          {step.action && (
            <div className="tutorial-action-hint">
              <span className="tutorial-action-icon">💡</span>
              {step.action}
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className={`tutorial-nav ${showControls ? '' : 'tutorial-nav--hidden'}`}>
          <button className="tutorial-btn tutorial-btn--skip" onClick={handleSkip}>
            Skip
          </button>
          
          <div className="tutorial-nav-center">
            {/* Step dots - desktop only */}
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
          
          <div className="tutorial-nav-buttons">
            {currentStep > 0 && (
              <button className="tutorial-btn tutorial-btn--prev" onClick={handlePrev}>
                <span className="btn-icon">←</span>
                <span className="btn-text">Back</span>
              </button>
            )}
            <button className="tutorial-btn tutorial-btn--next" onClick={handleNext}>
              <span className="btn-text">{currentStep === tutorialSteps.length - 1 ? 'Done' : 'Next'}</span>
              <span className="btn-icon">{currentStep === tutorialSteps.length - 1 ? '✓' : '→'}</span>
            </button>
          </div>
        </div>

        {/* Mobile touch hint */}
        {isMobile && !showControls && (
          <div className="tutorial-touch-hint">
            Tap to show controls
          </div>
        )}
      </div>
    </div>
  );
}
