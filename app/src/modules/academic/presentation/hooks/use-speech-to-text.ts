import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

// The Web Speech API has no official TS lib entry — this is the minimal
// shape this hook actually touches, kept local instead of polluting global types.
interface SpeechRecognitionResultLike {
    isFinal: boolean;
    0: { transcript: string };
}

interface SpeechRecognitionEventLike {
    resultIndex: number;
    results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionErrorEventLike {
    error: string;
}

interface SpeechRecognitionLike {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    onaudioend: (() => void) | null;
    onend: (() => void) | null;
    onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
    onresult: ((event: SpeechRecognitionEventLike) => void) | null;
    start: () => void;
    stop: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
    const globalWindow = window as unknown as { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor };
    return globalWindow.SpeechRecognition || globalWindow.webkitSpeechRecognition || null;
}

export type SpeechToTextErrorReason = 'not-supported' | 'permission-denied' | 'no-speech' | 'network' | 'unknown';

export function useSpeechToText({ lang = 'pt-BR', onFinalTranscript }: { lang?: string; onFinalTranscript: (transcript: string) => void }) {
    const [isListening, setIsListening] = useState(false);
    const [interimText, setInterimText] = useState('');
    const [errorReason, setErrorReason] = useState<SpeechToTextErrorReason | null>(null);
    const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
    const finalTranscriptRef = useRef('');
    const onFinalTranscriptRef = useRef(onFinalTranscript);
    onFinalTranscriptRef.current = onFinalTranscript;

    const isSupported = getSpeechRecognitionConstructor() !== null;

    useEffect(() => () => {
        recognitionRef.current?.stop();
    }, []);

    const mapError = (code: string): SpeechToTextErrorReason => {
        if (code === 'not-allowed' || code === 'service-not-allowed') return 'permission-denied';
        if (code === 'no-speech') return 'no-speech';
        if (code === 'network') return 'network';
        return 'unknown';
    };

    const start = useCallback(() => {
        setErrorReason(null);

        const Recognition = getSpeechRecognitionConstructor();
        if (!Recognition) {
            setErrorReason('not-supported');
            return;
        }

        finalTranscriptRef.current = '';
        setInterimText('');

        const recognition = new Recognition();
        recognition.lang = lang;
        recognition.continuous = true;
        recognition.interimResults = true;

        recognition.onresult = (event) => {
            let interim = '';
            for (let index = event.resultIndex; index < event.results.length; index += 1) {
                const result = event.results[index];
                if (!result) continue;
                const transcript = result[0]?.transcript ?? '';
                if (result.isFinal) {
                    finalTranscriptRef.current = `${finalTranscriptRef.current} ${transcript}`.trim();
                } else {
                    interim += transcript;
                }
            }
            setInterimText(interim);
        };

        recognition.onerror = (event) => {
            setErrorReason(mapError(event.error));
        };

        recognition.onend = () => {
            setIsListening(false);
            setInterimText('');
            recognitionRef.current = null;
            const finalText = finalTranscriptRef.current.trim();
            finalTranscriptRef.current = '';
            if (finalText) {
                onFinalTranscriptRef.current(finalText);
            }
        };

        try {
            recognition.start();
            recognitionRef.current = recognition;
            setIsListening(true);
        } catch {
            setErrorReason('unknown');
        }
    }, [lang]);

    const stop = useCallback(() => {
        recognitionRef.current?.stop();
    }, []);

    const toggle = useCallback(() => {
        if (isListening) {
            stop();
        } else {
            start();
        }
    }, [isListening, start, stop]);

    return { errorReason, interimText, isListening, isSupported, start, stop, toggle };
}
