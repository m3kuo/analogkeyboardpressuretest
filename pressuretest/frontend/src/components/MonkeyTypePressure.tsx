import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { KeyboardKey } from './KeyboardKey';
import { useWebSocket } from '@/hooks/useWebSocket';
import { Play, RotateCcw, Wifi, WifiOff, ChevronRight, Keyboard, AlertCircle, CheckCircle2, Trophy, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from "react-router-dom";

interface MonkeyTypeSequence {
  key: string;
  keyCode: number;
  targetPressure: number;
  wordIndex: number;
}

const COMMON_WORDS = ['the', 'quick', 'brown', 'fox', 'jumps', 'over', 'lazy', 'dog', 'able', 'about', 'above', 'again', 'area', 'best', 'better', 'bird', 'black', 'blue', 'body', 'book', 'built', 'busy', 'call'];
const PRESSURE_TARGETS = [25, 60, 100]; 
const LIGHT_MIN = 10; const LIGHT_MAX = 40;
const MED_MIN = 41;  const MED_MAX = 80;
const FULL_MIN = 95;

const getTargetLabel = (t: number) => {
  if (t === 25) return "Light (10–40%)";
  if (t === 60) return "Medium (41–80%)";
  if (t === 100) return "100% (Full)";
  return "Mid (10-90%)";
};

export const MonkeyTypePressure = () => {
  const { keyData, connectionStatus, connect, disconnect } = useWebSocket();
  const { toast } = useToast();
  const location = useLocation();

  const playerName = (location.state as { name?: string } | undefined)?.name || "anonymous";
  const [wordCountGoal, setWordCountGoal] = useState<5 | 15>(5);
  const [testSequence, setTestSequence] = useState<MonkeyTypeSequence[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTestActive, setIsTestActive] = useState(false);
  const [testComplete, setTestComplete] = useState(false);
  const [testStartTime, setTestStartTime] = useState<number | null>(null);
  const [maxAnalog, setMaxAnalog] = useState<number>(0);
  const [keyHeld, setKeyHeld] = useState<boolean>(false);
  
  const [lastFeedback, setLastFeedback] = useState<{ text: string, type: 'success' | 'error' } | null>(null);
  const [letterResults, setLetterResults] = useState<{ success: boolean, pressure: number }[]>([]);
  const [finalStats, setFinalStats] = useState({ wpm: 0, accuracy: 0, avgPressure: 0 });

  // Handle word sequence generation
  const generateTestSequence = useCallback(() => {
    const sequence: MonkeyTypeSequence[] = [];
    const keyCodeMap: Record<string, number> = {
      'a':4,'b':5,'c':6,'d':7,'e':8,'f':9,'g':10,'h':11,'i':12,'j':13,'k':14,'l':15,
      'm':16,'n':17,'o':18,'p':19,'q':20,'r':21,'s':22,'t':23,'u':24,'v':25,'w':26,
      'x':27,'y':28,'z':29,' ':44
    };

    for (let i = 0; i < wordCountGoal; i++) {
      const word = COMMON_WORDS[Math.floor(Math.random() * COMMON_WORDS.length)];
      const targetPressure = PRESSURE_TARGETS[Math.floor(Math.random() * PRESSURE_TARGETS.length)];
      word.split('').forEach(char => {
        sequence.push({ key: char, keyCode: keyCodeMap[char] || 0, targetPressure, wordIndex: i });
      });
      if (i < wordCountGoal - 1) {
        sequence.push({ key: ' ', keyCode: 44, targetPressure, wordIndex: i });
      }
    }
    setTestSequence(sequence);
    setCurrentIndex(0);
    setLetterResults([]);
    setTestComplete(false);
    setIsTestActive(false);
  }, [wordCountGoal]);

  useEffect(() => { generateTestSequence(); }, [generateTestSequence]);

  const handleStart = () => {
    if (connectionStatus !== 'connected') {
      connect();
      toast({ title: "Connecting...", description: "Please ensure your keyboard backend is active." });
      return;
    }
    setIsTestActive(true);
    setTestStartTime(Date.now());
  };

  const exportToCSV = () => {
    const headers = "Key,Target,Actual,Success\n";
    const rows = letterResults.map((r, i) => 
      `${testSequence[i].key === ' ' ? 'SPACE' : testSequence[i].key},${testSequence[i].targetPressure},${r.pressure},${r.success}`
    ).join("\n");
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pressure_results_${playerName}.csv`;
    a.click();
  };

  const handleAttempt = () => {
    const current = testSequence[currentIndex];
    const percent = Math.round(maxAnalog * 100);
    const t = current.targetPressure;
    
    let success = false;
    let feedbackText = "";

    if (t === 25) {
        success = percent >= LIGHT_MIN && percent <= LIGHT_MAX;
        feedbackText = success ? "Perfect Light" : percent < LIGHT_MIN ? "Too Light" : "Too Heavy";
    } else if (t === 60) {
        success = percent >= MED_MIN && percent <= MED_MAX;
        feedbackText = success ? "Great Mid" : percent < MED_MIN ? "Too Light" : "Too Heavy";
    } else if (t === 100) {
        success = percent >= FULL_MIN;
        feedbackText = success ? "Solid Press" : "Needs more force";
    }

    setLastFeedback({ text: `${feedbackText} (${percent}%)`, type: success ? 'success' : 'error' });
    const newResults = [...letterResults, { success, pressure: percent }];
    setLetterResults(newResults);

    if (currentIndex === testSequence.length - 1) {
        const duration = (Date.now() - (testStartTime || 0)) / 60000;
        const correct = newResults.filter(r => r.success).length;
        setFinalStats({
            wpm: Math.round((correct / 5) / duration),
            accuracy: (correct / testSequence.length) * 100,
            avgPressure: Math.round(newResults.reduce((acc, r) => acc + r.pressure, 0) / newResults.length)
        });
        setTestComplete(true);
        setIsTestActive(false);
    }
    setCurrentIndex(prev => prev + 1);
  };

  useEffect(() => {
    if (!isTestActive || currentIndex >= testSequence.length) return;
    const current = testSequence[currentIndex];
    const keyEv = keyData.find(k => k.keyCode === current.keyCode);
    if (keyEv?.isPressed) {
      setKeyHeld(true);
      setMaxAnalog(prev => Math.max(prev, keyEv.analogValue));
    } else if (keyHeld) {
      handleAttempt();
      setKeyHeld(false);
      setMaxAnalog(0);
    }
  }, [keyData, isTestActive, currentIndex, keyHeld, maxAnalog]);

  return (
    <div className="min-h-screen bg-background p-6 font-mono text-foreground">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Connection Bar (RESTORED) */}
        <div className="flex items-center justify-between bg-muted/30 p-4 rounded-xl border border-border">
          <div className="flex items-center gap-4">
            <div className={`p-2 rounded-full ${connectionStatus === 'connected' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500 animate-pulse'}`}>
              {connectionStatus === 'connected' ? <Wifi size={20} /> : <WifiOff size={20} />}
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest leading-none">Status</p>
              <p className="font-bold text-sm leading-tight">{connectionStatus === 'connected' ? 'Keyboard Linked' : 'Disconnected'}</p>
            </div>
          </div>
          <div className="flex gap-2">
            {connectionStatus !== 'connected' ? (
              <Button size="sm" onClick={connect} className="bg-primary text-primary-foreground font-bold text-[10px] uppercase tracking-widest">
                <Keyboard size={14} className="mr-2" /> Connect Keyboard
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={disconnect} className="text-[10px] font-bold uppercase tracking-widest">Disconnect</Button>
            )}
          </div>
        </div>

        {/* Feedback Bar */}
        <div className={`flex items-center justify-center gap-3 p-3 rounded-xl border transition-all h-12 ${!lastFeedback ? 'opacity-20' : lastFeedback.type === 'success' ? 'border-green-500/50 bg-green-500/5 text-green-500' : 'border-red-500/50 bg-red-500/5 text-red-500'}`}>
            {lastFeedback && (
              <>
                {lastFeedback.type === 'success' ? <CheckCircle2 size={16}/> : <AlertCircle size={16}/>}
                <span className="text-xs font-bold uppercase tracking-tight">{lastFeedback.text}</span>
              </>
            )}
        </div>

        {!testComplete ? (
          <>
            <div className="flex justify-center gap-2 bg-muted/20 p-1 rounded-lg w-fit mx-auto">
              {[5, 15].map(n => (
                <button key={n} disabled={isTestActive} onClick={() => setWordCountGoal(n as 5|15)} className={`px-6 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all ${wordCountGoal === n ? 'bg-background text-primary shadow-sm' : 'text-muted-foreground'}`}>{n} words</button>
              ))}
            </div>

            <Card className="p-16 relative bg-card border-2 border-muted overflow-hidden">
              {!isTestActive ? (
                <div className="text-center py-6 space-y-6">
                  <h2 className="text-3xl font-black uppercase italic tracking-tighter">Pressure Test</h2>
                  <Button size="lg" onClick={handleStart} className="px-12 font-bold uppercase tracking-[0.2em] h-14">Start Session</Button>
                </div>
              ) : (
                <div className="space-y-12 text-center">
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-primary uppercase tracking-[0.4em] opacity-80">Target Pressure</p>
                    <p className="text-3xl font-black">{getTargetLabel(testSequence[currentIndex]?.targetPressure)}</p>
                  </div>

                  <div className="flex justify-center">
                    <KeyboardKey
                      keyChar={testSequence[currentIndex]?.key === ' ' ? '␣' : testSequence[currentIndex]?.key}
                      targetPressure={testSequence[currentIndex]?.targetPressure}
                      currentPressure={keyData.find(k => k.keyCode === testSequence[currentIndex]?.keyCode)?.analogValue || 0}
                      isPressed={keyHeld}
                      isTarget={true}
                      className="w-36 h-36 text-7xl border-4"
                    />
                  </div>

                  <div className="space-y-4">
                    <div className="text-4xl flex flex-wrap justify-center gap-x-[0.15em] leading-relaxed">
                      {testSequence.map((item, idx) => {
                        const isTyped = idx < currentIndex;
                        const isCurrent = idx === currentIndex;
                        const result = letterResults[idx];
                        return (
                          <span key={idx} className="relative">
                            {isCurrent && <span className="absolute left-0 top-1 w-1 h-[1.1em] bg-primary animate-pulse rounded-full" />}
                            <span className={isTyped ? (result?.success ? "text-green-500" : "text-red-500") : "text-muted-foreground/20"}>
                              {item.key === ' ' ? '\u00A0' : item.key}
                            </span>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </Card>
          </>
        ) : (
          /* Results Dashboard */
          <Card className="p-16 text-center space-y-10 border-4 border-primary/20 bg-card shadow-2xl animate-in zoom-in duration-300">
            <div className="space-y-2">
                <Trophy className="w-14 h-14 text-primary mx-auto mb-4" />
                <h2 className="text-4xl font-black uppercase tracking-tighter italic">Evaluation Complete</h2>
                <p className="text-muted-foreground text-xs uppercase font-bold tracking-[0.3em]">Performance for {playerName}</p>
            </div>

            <div className="grid grid-cols-3 gap-4 border-y border-muted py-12">
                <div><p className="text-6xl font-black text-primary leading-none">{finalStats.wpm}</p><p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-2">wpm</p></div>
                <div><p className="text-6xl font-black leading-none">{Math.round(finalStats.accuracy)}%</p><p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-2">accuracy</p></div>
                <div><p className="text-6xl font-black leading-none">{finalStats.avgPressure}%</p><p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-2">avg force</p></div>
            </div>

            <div className="flex justify-center gap-4">
                <Button onClick={generateTestSequence} variant="outline" className="px-10 h-12 border-2 font-bold uppercase tracking-widest hover:bg-primary hover:text-primary-foreground">
                    <RotateCcw className="mr-2 w-4 h-4" /> Restart
                </Button>
                <Button onClick={exportToCSV} className="px-10 h-12 font-bold uppercase tracking-widest">
                    <Download className="mr-2 w-4 h-4" /> Export CSV
                </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};