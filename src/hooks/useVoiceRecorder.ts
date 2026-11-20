"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface UseVoiceRecorderOptions {
  /** Called with the finished recording when the user stops (not cancels). */
  onFinish: (file: File, durationMs: number) => void;
  /** Called when the microphone cannot be opened (permission denied, no device). */
  onError?: (message: string) => void;
}

/** Wraps MediaRecorder with a ticking duration and guaranteed track cleanup. */
export function useVoiceRecorder({ onFinish, onError }: UseVoiceRecorderOptions) {
  const [recording, setRecording] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef = useRef(0);

  const releaseStream = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    setRecording(false);
  }, []);

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.start();
      recorderRef.current = recorder;
      elapsedRef.current = 0;
      setElapsedMs(0);
      setRecording(true);
      timerRef.current = setInterval(() => {
        elapsedRef.current += 1000;
        setElapsedMs(elapsedRef.current);
      }, 1000);
    } catch (error) {
      console.error("Could not start recording:", error);
      onError?.("Microphone unavailable. Check your browser permissions.");
    }
  }, [onError]);

  const stop = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder) return;
    const durationMs = elapsedRef.current;
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
      const ext = blob.type.includes("mp4") ? "m4a" : "webm";
      onFinish(new File([blob], `voice-note.${ext}`, { type: blob.type }), durationMs);
    };
    recorder.stop();
    releaseStream();
  }, [onFinish, releaseStream]);

  const cancel = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder) recorder.onstop = null;
    if (recorder && recorder.state !== "inactive") recorder.stop();
    releaseStream();
  }, [releaseStream]);

  // Never leave the microphone open after unmount.
  useEffect(() => cancel, [cancel]);

  return { recording, elapsedMs, start, stop, cancel };
}
