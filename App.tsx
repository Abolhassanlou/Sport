
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Exercise, RepState } from './types';
import { geminiService } from './services/geminiService';
import { Camera, RefreshCw, Play, Pause } from 'lucide-react';

// This helper component is defined outside App to avoid re-creation on every render
const ExerciseSelector: React.FC<{
  selectedExercise: Exercise | null;
  onSelect: (exercise: Exercise) => void;
  disabled: boolean;
}> = ({ selectedExercise, onSelect, disabled }) => {
  return (
    <div className="flex justify-center gap-4 mb-6">
      {(Object.values(Exercise)).map((ex) => (
        <button
          key={ex}
          onClick={() => onSelect(ex)}
          disabled={disabled}
          className={`px-6 py-3 rounded-lg text-lg font-semibold transition-all duration-300 transform hover:scale-105 ${
            selectedExercise === ex
              ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/50'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {ex}
        </button>
      ))}
    </div>
  );
};

export default function App() {
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [repCount, setRepCount] = useState<number>(0);
  const [isCounting, setIsCounting] = useState<boolean>(false);
  const [cameraReady, setCameraReady] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string>('حرکت ورزشی را انتخاب کنید');
  
  const lastPosition = useRef<RepState>('NEUTRAL');
  const repStateCooldown = useRef<boolean>(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analysisIntervalRef = useRef<number | null>(null);

  const setupCamera = useCallback(async () => {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setCameraReady(true);
          setCameraError(null);
        }
      } catch (err) {
        console.error("Error accessing camera: ", err);
        setCameraError("دسترسی به دوربین ممکن نیست. لطفا اجازه دسترسی به دوربین را بدهید.");
        setCameraReady(false);
      }
    } else {
      setCameraError("مرورگر شما از دسترسی به دوربین پشتیبانی نمی‌کند.");
    }
  }, []);
  
  useEffect(() => {
    setupCamera();
    return () => {
        if(analysisIntervalRef.current) {
            clearInterval(analysisIntervalRef.current);
        }
    }
  }, [setupCamera]);
  
  const analyzeFrame = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || !selectedExercise) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const context = canvas.getContext('2d');
    if(!context) return;
    
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const base64Image = canvas.toDataURL('image/jpeg', 0.7).split(',')[1];

    if (base64Image) {
      setFeedbackMessage('در حال تحلیل...');
      const position = await geminiService.analyzeFrame(base64Image, selectedExercise);
      setFeedbackMessage(position);

      if (repStateCooldown.current) return;
      
      // State machine logic for counting reps
      if (lastPosition.current === 'DOWN' && position === 'UP') {
        setRepCount(prev => prev + 1);
        setFeedbackMessage('عالی!');
        repStateCooldown.current = true;
        setTimeout(() => {
          repStateCooldown.current = false;
        }, 500); // 500ms cooldown to prevent double counting
      }
      lastPosition.current = position;
    }
  }, [selectedExercise]);

  const startCounting = () => {
    if (!selectedExercise) {
      setFeedbackMessage('لطفا ابتدا یک حرکت ورزشی را انتخاب کنید!');
      return;
    }
    setIsCounting(true);
    setFeedbackMessage('آماده!');
    analysisIntervalRef.current = window.setInterval(analyzeFrame, 1000); // Analyze one frame per second
  };

  const stopCounting = () => {
    setIsCounting(false);
    if (analysisIntervalRef.current) {
      clearInterval(analysisIntervalRef.current);
    }
    setFeedbackMessage('متوقف شد. برای ادامه شروع را بزنید.');
  };

  const resetCounter = () => {
    stopCounting();
    setRepCount(0);
    lastPosition.current = 'NEUTRAL';
    setFeedbackMessage(selectedExercise ? 'شمارنده صفر شد' : 'حرکت ورزشی را انتخاب کنید');
  };

  const handleSelectExercise = (exercise: Exercise) => {
    resetCounter();
    setSelectedExercise(exercise);
    setFeedbackMessage(`حرکت ${exercise} انتخاب شد. برای شروع آماده‌اید؟`);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">
      <main className="w-full max-w-4xl bg-gray-800 rounded-2xl shadow-2xl p-6 md:p-8 flex flex-col items-center">
        <h1 className="text-4xl md:text-5xl font-bold text-emerald-400 mb-4">
          شمارنده هوشمند ورزش
        </h1>
        <p className="text-gray-400 mb-8 text-lg">با کمک هوش مصنوعی حرکات خود را بشمارید</p>
        
        <ExerciseSelector 
          selectedExercise={selectedExercise}
          onSelect={handleSelectExercise}
          disabled={isCounting}
        />

        <div className="w-full bg-black rounded-lg overflow-hidden shadow-inner aspect-video mb-6 relative flex items-center justify-center">
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover transform -scale-x-100"></video>
          <canvas ref={canvasRef} className="hidden"></canvas>
          {!cameraReady && (
            <div className="absolute inset-0 bg-black bg-opacity-70 flex flex-col items-center justify-center text-center p-4">
                <Camera className="w-16 h-16 text-gray-500 mb-4" />
                <p className="text-xl font-semibold">{cameraError || 'در حال آماده‌سازی دوربین...'}</p>
            </div>
          )}
        </div>

        <div className="w-full flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center justify-center gap-6">
                <button
                    onClick={isCounting ? stopCounting : startCounting}
                    disabled={!selectedExercise || !cameraReady}
                    className="w-24 h-24 rounded-full flex items-center justify-center text-white transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100 shadow-lg
                    bg-gradient-to-br from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 disabled:from-gray-600 disabled:to-gray-700"
                >
                    {isCounting ? <Pause size={48} /> : <Play size={48} />}
                </button>
                <button
                    onClick={resetCounter}
                    className="w-20 h-20 rounded-full flex items-center justify-center bg-gray-700 text-gray-300 hover:bg-gray-600 transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={isCounting && repCount === 0}
                >
                    <RefreshCw size={36} />
                </button>
            </div>

            <div className="text-center md:text-right">
                <p className="text-xl text-gray-400 mb-2">تکرار</p>
                <p className="text-8xl font-bold text-emerald-400 tracking-tighter" style={{fontVariantNumeric: 'tabular-nums'}}>{repCount}</p>
            </div>
        </div>
        <div className="mt-6 w-full text-center bg-gray-700/50 p-3 rounded-lg">
          <p className="text-lg text-gray-300">{feedbackMessage}</p>
        </div>
      </main>
    </div>
  );
}
