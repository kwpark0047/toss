import { useEffect, useRef, useState } from 'react';
import api from '../api/client';
import { LiveClient } from '../utils/live/LiveClient';
import { LiveAudio } from '../utils/live/LiveAudio';

// P0 opt-in engine: existing VoiceOrderAssistant/MP3/TTS remain untouched.
export function useAILiveSession({ onFallback, onDraft, onManagerFacts } = {}) {
  const [state, setState] = useState('IDLE');
  const [transcript, setTranscript] = useState({ input: '', output: '' });
  const [cameraAllowed, setCameraAllowed] = useState(false),
    [cameraError, setCameraError] = useState('');
  const [sessionId, setSessionId] = useState(null);
  const callbacks = useRef({ onFallback, onDraft, onManagerFacts });
  useEffect(() => {
    callbacks.current = { onFallback, onDraft, onManagerFacts };
  }, [onFallback, onDraft, onManagerFacts]);
  const engine = useRef(null);
  const stop = () => {
    setCameraAllowed(false);
    setSessionId(null);
    engine.current?.client.stop();
    engine.current?.audio.stop();
    engine.current = null;
  };
  useEffect(() => {
    const hide = () => {
      engine.current?.client.stop();
      engine.current?.audio.stop();
      engine.current = null;
    };
    window.addEventListener('pagehide', hide);
    window.addEventListener('wm:ai-live-stop', hide);
    return () => {
      window.removeEventListener('pagehide', hide);
      window.removeEventListener('wm:ai-live-stop', hide);
      hide();
    };
  }, []);
  const start = async (options) => {
    if (engine.current) return;
    window.dispatchEvent(new Event('wm:ai-live-stop'));
    setTranscript({ input: '', output: '' });
    setCameraAllowed(false);
    setCameraError('');
    const audio = new LiveAudio();
    const url = new URL(
      '/api/ai/live/connect',
      new URL(api.defaults.baseURL || '/api', window.location.origin)
    );
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    const client = new LiveClient({
      url: url.href,
      beforeConnect: () =>
        audio.start((data) => {
          if (!audio.muted) client.send('audio', { data });
        }),
      issue: async (body, key) => {
        const response = await api.post('/ai/live/session', body, {
          headers: { 'Idempotency-Key': key },
        });
        const session = response.data || response;
        if (engine.current?.client === client) {
          setCameraAllowed(session.cameraAllowed === true);
          setSessionId(session.sessionId);
        }
        return session;
      },
      onFallback: () => {
        if (engine.current?.client !== client) return;
        audio.stop();
        engine.current = null;
        callbacks.current.onFallback?.();
      },
      onEvent: (event) => {
        if (engine.current?.client !== client) return;
        if (event.type === 'state') {
          setState(event.state);
          window.dispatchEvent(
            new CustomEvent('wm:ai-live-state', { detail: { state: event.state } })
          );
        }
        if (event.type === 'draft') callbacks.current.onDraft?.(event.draft);
        if (event.type === 'draftInvalidated') callbacks.current.onDraft?.(null);
        if (event.type === 'managerFacts') callbacks.current.onManagerFacts?.(event);
        if (event.type === 'cameraState' && event.error) setCameraError(event.error);
        if (event.type === 'transcript')
          setTranscript((previous) => ({
            ...previous,
            [event.direction === 'inputTranscription' ? 'input' : 'output']: (
              previous[event.direction === 'inputTranscription' ? 'input' : 'output'] +
              String(event.text || '')
            ).slice(-2000),
          }));
        if (event.type === 'interrupted') {
          audio.interrupt();
          setState('INTERRUPTED');
        }
        if (event.type === 'audio') {
          try {
            audio.play(event.data);
            setState('SPEAKING');
          } catch {
            client.fallback();
          }
        }
      },
    });
    engine.current = { client, audio };
    await client.start(options);
  };
  return {
    state,
    cameraAllowed,
    cameraError,
    sessionId,
    transcript,
    start,
    stop,
    sendText: (text) => engine.current?.client.send('text', { text }),
    setMuted: (muted) => engine.current?.audio.setMuted(muted),
    cameraConsent: (enabled) => {
      if (enabled) setCameraError('');
      return engine.current?.client.send('cameraConsent', { enabled }) === true;
    },
    sendImage: (data) => engine.current?.client.send('image', { data }) === true,
    invalidateDraft: () => engine.current?.client.invalidateDraft(),
    confirmDraft: (id, apply) => engine.current?.client.confirmDraft(id, apply) || false,
  };
}
