import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  apiRequest,
  connectRealtime,
  sendSignal,
  getCall,
  getCallConfig,
  acceptCall,
  rejectCall,
  endCall,
  readCache,
  writeCache,
} from "../lib/api";
import { useAuth } from "../context/AuthContext";

export function CallPage() {
  const { token, user } = useAuth();
  const [params] = useSearchParams();
  const callId = params.get("callId") || "";
  const incoming = params.get("incoming") === "1";
  const remote = useRef<HTMLVideoElement>(null);
  const local = useRef<HTMLVideoElement>(null);
  const pc = useRef<RTCPeerConnection | null>(null);
  const pendingIce = useRef<RTCIceCandidateInit[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const acceptedRef = useRef(!incoming);
  const otherIdRef = useRef("");

  const [call, setCall] = useState<any>(null);
  const [status, setStatus] = useState(incoming ? "مكالمة واردة" : "جاري الاتصال...");
  const [error, setError] = useState("");
  const [speaker, setSpeaker] = useState(false);
  const [accepted, setAccepted] = useState(!incoming);

  useEffect(() => {
    if (!token || !callId) return;
    let stop = () => {};
    let alive = true;

    const setupMedia = async (video: boolean) => {
      if (streamRef.current) return pc.current;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video });
      streamRef.current = stream;
      if (local.current) local.current.srcObject = stream;
      const iceConfig = await getCallConfig(token);
      const peer = new RTCPeerConnection({
        iceServers: iceConfig.iceServers || [{ urls: "stun:stun.l.google.com:19302" }],
      });
      pc.current = peer;
      stream.getTracks().forEach((t) => peer.addTrack(t, stream));
      peer.ontrack = (e) => {
        if (remote.current) {
          remote.current.srcObject = e.streams[0];
          void remote.current.play().catch(() => {});
        }
      };
      peer.onicecandidate = (e) => {
        if (e.candidate && otherIdRef.current) {
          void sendSignal(token, otherIdRef.current, "ice", {
            callId,
            candidate: e.candidate.toJSON(),
          });
        }
      };
      return peer;
    };

    void (async () => {
      try {
        const d = await getCall(token, callId);
        if (!alive) return;
        setCall(d.call);
        const c = d.call;
        const isCaller = c.caller_id === user?.id;
        otherIdRef.current = isCaller ? c.callee_id : c.caller_id;
        const video = c.kind === "video";
        if (c.status === "missed" || c.status === "rejected" || c.status === "ended") {
          setStatus(
            c.status === "missed"
              ? "مكالمة فائتة"
              : c.status === "rejected"
                ? "تم رفض المكالمة"
                : "انتهت المكالمة",
          );
          return;
        }
        stop = connectRealtime(token, async (e: any) => {
          if (!alive || e.type !== "call" || e.callId !== callId) return;
          try {
            if (e.kind === "accept" && !incoming) {
              await setupMedia(video);
              const peer = pc.current!;
              const offer = await peer.createOffer();
              await peer.setLocalDescription(offer);
              await sendSignal(token, otherIdRef.current, "offer", { callId, sdp: offer });
              setStatus("جاري الاتصال...");
            }
            if (e.kind === "reject") {
              setStatus("تم رفض المكالمة");
              setTimeout(() => {
                location.href = "/messages";
              }, 1200);
            }
            if (e.kind === "hangup") {
              setStatus("انتهت المكالمة");
              setTimeout(() => {
                location.href = "/messages";
              }, 700);
            }
            if (e.kind === "offer" && incoming && acceptedRef.current) {
              const peer = pc.current || (await setupMedia(video));
              if (!peer) throw new Error("PEER_NOT_READY");
              await peer.setRemoteDescription(e.payload?.sdp ?? e.sdp);
              for (const ice of pendingIce.current) await peer.addIceCandidate(ice);
              pendingIce.current = [];
              const answer = await peer.createAnswer();
              await peer.setLocalDescription(answer);
              await sendSignal(token, otherIdRef.current, "answer", { callId, sdp: answer });
              setStatus("متصل");
            }
            if (e.kind === "answer" && !incoming) {
              const peer = pc.current;
              if (peer) {
                await peer.setRemoteDescription(e.payload?.sdp ?? e.sdp);
                for (const ice of pendingIce.current) await peer.addIceCandidate(ice);
                pendingIce.current = [];
                setStatus("متصل");
              }
            }
            if (e.kind === "ice") {
              const raw = e.payload?.candidate ?? e.candidate;
              if (!raw) return;
              const candidate = new RTCIceCandidate(raw);
              if (pc.current?.remoteDescription) await pc.current.addIceCandidate(candidate);
              else pendingIce.current.push(candidate);
            }
          } catch {
            setError("تعذر إنشاء الاتصال الصوتي.");
          }
        });
        if (!incoming && c.status === "ringing") {
          await setupMedia(video);
        }
      } catch {
        if (alive) setError("تعذر تحميل المكالمة.");
      }
    })();

    return () => {
      alive = false;
      stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      pc.current?.close();
    };
  }, [token, callId, incoming, user?.id]);

  const doAccept = async () => {
    if (!token || !callId || !call) return;
    try {
      const video = call.kind === "video";
      if (!streamRef.current) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video });
        streamRef.current = stream;
        if (local.current) local.current.srcObject = stream;
        const iceConfig = await getCallConfig(token);
        const peer = new RTCPeerConnection({
          iceServers: iceConfig.iceServers || [{ urls: "stun:stun.l.google.com:19302" }],
        });
        pc.current = peer;
        stream.getTracks().forEach((t) => peer.addTrack(t, stream));
        peer.ontrack = (e) => {
          if (remote.current) {
            remote.current.srcObject = e.streams[0];
            void remote.current.play().catch(() => {});
          }
        };
        peer.onicecandidate = (e) => {
          if (e.candidate) {
            void sendSignal(token, call.caller_id, "ice", {
              callId,
              candidate: e.candidate.toJSON(),
            });
          }
        };
      }
      await acceptCall(token, callId);
      acceptedRef.current = true;
      setAccepted(true);
      setStatus("جاري الاتصال...");
    } catch {
      setError("تعذر تشغيل المايك.");
    }
  };

  const doReject = async () => {
    if (token && callId) {
      try {
        await rejectCall(token, callId);
      } catch {}
    }
    location.href = "/messages";
  };

  const hang = async () => {
    if (token && callId) {
      try {
        await endCall(token, callId);
      } catch {}
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    pc.current?.close();
    location.href = "/messages";
  };

  const toggleSpeaker = async () => {
    const el = remote.current as HTMLVideoElement & { setSinkId?: (id: string) => Promise<void> };
    if (el?.setSinkId) {
      try {
        await el.setSinkId("default");
        setSpeaker((v) => !v);
      } catch {
        setSpeaker((v) => !v);
      }
    } else {
      setSpeaker((v) => !v);
    }
  };

  return (
    <main className="call-page">
      <header className="call-top">
        <strong>{status}</strong>
        <span>{call?.display_name || call?.username || ""}</span>
      </header>
      {incoming && !accepted && call?.status === "ringing" ? (
        <div className="incoming-call-card">
          <div className="incoming-call-icon">📞</div>
          <h2>{call.display_name || call.username}</h2>
          <p>{call.kind === "video" ? "مكالمة فيديو واردة" : "مكالمة صوتية واردة"}</p>
          <div>
            <button className="accept-call" type="button" onClick={() => void doAccept()}>
              رد
            </button>
            <button className="reject-call" type="button" onClick={() => void doReject()}>
              رفض
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="call-videos">
            <video ref={remote} autoPlay playsInline className="call-remote" />
            <video ref={local} autoPlay muted playsInline className="call-local" />
            {call?.kind === "audio" && <div className="audio-call-avatar">📞</div>}
          </div>
          <div className="call-actions">
            <button type="button" onClick={() => void toggleSpeaker()} title="السبيكر">
              {speaker ? "🔊" : "🔈"}
            </button>
            <button type="button" onClick={() => void hang()} className="hangup">
              📞
            </button>
          </div>
        </>
      )}
      {error && <p className="call-error">{error}</p>}
    </main>
  );
}

