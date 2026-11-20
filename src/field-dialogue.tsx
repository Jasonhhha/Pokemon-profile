import { useEffect, useRef, useState, type KeyboardEvent, type RefObject } from 'react';
import { ChevronRight } from 'lucide-react';

type FieldDialogueProps = {
  speaker: string;
  line: string;
  action: string;
  actionRef: RefObject<HTMLButtonElement | null>;
  advance: () => void;
  decline?: () => void;
};

const charactersPerSecond = 58;

export function FieldDialogue({ speaker, line, action, actionRef, advance, decline }: FieldDialogueProps) {
  const characters = Array.from(line);
  const [preference] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)'));
  const [visible, setVisible] = useState(() => preference.matches ? characters.length : 0);
  const complete = visible >= characters.length;
  const completeRef = useRef(complete);
  completeRef.current = complete;

  useEffect(() => {
    actionRef.current?.focus({ preventScroll: true });
  }, [actionRef]);

  useEffect(() => {
    if (completeRef.current) return;
    let frame = 0;
    let start: number | undefined;
    function reveal(time: number) {
      if (completeRef.current) return;
      start ??= time;
      const count = Math.min(characters.length, Math.floor((time - start) * charactersPerSecond / 1000) + 1);
      setVisible(count);
      if (count < characters.length) frame = requestAnimationFrame(reveal);
    }
    function reduced() {
      if (preference.matches) {
        completeRef.current = true;
        setVisible(characters.length);
      }
    }
    preference.addEventListener('change', reduced);
    frame = requestAnimationFrame(reveal);
    return () => { cancelAnimationFrame(frame); preference.removeEventListener('change', reduced); };
  }, [characters.length, preference]);

  function next() {
    if (complete) advance();
    else {
      completeRef.current = true;
      setVisible(characters.length);
    }
  }

  function keyboard(event: KeyboardEvent<HTMLDivElement>) {
    const key = event.key.toLowerCase();
    if (event.repeat && (key === 'e' || key === 'enter' || key === ' ')) {
      event.preventDefault();
      return;
    }
    if (key === 'e') {
      event.preventDefault();
      next();
    } else if (key === 'escape' && decline) {
      event.preventDefault();
      decline();
    }
  }

  return <div className="field-dialogue" role="group" aria-label={`与${speaker}的对话`} onKeyDown={keyboard}>
    <div className="field-dialogue-copy">
      <strong>{speaker}</strong>
      <p className="dialogue-text">
        <span className="dialogue-text-spacing" aria-hidden="true">{line}</span>
        <span className="dialogue-text-reveal" aria-hidden="true">{characters.slice(0, visible).join('')}</span>
        <span className="visually-hidden" role="status">{line}</span>
      </p>
    </div>
    <div className="dialogue-actions">
      {decline && <button type="button" className="dialogue-next dialogue-decline" onClick={decline}>稍后</button>}
      <button type="button" ref={actionRef} className="dialogue-next" onClick={next}>
        <span className="dialogue-action-text"><span aria-hidden="true">{action.length > 4 ? action : '显示全文'}</span><span>{complete ? action : '显示全文'}</span></span>
        <ChevronRight size={17} aria-hidden="true" />
      </button>
    </div>
  </div>;
}
