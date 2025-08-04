import { cn } from '@/lib/utils';

interface KeyboardKeyProps {
  keyChar: string;
  targetPressure?: number;
  currentPressure?: number;
  isPressed?: boolean;
  isTarget?: boolean;
  className?: string;
}

export const KeyboardKey = ({
  keyChar,
  targetPressure = 0,
  isTarget = false,
  className
}: KeyboardKeyProps) => {
  return (
    <div
      className={cn(
        'relative w-20 h-20 rounded-lg flex flex-col items-center justify-center',
        'font-mono font-bold text-lg border-2 shadow-lg',
        'bg-keyboard-key-idle border-border text-muted-foreground',
        className
      )}
    >
      <span className="text-5xl uppercase">{keyChar}</span>

      {isTarget && (
        <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2">
          <div className="text-s text-center">
            <div className="text-primary text-2xl font-bold">
              {targetPressure}%
            </div>
          </div>
        </div>
      )}
    </div>
  );
};