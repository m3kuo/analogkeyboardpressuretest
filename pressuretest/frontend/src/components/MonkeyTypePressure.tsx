import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { KeyboardKey } from './KeyboardKey';
import { useWebSocket, KeyData } from '@/hooks/useWebSocket';
import { Play, Pause, RotateCcw, Wifi, WifiOff, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useNavigate, useLocation } from "react-router-dom";

interface MonkeyTypeSequence {
  key: string;
  keyCode: number;
  targetPressure: number; // 25, 60, 50, or 100
}

interface MonkeyTypeStats {
  accuracy: number;
  totalAttempts: number;
  successfulHits: number;
  averageDeviation: number;
  wpm: number;
  timeElapsed: number;
}

interface MonkeyTypeAttempt {
  key: string;
  targetPressure: number;
  actualPressure: number;
  deviation: number;
  success: boolean;
  timestamp: number;
}

const COMMON_WORDS = [
  'the', 'quick', 'brown', 'fox', 'jumps', 'over', 'lazy', 'dog',
  'able', 'about', 'above', 'after', 'again', 'against', 'all', 'am',
  'and', 'any', 'are', 'area', 'areas', 'around', 'as', 'ask', 'asked',
  'aside', 'ask', 'at', 'ate', 'away', 'awesome', 'back', 'bad', 'bag',
  'ball', 'band', 'bank', 'bar', 'bare', 'bark', 'base', 'basic', 'basket',
  'bass', 'bath', 'be', 'beach', 'bean', 'bear', 'beat', 'been', 'beer',
  'before', 'began', 'begin', 'being', 'bell', 'below', 'belt', 'bend',
  'best', 'better', 'between', 'beyond', 'big', 'bike', 'bill', 'bind',
  'bird', 'birth', 'bit', 'bite', 'black', 'blade', 'blame', 'blank',
  'blast', 'blood', 'blow', 'blue', 'board', 'body', 'boil', 'bold',
  'bolt', 'bomb', 'bond', 'bone', 'book', 'boom', 'boot', 'bore', 'born',
];

// Pressure level ranges
const LIGHT_MIN = 10;
const LIGHT_MAX = 40;
const MED_MIN = 41;
const MED_MAX = 80;
const MID_MIN = 10;
const MID_MAX = 90;
const FULL_MIN = 95;

const getTargetLabel = (t: number) => {
  if (t === 25) return "Light (10–40%)";
  if (t === 60) return "Medium (41–80%)";
  if (t === 50) return "Mid (10–90%)";
  if (t === 100) return "100% (full press)";
  return "";
};

const targetToText = (t: number) => {
  if (t === 25) return "Light";
  if (t === 60) return "Medium";
  if (t === 50) return "Mid";
  if (t === 100) return "Full";
  return String(t);
};

const isSuccessForRange = (target: number, percent: number) => {
  if (target === 25) return percent >= LIGHT_MIN && percent <= LIGHT_MAX;
  if (target === 60) return percent >= MED_MIN && percent <= MED_MAX;
  if (target === 50) return percent >= MID_MIN && percent <= MID_MAX;
  if (target === 100) return percent >= FULL_MIN;
  return false;
};

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

// Get keys used in a word
const getKeysForWord = (word: string): MonkeyTypeSequence[] => {
  const keyCodeMap: Record<string, number> = {
    'a': 4, 'b': 5, 'c': 6, 'd': 7, 'e': 8, 'f': 9, 'g': 10, 'h': 11, 'i': 12,
    'j': 13, 'k': 14, 'l': 15, 'm': 16, 'n': 17, 'o': 18, 'p': 19, 'q': 20,
    'r': 21, 's': 22, 't': 23, 'u': 24, 'v': 25, 'w': 26, 'x': 27, 'y': 28, 'z': 29,
  };

  return word.toLowerCase().split('').map(char => ({
    key: char,
    keyCode: keyCodeMap[char] || 0,
    targetPressure: [25, 60, 50, 100][Math.floor(Math.random() * 4)]
  }));
};

