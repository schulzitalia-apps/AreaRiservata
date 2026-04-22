"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

type RecentTurn = {
  role: "user" | "assistant";
  text: string;
};

type DebugPayload = {
  status: "idle" | "loading" | "success" | "error";
  request?: {
    message: string;
  };
  response?: any;
  error?: string;
};

type LlmTraceStep = {
  id: string;
  step: string;
  title: string;
  reason: string;
  provider: "groq" | "glm";
  model: string | null;
  usage?: {
    inputTokens?: number | null;
    outputTokens?: number | null;
    totalTokens?: number | null;
  } | null;
  purpose?: string | null;
  systemPrompt: string;
  input: Record<string, unknown>;
  rawResponse: string | null;
  parsedResponse?: unknown;
  status: "success" | "failed";
  error?: string | null;
};

type DisplayTraceStep = LlmTraceStep & {
  isSynthetic?: boolean;
};

const SUGGESTIONS = [
  "buongiorno",
  "che tipi di eventi puoi gestire?",
  "aggiornami sugli eventi degli ultimi 7 giorni",
  "mostrami tutti gli appuntamenti",
  "mostrami gli appuntamenti degli ultimi 10 giorni",
  "dammi solo gli eventi riunione evolve nell'ultimo mese",
  "mostrami i memo di questo mese",
  "che eventi ho in futuro?",
  "mi ricordi di chiamare Mario domani alle 15",
  "mi ricordi gli eventi dei prossimi sette giorni?",
  "mandami un promemoria degli eventi dei prossimi 7 giorni via mail",
  "fammi vedere gli eventi del 12/04/2026",
  "crea appuntamento domani dalle 10 alle 11",
  'crea memo per la giornata di sabato con titolo "e un test", orario 12-13',
  'crea memo per domani, titolo: "sono scemo a provarlo"',
  "crea appuntamento domani alle 15 e mandami anche una mail",
  "crea riunione evolve il 12/04/2026 alle 10",
  "ricordami un appuntamento domani alle 15",
];

const SUGGESTION_BATCH_SIZE = 4;
const IDLE_SUGGESTION_DELAY_MS = 25000;

const TRACE_CARD_STYLES = [
  {
    border: "border-cyan-400/50",
    badge: "bg-cyan-500/15 text-cyan-200",
    title: "text-cyan-100",
    bg: "bg-cyan-500/5",
  },
  {
    border: "border-emerald-400/50",
    badge: "bg-emerald-500/15 text-emerald-200",
    title: "text-emerald-100",
    bg: "bg-emerald-500/5",
  },
  {
    border: "border-amber-400/50",
    badge: "bg-amber-500/15 text-amber-200",
    title: "text-amber-100",
    bg: "bg-amber-500/5",
  },
  {
    border: "border-fuchsia-400/50",
    badge: "bg-fuchsia-500/15 text-fuchsia-200",
    title: "text-fuchsia-100",
    bg: "bg-fuchsia-500/5",
  },
];

function TypingDots() {
  return (
    <div className="flex items-center gap-1">
      <span
        className="h-2 w-2 rounded-full bg-dark/50 dark:bg-white/60 animate-pulse"
        style={{ animationDelay: "0ms" }}
      />
      <span
        className="h-2 w-2 rounded-full bg-dark/50 dark:bg-white/60 animate-pulse"
        style={{ animationDelay: "180ms" }}
      />
      <span
        className="h-2 w-2 rounded-full bg-dark/50 dark:bg-white/60 animate-pulse"
        style={{ animationDelay: "360ms" }}
      />
    </div>
  );
}

function formatUsageValue(value?: number | null) {
  return typeof value === "number" && Number.isFinite(value)
    ? value.toLocaleString("it-IT")
    : "n/d";
}

function summarizeStepOutput(step: LlmTraceStep) {
  const raw = String(step.rawResponse ?? step.error ?? "").trim();
  if (!raw) return "Nessun output";
  return raw.length > 220 ? `${raw.slice(0, 220).trim()}...` : raw;
}

