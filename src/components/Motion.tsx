import React, { useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(ScrollTrigger);

interface AnimatedSectionProps {
  children: React.ReactNode;
  className?: string;
  animation?: gsap.TweenVars;
}

/**
 * OTIVO standard motion wrapper using GSAP
 * Ensures performance-first transforms and proper React cleanup
 */
export const AnimatedSection: React.FC<AnimatedSectionProps> = ({ 
  children, 
  className,
  animation = { y: 50, opacity: 0 }
}) => {
  const container = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    gsap.from(container.current, {
      ...animation,
      autoAlpha: 0, // Using autoAlpha for performance (opacity + visibility)
      scrollTrigger: {
        trigger: container.current,
        start: 'top 85%',
        toggleActions: 'play none none reverse'
      },
      duration: 1,
      ease: 'power3.out'
    });
  }, { scope: container });

  return (
    <div ref={container} className={className}>
      {children}
    </div>
  );
};

export const TextReveal: React.FC<{ text: string, className?: string }> = ({ text, className }) => {
  const scope = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const chars = scope.current?.querySelectorAll('.char');
    if (chars) {
      gsap.from(chars, {
        opacity: 0,
        y: 20,
        stagger: 0.05,
        duration: 0.8,
        ease: 'back.out(1.7)',
        scrollTrigger: {
          trigger: scope.current,
          start: 'top 90%'
        }
      });
    }
  }, { scope });

  return (
    <div ref={scope} className={className}>
      {text.split('').map((char, i) => (
        <span key={i} className="char inline-block whitespace-pre">
          {char}
        </span>
      ))}
    </div>
  );
};