export const MonkeyTypePressure = () => {
  const { keyData, connectionStatus, connect, disconnect } = useWebSocket();
  const { toast } = useToast();
  const navigate = useNavigate();

  const location = useLocation();
  const playerName = (location.state as { name?: string } | undefined)?.name || "anonymous";

  const [testSequence, setTestSequence] = useState<MonkeyTypeSequence[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTestActive, setIsTestActive] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [testStartTime, setTestStartTime] = useState<number | null>(null);

  const [maxAnalog, setMaxAnalog] = useState<number>(0);
  const [keyHeld, setKeyHeld] = useState<boolean>(false);

  const [attemptHistory, setAttemptHistory] = useState<MonkeyTypeAttempt[]>([]);
  const [testStats, setTestStats] = useState<MonkeyTypeStats>({
    accuracy: 0,
    totalAttempts: 0,
    successfulHits: 0,
    averageDeviation: 0,
    wpm: 0,
    timeElapsed: 0
  });

  // Generate sequence from words
  const generateTestSequence = useCallback(() => {
    const sequence: MonkeyTypeSequence[] = [];
    const numWords = 10; // 10 words for quick test
    for (let i = 0; i < numWords; i++) {
      const word = COMMON_WORDS[Math.floor(Math.random() * COMMON_WORDS.length)];
      const keySequence = getKeysForWord(word);
      sequence.push(...keySequence);
      // Add space between words
      if (i < numWords - 1) {
        sequence.push({
          key: ' ',
          keyCode: 44, // Space key
          targetPressure: [25, 60, 50, 100][Math.floor(Math.random() * 4)]
        });
      }
    }
    setTestSequence(sequence);
    setCurrentIndex(0);
    setAttemptHistory([]);
    setTestStats({
      accuracy: 0,
      totalAttempts: 0,
      successfulHits: 0,
      averageDeviation: 0,
      wpm: 0,
      timeElapsed: 0
    });
  }, []);

  useEffect(() => {
    generateTestSequence();
  }, [generateTestSequence]);

  // Update WPM and time elapsed
  useEffect(() => {
    if (!isTestActive || !testStartTime) return;

    const interval = setInterval(() => {
      const elapsed = (Date.now() - testStartTime) / 1000 / 60; // minutes
      const words = testStats.successfulHits;
      const wpm = elapsed > 0 ? Math.round(words / elapsed) : 0;

      setTestStats(prev => ({
        ...prev,
        wpm,
        timeElapsed: Math.round((Date.now() - testStartTime) / 1000)
      }));
    }, 1000);

    return () => clearInterval(interval);
  }, [isTestActive, testStartTime, testStats.successfulHits]);

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
      `${a.key === ' ' ? 'SPACE' : a.key},${targetToText(a.targetPressure)},${a.actualPressure},${a.deviation},${a.success ? "Yes" : "No"},${new Date(a.timestamp).toLocaleString()}`
    ).join("\n");

    const summary = [
      "\nSummary",
      `Player,${playerName}`,
      `Accuracy,${Math.round(testStats.accuracy)}%`,
      `WPM,${testStats.wpm}`,
      `Time Elapsed,${testStats.timeElapsed}s`,
      `Total Attempts,${testStats.totalAttempts}`,
      `Successful Hits,${testStats.successfulHits}`,
      `Average Deviation,${Math.round(testStats.averageDeviation)}%`,
    ].join("\n");

    const csvContent = headers + rows + summary;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    const safeName = playerName.replace(/[^a-z0-9]/gi, "_");
    link.setAttribute('href', url);
    link.setAttribute('download', `monkeytype-pressure-${safeName}-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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

    const newAttempt: MonkeyTypeAttempt = {
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
      const elapsed = testStartTime ? (Date.now() - testStartTime) / 1000 / 60 : 0;
      const wpm = elapsed > 0 ? Math.round(newHits / elapsed) : 0;

      return {
        accuracy,
        totalAttempts: newTotal,
        successfulHits: newHits,
        averageDeviation: avgDev,
        wpm,
        timeElapsed: testStartTime ? Math.round((Date.now() - testStartTime) / 1000) : 0
      };
    });

    setCooldownUntil(Date.now() + 300); // Shorter cooldown for MonkeyType feel
    setTimeout(() => {
      setCurrentIndex(prev => prev + 1);
      setCooldownUntil(null);
    }, 300);
  };

  useEffect(() => {
    if (!isTestActive || currentIndex >= testSequence.length) return;
    if (cooldownUntil && Date.now() < cooldownUntil) return;

    const currentTarget = testSequence[currentIndex];
    const keyEvent = keyData.find(k => k.keyCode === currentTarget.keyCode);
    const otherPressed = keyData.find(k => k.keyCode !== currentTarget.keyCode && k.isPressed);

    if (otherPressed) {
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
        description: `Final WPM: ${testStats.wpm} | Accuracy: ${Math.round(testStats.accuracy)}%`,
      });
    }
  }, [currentIndex, testSequence.length, isTestActive, testStats.accuracy, testStats.wpm, toast]);

  const startTest = () => {
    if (connectionStatus !== 'connected') {
      connect();
      toast({ title: 'Connecting...', description: 'Please wait while we connect to your Wooting keyboard' });
      return;
    }
    setIsTestActive(true);
    setTestStartTime(Date.now());
  };

  const pauseTest = () => setIsTestActive(false);

  const resetTest = () => {
    setIsTestActive(false);
    setCurrentIndex(0);
    setTestStats({
      accuracy: 0,
      totalAttempts: 0,
      successfulHits: 0,
      averageDeviation: 0,
      wpm: 0,
      timeElapsed: 0
    });
    setCooldownUntil(null);
    setMaxAnalog(0);
    setKeyHeld(false);
    setTestStartTime(null);
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

  // Get words being typed
  const getTypedWords = () => {
    let words: string[] = [];
    let currentWord = '';
    for (let i = 0; i < currentIndex; i++) {
      if (testSequence[i].key === ' ') {
        if (currentWord) words.push(currentWord);
        currentWord = '';
      } else {
        currentWord += testSequence[i].key;
      }
    }
    return words;
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            MonkeyType Pressure Edition
          </h1>
          <p className="text-muted-foreground">
            Type words while maintaining precise pressure levels on each keystroke
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
              <Button variant="outline" size="sm" onClick={() => navigate('/')}>
                Back to Menu
              </Button>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-primary">
              {testStats.wpm}
            </div>
            <div className="text-sm text-muted-foreground">WPM</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-primary">
              {Math.round(testStats.accuracy)}%
            </div>
            <div className="text-sm text-muted-foreground">Accuracy</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-foreground">
              {testStats.timeElapsed}s
            </div>
            <div className="text-sm text-muted-foreground">Time</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-foreground">
              {testStats.successfulHits}
            </div>
            <div className="text-sm text-muted-foreground">Correct Keys</div>
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
                <div className="text-2xl text-muted-foreground mb-4">
                  Type the next letter with the indicated pressure:
                </div>
                <div className="flex justify-center mb-6">
                  <KeyboardKey
                    keyChar={testSequence[currentIndex]?.key === ' ' ? '⎵' : testSequence[currentIndex]?.key}
                    targetPressure={testSequence[currentIndex]?.targetPressure}
                    currentPressure={getCurrentKeyPress(testSequence[currentIndex]?.keyCode)?.analogValue || 0}
                    isPressed={getCurrentKeyPress(testSequence[currentIndex]?.keyCode)?.isPressed === 1}
                    isTarget={true}
                    className="w-20 h-20 text-10xl"
                  />
                </div>
                <div className="mb-4 text-xl text-muted-foreground">
                  Target: {getTargetLabel(testSequence[currentIndex]?.targetPressure ?? 50)}
                </div>
                <div className="bg-muted p-4 rounded-lg">
                  <div className="text-sm text-muted-foreground mb-2">Typed so far:</div>
                  <div className="text-lg font-mono">
                    {getTypedWords().join(' ')}
                  </div>
                </div>
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
};
