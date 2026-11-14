import { useEffect, useRef, useState } from 'react';
import { LiveCamera } from '../../utils/live/LiveCamera';
export default function LiveCameraHelper({ live }) {
  const [consent, setConsent] = useState(false),
    [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [preview, setPreview] = useState(''),
    [message, setMessage] = useState('');
  const camera = useRef(null),
    video = useRef(null),
    callbacks = useRef(live);
  useEffect(() => {
    callbacks.current = live;
  });
  const connected = !['IDLE', 'FALLBACK', 'ERROR', 'CONNECTING'].includes(live.state);
  useEffect(() => {
    const stop = () => {
      camera.current?.stop();
      callbacks.current.cameraConsent(false);
      setOpen(false);
      setBusy(false);
      setPreview('');
    };
    const hide = () => {
      if (document.visibilityState === 'hidden') stop();
    };
    document.addEventListener('visibilitychange', hide);
    window.addEventListener('pagehide', stop);
    return () => {
      document.removeEventListener('visibilitychange', hide);
      window.removeEventListener('pagehide', stop);
      camera.current?.stop();
      callbacks.current.cameraConsent(false);
    };
  }, []);
  useEffect(() => {
    if (!connected || live.cameraError) {
      camera.current?.stop();
      setOpen(false);
      setBusy(false);
      setPreview('');
    }
  }, [connected, live.cameraError]);
  const stop = () => {
    camera.current?.stop();
    live.cameraConsent(false);
    setOpen(false);
    setBusy(false);
    setPreview('');
  };
  const start = async () => {
    if (!consent || !live.cameraAllowed || !connected || busy) return;
    setBusy(true);
    setMessage('');
    camera.current ||= new LiveCamera();
    try {
      if (!live.cameraConsent(true)) throw Error('연결을 확인해 주세요.');
      const ready = await camera.current.start(video.current, true);
      if (ready) {
        setOpen(true);
        camera.current.stream?.getTracks().forEach((track) => {
          track.onended = () => {
            stop();
            setMessage('카메라를 중지했습니다. 음성·텍스트로 이어가세요.');
          };
        });
      }
    } catch {
      stop();
      setMessage('카메라를 사용할 수 없습니다. 음성·텍스트로 이어가세요.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <section
      aria-label="카메라 도우미"
      className="mt-4 space-y-2 rounded-xl border border-slate-300 p-3"
    >
      <h3 className="font-bold">카메라로 메뉴 살펴보기</h3>
      <p>
        자동 전송하지 않습니다. 사진 확인 후 직접 보내세요. 최대 초당 1장·대화당 30장, 320×240 JPEG
        16KB입니다. 사람·연락처·카드정보를 촬영하지 마세요.
      </p>
      <label className="flex items-start gap-2">
        <input
          type="checkbox"
          checked={consent}
          className="mt-1 h-5 w-5 shrink-0"
          onChange={(e) => {
            setConsent(e.target.checked);
            if (!e.target.checked) stop();
          }}
        />
        <span>
          카메라 접근과 선택한 사진의 Google AI 전송에 동의합니다. WEMARKET에는 사진을 저장하지
          않습니다.
        </span>
      </label>
      {!open && (
        <button
          type="button"
          disabled={!consent || !connected || !live.cameraAllowed || busy}
          className="min-h-11 rounded-xl border border-slate-300 px-3 disabled:opacity-50"
          onClick={start}
        >
          {busy ? '카메라 연결 중' : '카메라 켜기'}
        </button>
      )}
      {!live.cameraAllowed && (
        <p>이 연결에서는 카메라를 사용할 수 없습니다. 음성·텍스트 안내를 이용해 주세요.</p>
      )}
      <video
        ref={video}
        autoPlay
        muted
        playsInline
        hidden={!open}
        className="max-h-40 w-full rounded-lg object-contain"
        aria-label="카메라 미리보기"
      />
      {open && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="min-h-11 rounded-xl border px-3"
            onClick={() => {
              try {
                setPreview(camera.current.capture());
                setMessage('아직 전송하지 않았습니다.');
              } catch (e) {
                setMessage(e.message);
              }
            }}
          >
            사진 확인
          </button>
          <button type="button" className="min-h-11 rounded-xl border px-3" onClick={stop}>
            카메라 끄기
          </button>
        </div>
      )}
      {preview && (
        <>
          <img
            src={'data:image/jpeg;base64,' + preview}
            alt="전송 전 사진"
            className="max-h-40 w-full rounded-lg object-contain"
          />
          <button
            type="button"
            className="min-h-11 rounded-xl bg-amber-700 px-3 text-white"
            onClick={() => {
              try {
                camera.current.send(live.sendImage);
                setPreview('');
                setMessage(
                  '사진을 전송했습니다. 설명은 참고용이며 가격·품절·알레르기는 매장에 확인해 주세요.'
                );
              } catch (e) {
                setMessage(e.message);
              }
            }}
          >
            이 사진 전송
          </button>
        </>
      )}
      {(message || live.cameraError) && <p role="status">{live.cameraError || message}</p>}
    </section>
  );
}
