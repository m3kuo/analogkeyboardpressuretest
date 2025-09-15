import { cn } from '@/lib/utils';

interface KeyboardKeyProps {
  keyChar: string;
  targetPressure?: number;   // 0 -> "0%", 50 -> "10–90%", 100 -> "100%"
  currentPressure?: number;  // (optional live value 0–1, unused in this display)
  isPressed?: boolean;       // (optional visual hint)
  isTarget?: boolean;
  className?: string;
}

const formatTarget = (t?: number) => {
  if (t === 25) return 'Light (10–40%)';
  if (t === 60) return 'Medium (41–80%)';
  if (t === 50) return 'Mid (10–90%)';
  if (t === 100) return '100%';
  return '';
};


export const KeyboardKey = ({
  keyChar,
  targetPressure = 0,
  isPressed = false,
  isTarget = false,
  className
}: KeyboardKeyProps) => {
  return (
    <div
      className={cn(
        'relative w-400 h-400 rounded-lg flex flex-col items-center justify-center',
        'font-mono font-bold text-lg border-2 shadow-lg transition',
        'bg-keyboard-key-idle border-border text-muted-foreground',
        isPressed && 'ring-2 ring-primary/50',
        isTarget && 'border-primary',
        className
      )}
      aria-label={`Key ${keyChar}${isTarget ? `, target ${formatTarget(targetPressure)}` : ''}`}
    >
      <span className="text-6xl uppercase">{keyChar}</span>

      


    </div>
  );
};
