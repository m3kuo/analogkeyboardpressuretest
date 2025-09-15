import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { KeyboardKey } from './KeyboardKey';
import { useWebSocket, KeyData } from '@/hooks/useWebSocket';
import { Play, Pause, RotateCcw, Wifi, WifiOff, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from "react-router-dom";

interface TestSequence {
  key: string;
  keyCode: number;
  targetPressure: number; // 25 -> Light, 60 -> Medium, 50 -> Mid (10–90), 100 -> Full
}

interface TestStats {
  accuracy: number;
  totalAttempts: number;
  successfulHits: number;
  averageDeviation: number;
}

interface AttemptRecord {
  key: string;
  targetPressure: number; // 25, 60, 50, or 100
  actualPressure: number; // percent (0–100)
  deviation: number;      // percent distance from valid range
  success: boolean;
  timestamp: number;
}

const HOME_ROW_KEYS = [
  { key: 'a', keyCode: 4 },
  { key: 's', keyCode: 22 },
  { key: 'd', keyCode: 7 },
  { key: 'f', keyCode: 9 },
  { key: 'j', keyCode: 13 },
  { key: 'k', keyCode: 14 },
  { key: 'l', keyCode: 15 },
];

// Level sets:
// - 2 levels: Mid (10–90%), Full (100%)
// - 3 levels: Light (10–40%), Medium (41–80%), Full (100%)
const PRESSURE_LEVELS_MAP: Record<number, number[]> = {
  2: [50, 100],        // Mid & Full
  3: [25, 60, 100],    // Light, Medium, Full
};

// Range thresholds (percent)
// Mid band used in 2-level mode:
const MID_MIN  = 10;
const MID_MAX  = 90;

// 3-level bands:
const LIGHT_MIN = 10;
const LIGHT_MAX = 40;
const MED_MIN   = 41;
const MED_MAX   = 80;

// Full detection:
const FULL_MIN  = 95;

// Labels
const getTargetLabel = (t: number) => {
  if (t === 25) return "Light (10–40%)";
  if (t === 60) return "Medium (41–80%)";
  if (t === 50) return "Mid (10–90%)";
  if (t === 100) return "100% (full press)";
  return "";
};

const targetToText = (t: number) => {
  if (t === 25) return "Light (10–40%)";
  if (t === 60) return "Medium (41–80%)";
  if (t === 50) return "Mid (10–90%)";
  if (t === 100) return "100%";
  return String(t);
};

// Range success check
const isSuccessForRange = (target: number, percent: number) => {
  if (target === 25)  return percent >= LIGHT_MIN && percent <= LIGHT_MAX; // Light
  if (target === 60)  return percent >= MED_MIN   && percent <= MED_MAX;   // Medium
  if (target === 50)  return percent >= MID_MIN   && percent <= MID_MAX;   // Mid
  if (target === 100) return percent >= FULL_MIN;                           // Full
  return false;
};

// Deviation from range (0 if inside band)
// - Full: distance below 100 (if under 100), otherwise 0
const computeDeviationForRange = (target: number, percent: number) => {
  if (target === 25) {
    if (percent < LIGHT_MIN) return LIGHT_MIN - percent;
    if (percent > LIGHT_MAX) return percent - LIGHT_MAX;
    return 0;
  }
  if (target === 60) {
    if (percent < MED_MIN) return MED_MIN - percent;
    if (percent > MED_MAX) return percent - MED_MAX;
    return 0;
  }
  if (target === 50) {
    if (percent < MID_MIN) return MID_MIN - percent;
    if (percent > MID_MAX) return percent - MID_MAX;
    return 0;
  }
  if (target === 100) {
    return Math.max(0, 100 - percent);
  }
  return 100;
};

export const AnalogTypingTest = () => {
  const { keyData, connectionStatus, connect, disconnect } = useWebSocket();
  const { toast } = useToast();

  // Player name from router state
  const location = useLocation();
  const playerName = (location.state as { name?: string } | undefined)?.name || "anonymous";

  // Level selection (2 or 3)
  const [levelCount, setLevelCount] = useState<number>(3);

  const [testSequence, setTestSequence] = useState<TestSequence[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTestActive, setIsTestActive] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);

  const [maxAnalog, setMaxAnalog] = useState<number>(0);   // 0–1
  const [keyHeld, setKeyHeld] = useState<boolean>(false);

  const [attemptHistory, setAttemptHistory] = useState<AttemptRecord[]>([]);
  const [testStats, setTestStats] = useState<TestStats>({
    accuracy: 0, totalAttempts: 0, successfulHits: 0, averageDeviation: 0
  });

  const generateTestSequence = useCallback(() => {
    const sequence: TestSequence[] = [];
    const levels = PRESSURE_LEVELS_MAP[levelCount] || [25, 60, 100];
    for (let i = 0; i < 20; i++) {
      const randomKey = HOME_ROW_KEYS[Math.floor(Math.random() * HOME_ROW_KEYS.length)];
      const randomPressure = levels[Math.floor(Math.random() * levels.length)];
      sequence.push({
        key: randomKey.key,
        keyCode: randomKey.keyCode,
        targetPressure: randomPressure
      });
    }
    setTestSequence(sequence);
    setCurrentIndex(0);
    setAttemptHistory([]);
    setTestStats({ accuracy: 0, totalAttempts: 0, successfulHits: 0, averageDeviation: 0 });
  }, [levelCount]);

  useEffect(() => {
    generateTestSequence();
  }, [generateTestSequence]);

  // CSV export
  const exportToCSV = () => {
    if (attemptHistory.length === 0) {
      toast({
        title: 'No data to export',
        description: 'Complete the test first to generate results',
        variant: 'destructive'
      });
      return;
    }

    const headers = "Key,Target,Actual Pressure (%),Deviation (%),Success,Timestamp\n";
    const rows = attemptHistory.map(a =>
      `${a.key},${targetToText(a.targetPressure)},${a.actualPressure},${a.deviation},${a.success ? "Yes" : "No"},${new Date(a.timestamp).toLocaleString()}`
    ).join("\n");

    const summary = [
      "\nSummary",
      `Player,${playerName}`,
      `Accuracy,${Math.round(testStats.accuracy)}%`,
      `Total Attempts,${testStats.totalAttempts}`,
      `Successful Hits,${testStats.successfulHits}`,
      `Average Deviation,${Math.round(testStats.averageDeviation)}%`,
      `Levels,${levelCount}`
    ].join("\n");

    const csvContent = headers + rows + summary;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    const safeName = playerName.replace(/[^a-z0-9]/gi, "_");
    link.setAttribute('href', url);
    link.setAttribute('download', `typing-test-${safeName}-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Range-aware attempt handler
  const handleAttempt = (overrideTitle: string | null = null) => {
    const currentTarget = testSequence[currentIndex];
    const percent = Math.max(0, Math.min(100, maxAnalog * 100));

    const success = isSuccessForRange(currentTarget.targetPressure, percent);
    const deviation = computeDeviationForRange(currentTarget.targetPressure, percent);

    let title = overrideTitle ?? (success ? "Good!" : "Missed target");
    if (!overrideTitle && !success) {
      if (currentTarget.targetPressure === 100) title = "Not fully pressed";
      else title = percent < (currentTarget.targetPressure === 25 ? LIGHT_MIN : currentTarget.targetPressure === 60 ? MED_MIN : MID_MIN)
        ? "Too light"
        : "Too heavy";
    }

    const newAttempt: AttemptRecord = {
      key: currentTarget.key,
      targetPressure: currentTarget.targetPressure,
      actualPressure: Math.round(percent),
      deviation: Math.round(deviation),
      success,
      timestamp: Date.now()
    };

    setAttemptHistory(prev => [...prev, newAttempt]);

    setTestStats(prev => {
      const newTotal = prev.totalAttempts + 1;
      const newHits = prev.successfulHits + (success ? 1 : 0);
      const accuracy = (newHits / newTotal) * 100;
      const avgDev = (prev.averageDeviation * prev.totalAttempts + deviation) / newTotal;
      return { accuracy, totalAttempts: newTotal, successfulHits: newHits, averageDeviation: avgDev };
    });

    toast({
      title,
      description: success ? getTargetLabel(currentTarget.targetPressure)
                           : `Deviation: ${Math.round(deviation)}%`,
      variant: success ? undefined : 'destructive'
    });

    setCooldownUntil(Date.now() + 1500);
    setTimeout(() => {
      setCurrentIndex(prev => prev + 1);
      setCooldownUntil(null);
    }, 1500);
  };

  // Main detection loop
  useEffect(() => {
    if (!isTestActive || currentIndex >= testSequence.length) return;
    if (cooldownUntil && Date.now() < cooldownUntil) return;

    const currentTarget = testSequence[currentIndex];
    const keyEvent = keyData.find(k => k.keyCode === currentTarget.keyCode);
    const otherPressed = keyData.find(k => k.keyCode !== currentTarget.keyCode && k.isPressed);

    if (otherPressed) {
      // Wrong key immediately counts as a miss
      toast({ title: 'Wrong key!', variant: 'destructive' });
      // Record the miss with deviation 100 quickly via handleAttempt:
      // temporarily set a sentinel maxAnalog so we can log an attempt (percent won’t matter here)
      const prev = maxAnalog;
      setMaxAnalog(0);
      handleAttempt('Wrong key!');
      setMaxAnalog(prev);
      return;
    }

    if (keyEvent?.isPressed) {
      setKeyHeld(true);
      setMaxAnalog(prev => Math.max(prev, keyEvent.analogValue));
    } else if (keyHeld) {
      // Key released: evaluate attempt
      handleAttempt();
      setKeyHeld(false);
      setMaxAnalog(0);
    }
  }, [keyData, isTestActive, currentIndex, testSequence, cooldownUntil, keyHeld, maxAnalog, toast]);

  useEffect(() => {
    if (currentIndex >= testSequence.length && isTestActive) {
      setIsTestActive(false);
      toast({
        title: 'Test Complete!',
        description: `Final accuracy: ${Math.round(testStats.accuracy)}%`,
      });
    }
  }, [currentIndex, testSequence.length, isTestActive, testStats.accuracy, toast]);

  const startTest = () => {
    if (connectionStatus !== 'connected') {
      connect();
      toast({ title: 'Connecting...', description: 'Please wait while we connect to your Wooting keyboard' });
      return;
    }
    setIsTestActive(true);
  };

  const pauseTest = () => setIsTestActive(false);

  const resetTest = () => {
    setIsTestActive(false);
    setCurrentIndex(0);
    setTestStats({ accuracy: 0, totalAttempts: 0, successfulHits: 0, averageDeviation: 0 });
    setCooldownUntil(null);
    setMaxAnalog(0);
    setKeyHeld(false);
    generateTestSequence();
  };

  const getCurrentKeyPress = (keyCode: number): KeyData | undefined => {
    return keyData.find(k => k.keyCode === keyCode);
  };

  const getConnectionIcon = () => {
    switch (connectionStatus) {
      case 'connected': return <Wifi className="w-4 h-4 text-success" />;
      case 'connecting': return <Wifi className="w-4 h-4 text-warning animate-pulse" />;
      default: return <WifiOff className="w-4 h-4 text-destructive" />;
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            Wooting Analog Precision Test
          </h1>
          <p className="text-muted-foreground">
            Test your keyboard control by hitting and holding precise pressure values
          </p>
          <p className="text-sm text-muted-foreground">
            Player: <span className="font-medium">{playerName}</span>
          </p>
        </div>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {getConnectionIcon()}
              <span className="font-medium">
                Status: {connectionStatus.charAt(0).toUpperCase() + connectionStatus.slice(1)}
              </span>
            </div>
            <div className="flex gap-2">
              {connectionStatus !== 'connected' && (
                <Button variant="outline" size="sm" onClick={connect}>
                  Connect
                </Button>
              )}
              {connectionStatus === 'connected' && (
                <Button variant="outline" size="sm" onClick={disconnect}>
                  Disconnect
                </Button>
              )}
            </div>
          </div>
        </Card>

        <div className="flex justify-center">
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">Select pressure thresholds:</div>
            <div className="flex gap-2">
              {[2, 3].map((count) => (
                <Button
                  key={count}
                  variant={count === levelCount ? 'default' : 'outline'}
                  onClick={() => setLevelCount(count)}
                  size="sm"
                >
                  {count} Levels
                </Button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-primary">
              {Math.round(testStats.accuracy)}%
            </div>
            <div className="text-sm text-muted-foreground">Accuracy</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-foreground">
              {testStats.successfulHits}
            </div>
            <div className="text-sm text-muted-foreground">Successful Hits</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-foreground">
              {testStats.totalAttempts}
            </div>
            <div className="text-sm text-muted-foreground">Total Attempts</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-foreground">
              {Math.round(testStats.averageDeviation)}%
            </div>
            <div className="text-sm text-muted-foreground">Avg Deviation</div>
          </Card>
        </div>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex gap-2">
              {!isTestActive ? (
                <Button onClick={startTest} className="flex items-center gap-2">
                  <Play className="w-4 h-4" />
                  Start Test
                </Button>
              ) : (
                <Button onClick={pauseTest} variant="secondary" className="flex items-center gap-2">
                  <Pause className="w-4 h-4" />
                  Pause
                </Button>
              )}
              <Button onClick={resetTest} variant="outline" className="flex items-center gap-2">
                <RotateCcw className="w-4 h-4" />
                Reset
              </Button>
              <Button
                onClick={exportToCSV}
                variant="outline"
                className="flex items-center gap-2"
                disabled={attemptHistory.length === 0}
              >
                <Download className="w-4 h-4" />
                Export CSV
              </Button>
            </div>
            <div className="text-m text-muted-foreground">
              Progress: {currentIndex} / {testSequence.length}
            </div>
          </div>
        </Card>

        {isTestActive && (
          <Card className="p-6 text-center">
            {cooldownUntil && Date.now() < cooldownUntil ? (
              <div className="text-lg text-muted-foreground">Get ready for the next key...</div>
            ) : (
              <div>
                <div className="text-3xl text-muted-foreground mb-2">
                  Press and hold this key in the indicated analog range:
                </div>
                <div className="flex justify-center">
                  <KeyboardKey
                    keyChar={testSequence[currentIndex]?.key}
                    targetPressure={testSequence[currentIndex]?.targetPressure}
                    currentPressure={getCurrentKeyPress(testSequence[currentIndex]?.keyCode)?.analogValue || 0}
                    isPressed={getCurrentKeyPress(testSequence[currentIndex]?.keyCode)?.isPressed === 1}
                    isTarget={true}
                    className="w-20 h-20 text-10xl"
                  />
                </div>
                <div className="mt-3 text-3xl text-muted-foreground">
                  Target: {getTargetLabel(testSequence[currentIndex]?.targetPressure ?? 50)}
                </div>
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
};