function sumTraceTokens(
  steps: Array<{
    usage?: {
      inputTokens?: number | null;
      outputTokens?: number | null;
      totalTokens?: number | null;
    } | null;
  }>,
) {
  return steps.reduce(
    (acc, step) => ({
      input:
        acc.input +
        (typeof step.usage?.inputTokens === "number" ? step.usage.inputTokens : 0),
      output:
        acc.output +
        (typeof step.usage?.outputTokens === "number"
          ? step.usage.outputTokens
          : 0),
      total:
        acc.total +
        (typeof step.usage?.totalTokens === "number" ? step.usage.totalTokens : 0),
    }),
    { input: 0, output: 0, total: 0 },
  );
}

export default function AnimaLab() {
  const [sessionId, setSessionId] = useState(
    () => globalThis.crypto?.randomUUID?.() ?? `anima-lab-${Date.now()}`,
  );
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [debug, setDebug] = useState<DebugPayload>({ status: "idle" });
  const [debugMode, setDebugMode] = useState(false);
  const [transcriptPreview, setTranscriptPreview] = useState("");
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingError, setRecordingError] = useState("");
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isResettingMemory, setIsResettingMemory] = useState(false);
  const [conversationTokenTotal, setConversationTokenTotal] = useState(0);
  const [idleSuggestionIndex, setIdleSuggestionIndex] = useState(0);
  const [showIdleSuggestions, setShowIdleSuggestions] = useState(false);
  const [lastInteractionAt, setLastInteractionAt] = useState(() => Date.now());
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<number | null>(null);

  const canSend =
    message.trim().length > 0 && debug.status !== "loading" && !isTranscribing;
  const canRecord =
    typeof window !== "undefined" &&
    typeof MediaRecorder !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia;

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        window.clearInterval(recordingTimerRef.current);
      }
      if (mediaRecorderRef.current?.state !== "inactive") {
        mediaRecorderRef.current?.stop();
      }
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (
        debug.status === "loading" ||
        isRecording ||
        isTranscribing ||
        Date.now() - lastInteractionAt < IDLE_SUGGESTION_DELAY_MS
      ) {
        return;
      }
      setShowIdleSuggestions(true);
      setIdleSuggestionIndex(
        (prev) => (prev + SUGGESTION_BATCH_SIZE) % SUGGESTIONS.length,
      );
    }, IDLE_SUGGESTION_DELAY_MS);

    return () => window.clearInterval(intervalId);
  }, [debug.status, isRecording, isTranscribing, lastInteractionAt]);

  function markInteraction() {
    setLastInteractionAt(Date.now());
    setShowIdleSuggestions(false);
  }

  function resetRecordedAudio() {
    setRecordingSeconds(0);
  }

  async function transcribeAudioToDraft(file: File) {
    setIsTranscribing(true);
    setDebug((prev) => ({
      status: "loading",
      request: { message: `[audio] ${file.name}` },
      response: prev.response,
    }));

    try {
      const formData = new FormData();
      formData.append("audio", file);

      const res = await fetch("/api/anima/transcribe", {
        method: "POST",
        body: formData,
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.message || `HTTP_${res.status}`);
      }

      const transcript = String(data?.text ?? "").trim();
      if (!transcript) {
        throw new Error("Trascrizione vuota");
      }

      setTranscriptPreview(transcript);
      setMessage(transcript);
      setDebug({
        status: "success",
        request: { message: `[audio] ${file.name}` },
        response: {
          transcript,
          mode: "draft_only",
        },
      });
    } catch (error: any) {
      const errorText = String(error?.message ?? error ?? "Errore sconosciuto");
      setDebug({
        status: "error",
        request: { message: `[audio] ${file.name}` },
        error: errorText,
      });
      setMessages((prev) => [
        ...prev,
        {
          id: `e-audio-${Date.now()}`,
          role: "assistant",
          text: `Errore trascrizione: ${errorText}`,
        },
      ]);
    } finally {
      setIsTranscribing(false);
      resetRecordedAudio();
    }
  }

  async function startRecording() {
    if (
      !canRecord ||
      isRecording ||
      isTranscribing ||
      debug.status === "loading"
    ) {
      return;
    }

    try {
      markInteraction();
      setRecordingError("");
      resetRecordedAudio();

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      recordingChunksRef.current = [];

      const preferredMimeTypes = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
      ];
      const supportedMimeType = preferredMimeTypes.find((mimeType) =>
        MediaRecorder.isTypeSupported?.(mimeType),
      );
      const recorder = supportedMimeType
        ? new MediaRecorder(stream, { mimeType: supportedMimeType })
        : new MediaRecorder(stream);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordingChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(recordingChunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        const extension = blob.type.includes("mp4") ? "m4a" : "webm";
        const nextFile = new File(
          [blob],
          `anima-voice-${Date.now()}.${extension}`,
          {
            type: blob.type,
          },
        );
        setIsRecording(false);

        if (recordingTimerRef.current) {
          window.clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }

        mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
        void transcribeAudioToDraft(nextFile);
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = window.setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (error: any) {
      setRecordingError(
        String(
          error?.message ?? error ?? "Registrazione audio non disponibile",
        ),
      );
      setIsRecording(false);
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
  }

  function stopRecording() {
    if (
      !mediaRecorderRef.current ||
      mediaRecorderRef.current.state === "inactive"
    ) {
      return;
    }
    markInteraction();
    mediaRecorderRef.current.stop();
  }

  function formatRecordingTime(seconds: number) {
    const minutes = Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0");
    const remainingSeconds = (seconds % 60).toString().padStart(2, "0");
    return `${minutes}:${remainingSeconds}`;
  }

  function buildRecentTurns(history: ChatMessage[]): RecentTurn[] {
    return history.slice(-4).map((item) => ({
      role: item.role,
      text: item.text,
    }));
  }

  async function resetMemory() {
    if (isResettingMemory) return;

    setIsResettingMemory(true);
    try {
      await fetch("/api/anima/session/reset", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sessionId }),
      });
    } finally {
      setMessages([]);
      setDebug({ status: "idle" });
      setMessage("");
      resetRecordedAudio();
      setTranscriptPreview("");
      setRecordingError("");
      setConversationTokenTotal(0);
      setSessionId(
        globalThis.crypto?.randomUUID?.() ?? `anima-lab-${Date.now()}`,
      );
      setIsResettingMemory(false);
    }
  }

  async function sendMessage(rawMessage: string) {
    const trimmed = rawMessage.trim();
    if (!trimmed) return;
    markInteraction();

    const userMessage: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      text: trimmed,
    };

    const recentTurns = buildRecentTurns(messages);
    setMessages((prev) => [...prev, userMessage]);
    setDebug((prev) => ({
      status: "loading",
      request: { message: trimmed },
      response: prev.response,
    }));
    setMessage("");

    try {
      const res = await fetch("/api/anima/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: trimmed,
          sessionId,
          recentTurns,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.message || `HTTP_${res.status}`);
      }

      const assistantMessage: ChatMessage = {
        id: `a-${Date.now()}`,
        role: "assistant",
        text: String(data?.reply?.text ?? "").trim() || "Nessuna risposta.",
      };
      const turnTokenTotals = sumTraceTokens(data?.reply?.meta?.debug?.llmTrace ?? []);

      setMessages((prev) => [...prev, assistantMessage]);
      setConversationTokenTotal((prev) => prev + turnTokenTotals.total);
      setDebug({
        status: "success",
        request: { message: trimmed },
        response: data,
      });
    } catch (error: any) {
      const errorText = String(error?.message ?? error ?? "Errore sconosciuto");

      setMessages((prev) => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          role: "assistant",
          text: `Errore: ${errorText}`,
        },
      ]);
      setDebug({
        status: "error",
        request: { message: trimmed },
        error: errorText,
      });
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage(message);
  }

  const debugText = useMemo(() => JSON.stringify(debug, null, 2), [debug]);
  const llmTrace = useMemo<LlmTraceStep[]>(
    () => debug.response?.meta?.debug?.llmTrace ?? [],
    [debug.response],
  );
  const finalReply = debug.response?.reply?.text
    ? String(debug.response.reply.text)
    : "";
  const displayTrace = useMemo<DisplayTraceStep[]>(() => {
    const baseTrace: DisplayTraceStep[] = [...llmTrace];
    const finalDebug = debug.response?.meta?.debug;
    const responseComposerUsed = finalDebug?.responseComposerUsed === true;
    const hasAgenticResponderStep = baseTrace.some(
      (step) => step.step === "responseComposer.finalResponse",
    );

    if (responseComposerUsed && !hasAgenticResponderStep) {
      baseTrace.push({
        id: `synthetic-final-response-${Date.now()}`,
        step: "responseComposer.finalResponse",
        title: "Risponditore agentico finale",
        reason:
          "Step sintetico aggiunto dalla UI: il meta debug conferma che il composer finale e stato usato.",
        provider: "groq",
        model: null,
        purpose:
          "Rendere visibile il passaggio finale del risponditore agentico",
        systemPrompt: "Synthetic UI step",
        input: {
          responseComposerUsed: true,
          staticFallbackText: finalDebug?.staticFallbackText ?? null,
        },
        rawResponse: finalReply || null,
        parsedResponse: {
          text: finalReply || null,
          source: "meta.debug.responseComposerUsed",
        },
        status: "success",
        error: null,
        isSynthetic: true,
      });
    }

    return baseTrace;
  }, [debug.response, finalReply, llmTrace]);
  const quickTrace = useMemo(
    () =>
      displayTrace.map((step) => ({
        id: step.id,
        node: step.title,
        stepId: step.step,
        model: step.model || "n/a",
        provider: step.provider,
        usage: step.usage ?? null,
        status: step.status,
        output: summarizeStepOutput(step),
      })),
    [displayTrace],
  );
  const turnTokenTotals = useMemo(() => sumTraceTokens(displayTrace), [displayTrace]);
  const idleSuggestions = useMemo(() => {
    if (!SUGGESTIONS.length) return [];
    return Array.from(
      { length: Math.min(SUGGESTION_BATCH_SIZE, SUGGESTIONS.length) },
      (_, offset) => SUGGESTIONS[(idleSuggestionIndex + offset) % SUGGESTIONS.length],
    );
  }, [idleSuggestionIndex]);
  const inputPanel = (
    <>
      <div className="min-w-0 rounded-2xl border border-stroke bg-gray-1 p-3 dark:border-dark-3 dark:bg-dark">
        <div className="mb-2 text-sm font-semibold text-dark dark:text-white">
          Messaggio vocale
        </div>
        <p className="mb-3 text-xs text-dark-5 dark:text-dark-6">
          Registra un vocale rapido, poi lo trascriviamo e lo usiamo come
          prompt testuale.
        </p>
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between xl:flex-col xl:items-stretch">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                if (isRecording) {
                  stopRecording();
                  return;
                }
                void startRecording();
              }}
              disabled={!canRecord || isTranscribing || debug.status === "loading"}
              className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50 ${
                isRecording
                  ? "bg-red-500 hover:bg-red-400"
                  : "bg-primary hover:opacity-90"
              }`}
            >
              {isRecording ? "Stop" : "Rec"}
            </button>
            <div className="min-w-0">
              <div className="text-sm font-medium text-dark dark:text-white">
                {isRecording
                  ? "Sto registrando..."
                  : isTranscribing
                    ? "Sto trascrivendo..."
                    : transcriptPreview
                      ? "Trascrizione pronta"
                      : "Tocca per registrare"}
              </div>
              <div className="text-xs text-dark-5 dark:text-dark-6">
                {isRecording
                  ? `Durata ${formatRecordingTime(recordingSeconds)}`
                  : isTranscribing
                    ? "Sto preparando una bozza modificabile del testo."
                    : canRecord
                      ? "Quando finisci di registrare, la trascrizione entra nel box testo e la puoi correggere prima di inviarla."
                      : "Questo browser non supporta la registrazione audio."}
              </div>
            </div>
          </div>
          {transcriptPreview ? (
            <button
              type="button"
              onClick={() => {
                markInteraction();
                setTranscriptPreview("");
              }}
              className="rounded-xl border border-stroke px-3 py-2 text-sm text-dark transition hover:bg-white dark:border-dark-3 dark:text-white dark:hover:bg-dark-2"
            >
              Pulisci bozza
            </button>
          ) : null}
        </div>
        {recordingError ? (
          <div className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-500/10 dark:text-red-200">
            {recordingError}
          </div>
        ) : null}
        {transcriptPreview ? (
          <div className="mt-2 rounded-xl bg-white/70 p-2 text-xs text-dark dark:bg-dark-2 dark:text-dark-6">
            Bozza trascritta pronta per essere modificata prima dell&apos;invio.
          </div>
        ) : null}
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <textarea
          value={message}
          onChange={(event) => {
            markInteraction();
            setMessage(event.target.value);
          }}
          placeholder="Scrivi un messaggio di test..."
          rows={debugMode ? 3 : 7}
          className="w-full min-w-0 rounded-xl border border-stroke bg-white px-4 py-3 text-sm text-dark outline-none transition focus:border-primary dark:border-dark-3 dark:bg-dark dark:text-white"
        />
        <button
          type="submit"
          disabled={!canSend}
          className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Invia
        </button>
      </form>
    </>
  );

  return (
    <div
      className={`grid min-w-0 gap-6 ${
        debugMode
          ? "xl:grid-cols-[minmax(0,1.5fr),minmax(320px,0.9fr)]"
          : "grid-cols-1"
      }`}
    >
      <section className="min-w-0 overflow-hidden rounded-2xl border border-stroke bg-white p-4 shadow-sm dark:border-dark-3 dark:bg-dark-2">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-dark dark:text-white">
              Anima Lab
            </h2>
            <p className="text-sm text-dark-5 dark:text-dark-6">
              Chat minimale per provare il core di Anima dentro Atlas.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 rounded-lg border border-stroke px-3 py-2 text-sm text-dark transition dark:border-dark-3 dark:text-white">
              <span className="font-medium">Debug mode</span>
              <button
                type="button"
                role="switch"
                aria-checked={debugMode}
                onClick={() => setDebugMode((prev) => !prev)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                  debugMode ? "bg-primary" : "bg-gray-3 dark:bg-dark-3"
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                    debugMode ? "translate-x-5" : "translate-x-1"
                  }`}
                />
              </button>
            </label>
            <button
              type="button"
              onClick={() => void resetMemory()}
              disabled={isResettingMemory}
              className="rounded-lg border border-primary/30 px-3 py-2 text-sm text-primary transition hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isResettingMemory ? "Resetto..." : "Reset memoria"}
            </button>
            <button
              type="button"
              onClick={() => {
                markInteraction();
                setMessages([]);
                setDebug({ status: "idle" });
                setMessage("");
                resetRecordedAudio();
                setTranscriptPreview("");
                setRecordingError("");
                setConversationTokenTotal(0);
                setSessionId(
                  globalThis.crypto?.randomUUID?.() ?? `anima-lab-${Date.now()}`,
                );
              }}
              className="rounded-lg border border-stroke px-3 py-2 text-sm text-dark transition hover:bg-gray-2 dark:border-dark-3 dark:text-white dark:hover:bg-dark-3"
            >
              Pulisci
            </button>
          </div>
        </div>

        <div className={debugMode ? "" : "xl:grid xl:grid-cols-[minmax(0,1fr),360px] xl:items-start xl:gap-4"}>
          <div>
        <div className="min-h-[420px] min-w-0 space-y-3 overflow-x-hidden rounded-2xl border border-dashed border-stroke bg-gray-1 p-3 dark:border-dark-3 dark:bg-dark">
          {messages.length === 0 ? (
            <div className="rounded-xl bg-white/70 p-3 text-sm text-dark-5 dark:bg-dark-2 dark:text-dark-6">
              Nessun messaggio ancora. Usa uno dei test rapidi oppure scrivi una
              richiesta.
            </div>
          ) : (
            messages.map((item) => (
              <div
                key={item.id}
                className={
                  item.role === "user"
                    ? "ml-auto w-fit min-w-0 max-w-[85%] rounded-2xl bg-primary px-4 py-3 text-sm text-white sm:max-w-[80%]"
                    : "w-fit min-w-0 max-w-[85%] rounded-2xl bg-white px-4 py-3 text-sm text-dark shadow-sm dark:bg-dark-2 dark:text-dark-6 sm:max-w-[80%]"
                }
              >
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide opacity-70">
                  {item.role === "user" ? "Tu" : "Anima"}
                </div>
                <div className="whitespace-pre-wrap break-words">
                  {item.text}
                </div>
              </div>
            ))
          )}
          {debug.status === "loading" ? (
            <div className="w-fit min-w-0 max-w-[85%] rounded-2xl bg-white px-4 py-3 text-sm text-dark shadow-sm dark:bg-dark-2 dark:text-dark-6 sm:max-w-[80%]">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide opacity-70">
                Anima
              </div>
              <div className="flex items-center gap-3">
                <TypingDots />
                <span className="text-xs text-dark-5 dark:text-dark-6">
                  Sta elaborando...
                </span>
              </div>
            </div>
          ) : null}
        </div>
        {showIdleSuggestions && idleSuggestions.length > 0 ? (
          <div className="mt-4 rounded-2xl border border-primary/20 bg-primary/5 p-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary">
              Suggerimenti rapidi
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {idleSuggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => void sendMessage(suggestion)}
                  className="rounded-2xl border border-stroke bg-white px-4 py-3 text-left text-sm text-dark transition hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/5 dark:border-dark-3 dark:bg-dark-2 dark:text-white dark:hover:bg-dark"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {debugMode ? <div className="mt-4">{inputPanel}</div> : null}
          </div>
          {!debugMode ? (
            <aside className="mt-4 space-y-4 xl:sticky xl:top-4 xl:mt-0">
              {inputPanel}
            </aside>
          ) : null}
        </div>
      </section>

      {debugMode ? (
        <aside className="min-w-0 overflow-hidden rounded-2xl border border-stroke bg-white p-4 shadow-sm dark:border-dark-3 dark:bg-dark-2">
        <h3 className="mb-2 text-base font-semibold text-dark dark:text-white">
          Traccia turno
        </h3>
        <p className="mb-3 text-sm text-dark-5 dark:text-dark-6">
          Vista step-by-step dei passaggi LLM del turno corrente, con contesto
          inviato e output ricevuto.
        </p>

        <div className="mb-3 rounded-xl bg-gray-1 px-3 py-2 text-xs text-dark dark:bg-dark dark:text-dark-6">
          Stato: <strong>{debug.status}</strong>
        </div>

        <div className="space-y-3">
          <section className="rounded-2xl border border-primary/25 bg-primary/5 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div>
                <div className="text-sm font-semibold text-primary">
                  Debug rapido
                </div>
                <div className="text-xs text-dark-5 dark:text-dark-6">
                  Nodo, modello, token e output del turno piu recente.
                </div>
              </div>
              {debug.status === "loading" ? (
                <span className="inline-flex items-center gap-2 rounded-full bg-amber-500/15 px-2 py-1 text-[11px] font-semibold text-amber-200">
                  <TypingDots />
                  In esecuzione
                </span>
              ) : null}
            </div>

            {debug.request?.message ? (
              <div className="mb-3 rounded-xl bg-white/70 px-3 py-2 text-xs text-dark dark:bg-dark dark:text-dark-6">
                <strong>Turno corrente:</strong> {debug.request.message}
              </div>
            ) : null}

            <div className="mb-3 grid gap-2 sm:grid-cols-2">
              <div className="rounded-xl border border-stroke bg-white/70 px-3 py-3 dark:border-dark-3 dark:bg-dark">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                  Token turno
                </div>
                <div className="mt-1 text-lg font-semibold text-dark dark:text-white">
                  {formatUsageValue(turnTokenTotals.total)}
                </div>
                <div className="mt-1 text-[11px] text-dark-5 dark:text-dark-6">
                  Input {formatUsageValue(turnTokenTotals.input)} | Output{" "}
                  {formatUsageValue(turnTokenTotals.output)}
                </div>
              </div>
              <div className="rounded-xl border border-stroke bg-white/70 px-3 py-3 dark:border-dark-3 dark:bg-dark">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                  Token conversazione
                </div>
                <div className="mt-1 text-lg font-semibold text-dark dark:text-white">
                  {formatUsageValue(conversationTokenTotal)}
                </div>
                <div className="mt-1 text-[11px] text-dark-5 dark:text-dark-6">
                  Cumulati nella sessione corrente
                </div>
              </div>
            </div>

            {quickTrace.length > 0 ? (
              <div className="space-y-3">
                {quickTrace.map((step, index) => (
                  <div
                    key={step.id}
                    className="rounded-2xl border border-stroke bg-white px-4 py-4 shadow-sm dark:border-dark-3 dark:bg-dark"
                  >
                    <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-dark dark:text-white">
                        {index + 1}. {step.node}
                        </div>
                        <div className="mt-1 break-all text-[11px] text-dark-5 dark:text-dark-6">
                          <strong>Nodo:</strong> {step.stepId} | <strong>Modello:</strong>{" "}
                          {step.provider}/{step.model}
                        </div>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold ${
                          step.status === "success"
                            ? "bg-emerald-500/15 text-emerald-200"
                            : "bg-red-500/15 text-red-200"
                        }`}
                      >
                        {step.status}
                      </span>
                    </div>
                    <div className="mb-3 grid gap-2 text-[11px] text-dark-5 dark:text-dark-6 sm:grid-cols-3">
                      <div className="rounded-xl bg-gray-1 px-3 py-2 dark:bg-dark-2">
                        <div className="font-semibold text-primary">Input</div>
                        <div className="mt-1 text-sm font-semibold text-dark dark:text-white">
                          {formatUsageValue(step.usage?.inputTokens)}
                        </div>
                      </div>
                      <div className="rounded-xl bg-gray-1 px-3 py-2 dark:bg-dark-2">
                        <div className="font-semibold text-primary">Output</div>
                        <div className="mt-1 text-sm font-semibold text-dark dark:text-white">
                          {formatUsageValue(step.usage?.outputTokens)}
                        </div>
                      </div>
                      <div className="rounded-xl bg-gray-1 px-3 py-2 dark:bg-dark-2">
                        <div className="font-semibold text-primary">Totale</div>
                        <div className="mt-1 text-sm font-semibold text-dark dark:text-white">
                          {formatUsageValue(step.usage?.totalTokens)}
                        </div>
                      </div>
                    </div>
                    <div className="overflow-hidden rounded-xl bg-black/85 px-3 py-3 text-[11px] leading-6 text-green-200">
                      {step.output}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-stroke bg-white/70 px-3 py-3 text-sm text-dark-5 dark:border-dark-3 dark:bg-dark dark:text-dark-6">
                Nessuno step LLM disponibile per questo turno.
              </div>
            )}
          </section>

          {debug.request?.message ? (
            <section className="rounded-2xl border border-stroke bg-gray-1 p-3 dark:border-dark-3 dark:bg-dark">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="text-sm font-semibold text-dark dark:text-white">
                  Input utente
                </div>
                <span className="rounded-full bg-primary/15 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-primary">
                  Request
                </span>
              </div>
              <div className="whitespace-pre-wrap break-words text-sm text-dark dark:text-dark-6">
                {debug.request.message}
              </div>
            </section>
          ) : null}

          {displayTrace.length > 0 ? (
            displayTrace.map((step, index) => {
              const palette =
                TRACE_CARD_STYLES[index % TRACE_CARD_STYLES.length];
              const isAgenticResponder =
                step.step === "responseComposer.finalResponse";
              return (
                <section
                  key={step.id}
                  className={`rounded-2xl border p-3 ${palette.border} ${palette.bg}`}
                >
                  <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className={`text-sm font-semibold ${palette.title}`}>
                        {index + 1}.{" "}
                        {isAgenticResponder
                          ? "Risponditore agentico finale"
                          : step.title}
                      </div>
                      <div className="mt-1 text-xs text-dark-5 dark:text-dark-6">
                        {step.reason}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span
                        className={`rounded-full px-2 py-1 text-[11px] font-semibold ${palette.badge}`}
                      >
                        {step.provider}
                      </span>
                      {isAgenticResponder ? (
                        <span className="rounded-full bg-primary/15 px-2 py-1 text-[11px] font-semibold text-primary">
                          agentic responder
                        </span>
                      ) : null}
                      {step.isSynthetic ? (
                        <span className="rounded-full bg-white/10 px-2 py-1 text-[11px] font-semibold text-white/80">
                          synthetic
                        </span>
                      ) : null}
                      <span
                        className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                          step.status === "success"
                            ? "bg-emerald-500/15 text-emerald-200"
                            : "bg-red-500/15 text-red-200"
                        }`}
                      >
                        {step.status}
                      </span>
                    </div>
                  </div>

                  <div className="mb-3 rounded-xl bg-black/25 px-3 py-2 text-[11px] text-white/80">
                    <strong>Step:</strong> {step.step} | <strong>Model:</strong>{" "}
                    {step.model || "n/a"}
                    {step.purpose ? (
                      <>
                        {" "}
                        | <strong>Purpose:</strong> {step.purpose}
                      </>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <details
                      className="rounded-xl bg-black/20 p-2 text-xs text-white/85"
                      open={index === 0}
                    >
                      <summary className="cursor-pointer font-semibold">
                        Context inviato
                      </summary>
                      <pre className="mt-2 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-black/30 p-2 text-[11px] leading-5">
                        {JSON.stringify(step.input, null, 2)}
                      </pre>
                    </details>

                    <details className="rounded-xl bg-black/20 p-2 text-xs text-white/85">
                      <summary className="cursor-pointer font-semibold">
                        System prompt
                      </summary>
                      <pre className="mt-2 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-black/30 p-2 text-[11px] leading-5">
                        {step.systemPrompt}
                      </pre>
                    </details>

                    <details
                      className="rounded-xl bg-black/20 p-2 text-xs text-white/85"
                      open
                    >
                      <summary className="cursor-pointer font-semibold">
                        Risposta raw del modello
                      </summary>
                      <pre className="mt-2 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-black/30 p-2 text-[11px] leading-5">
                        {step.rawResponse ||
                          step.error ||
                          "Nessuna risposta raw"}
                      </pre>
                    </details>

                    {typeof step.parsedResponse !== "undefined" ? (
                      <details className="rounded-xl bg-black/20 p-2 text-xs text-white/85">
                        <summary className="cursor-pointer font-semibold">
                          Output interpretato
                        </summary>
                        <pre className="mt-2 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-black/30 p-2 text-[11px] leading-5">
                          {JSON.stringify(step.parsedResponse, null, 2)}
                        </pre>
                      </details>
                    ) : null}
                  </div>
                </section>
              );
            })
          ) : (
            <section className="rounded-2xl border border-dashed border-stroke bg-gray-1 p-3 text-sm text-dark-5 dark:border-dark-3 dark:bg-dark dark:text-dark-6">
              In questo turno non e stato chiamato nessun LLM, oppure la
              richiesta e stata gestita in modo deterministico.
            </section>
          )}

          {finalReply ? (
            <section className="rounded-2xl border border-primary/40 bg-primary/10 p-3">
              <div className="mb-2 text-sm font-semibold text-primary">
                Risposta finale
              </div>
              <div className="whitespace-pre-wrap break-words text-sm text-dark dark:text-white">
                {finalReply}
              </div>
            </section>
          ) : null}

          <details className="rounded-2xl border border-stroke bg-gray-1 p-3 dark:border-dark-3 dark:bg-dark">
            <summary className="cursor-pointer text-sm font-semibold text-dark dark:text-white">
              Raw debug completo
            </summary>
            <pre className="mt-3 max-h-[520px] min-w-0 overflow-auto rounded-xl bg-dark px-3 py-3 text-xs leading-5 text-green-200">
              {debugText}
            </pre>
          </details>
        </div>
        </aside>
      ) : null}
    </div>
  );
}