export function NotificationsLivePage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [list, setList] = useState<any[]>(() => readCache<any[]>("notifications") ?? []);
  const [permission, setPermission] = useState<string>(() =>
    typeof Notification !== "undefined" ? Notification.permission : "default",
  );

  const load = async () => {
    if (!token) return;
    const d = await apiRequest("/notifications", token);
    setList(d.notifications || []);
    writeCache("notifications", d.notifications || []);
    try {
      await apiRequest("/notifications/read", token, { method: "POST" });
      window.dispatchEvent(new Event("sdm:notifications-read"));
    } catch {}
  };

  useEffect(() => {
    void load();
    if (typeof Notification !== "undefined") setPermission(Notification.permission);
  }, [token]);

  const enable = async () => {
    if (!token || !("Notification" in window) || !("serviceWorker" in navigator)) return;
    const p = await Notification.requestPermission();
    setPermission(p);
    if (p !== "granted") return;
    try {
      const reg = await navigator.serviceWorker.ready;
      const cfg = await apiRequest("/notifications/config", token);
      if (!cfg.publicKey) return;
      const bytes = Uint8Array.from(
        atob(cfg.publicKey.replace(/-/g, "+").replace(/_/g, "/")),
        (c) => c.charCodeAt(0),
      );
      const sub =
        (await reg.pushManager.getSubscription()) ||
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes }));
      await apiRequest("/notifications/push-subscription", token, {
        method: "POST",
        body: JSON.stringify(sub.toJSON()),
      });
    } catch {}
  };

  return (
    <main className="feed-container">
      <section className="stories-card">
        <div style={{ padding: "18px 20px 10px" }}>
          <h1 style={{ margin: 0 }}>الإشعارات</h1>
        </div>
        {permission === "default" && (
          <div style={{ padding: "0 20px 16px" }}>
            <button
              type="button"
              onClick={() => void enable()}
              style={{ padding: "10px 14px", borderRadius: 12, background: "#111715", color: "#fff" }}
            >
              🔔 تفعيل إشعارات الجهاز
            </button>
          </div>
        )}
        <div className="chat-list">
          {list.map((n) => {
            let data: any = {};
            try {
              data = typeof n.data === "string" ? JSON.parse(n.data) : n.data || {};
            } catch {}
            const url = typeof data.url === "string" ? data.url : "";
            return (
              <button
                type="button"
                key={n.id}
                className="chat-row"
                onClick={() => {
                  if (url) navigate(url);
                }}
                disabled={!url}
              >
                <div>
                  <strong>{n.title}</strong>
                  <small>{n.body}</small>
                </div>
              </button>
            );
          })}
        </div>
      </section>
    </main>
  );
}
