import { useEffect, useMemo, useRef, useState } from 'react';
import { Bot, Loader2, Mic, MicOff, Send, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { apiDelete, apiGet, apiPost } from '@/lib/api';
import { API } from '@/lib/config';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { MetricasResumen } from '@/components/MetricasPanel';

const canRecordAudio = () =>
  typeof window !== 'undefined' &&
  typeof navigator !== 'undefined' &&
  !!navigator.mediaDevices?.getUserMedia &&
  typeof MediaRecorder !== 'undefined';

const escapeHtml = (str) =>
  String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const renderInline = (text) => {
  let s = escapeHtml(text);
  // inline code
  s = s.replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 rounded bg-black/10 dark:bg-white/10 font-mono text-[0.85em]">$1</code>');
  // bold ** or __
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  // italic * or _ (simple)
  s = s.replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,!?:;]|$)/g, '$1<em>$2</em>');
  s = s.replace(/(^|[\s(])_([^_\n]+)_(?=[\s).,!?:;]|$)/g, '$1<em>$2</em>');
  return s;
};

const renderMarkdown = (content) => {
  const text = String(content || '').replace(/\r\n/g, '\n');
  const lines = text.split('\n');
  let html = '';
  let inUl = false;
  let inOl = false;
  let i = 0;

  const closeLists = () => {
    if (inUl) { html += '</ul>'; inUl = false; }
    if (inOl) { html += '</ol>'; inOl = false; }
  };

  const isTableSep = (line) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/.test(line || '');
  const splitRow = (line) => {
    let s = (line || '').trim();
    if (s.startsWith('|')) s = s.slice(1);
    if (s.endsWith('|')) s = s.slice(0, -1);
    return s.split('|').map((c) => c.trim());
  };
  const isTableRow = (line) => {
    if (!line) return false;
    const t = line.trim();
    if (!t.includes('|')) return false;
    if (/^\s*[-*]\s+/.test(t)) return false;
    if (/^#{1,6}\s+/.test(t)) return false;
    return true;
  };
  const alignClass = (sepCell) => {
    const s = (sepCell || '').trim();
    const left = s.startsWith(':');
    const right = s.endsWith(':');
    if (left && right) return 'text-center';
    if (right) return 'text-right';
    return 'text-left';
  };

  while (i < lines.length) {
    const line = lines[i];

    // GFM table: header + separator + rows
    if (isTableRow(line) && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      closeLists();
      const headers = splitRow(line);
      const sepCells = splitRow(lines[i + 1]);
      const aligns = headers.map((_, idx) => alignClass(sepCells[idx] || ''));
      const rows = [];
      i += 2;
      while (i < lines.length && isTableRow(lines[i]) && !isTableSep(lines[i])) {
        if (lines[i].trim() === '') break;
        rows.push(splitRow(lines[i]));
        i++;
      }
      html += '<div class="my-2 overflow-x-auto rounded-md border border-border"><table class="min-w-full text-sm border-collapse">';
      html += '<thead class="bg-muted/70"><tr>';
      headers.forEach((h, idx) => {
        const a = aligns[idx] || 'text-left';
        html += `<th class="px-3 py-2 font-semibold border-b border-border ${a} whitespace-nowrap">${renderInline(h)}</th>`;
      });
      html += '</tr></thead><tbody>';
      rows.forEach((row, rIdx) => {
        const stripe = rIdx % 2 === 1 ? ' bg-muted/20' : '';
        html += `<tr class="${stripe}">`;
        headers.forEach((_, idx) => {
          const a = aligns[idx] || 'text-left';
          const cell = row[idx] != null ? row[idx] : '';
          html += `<td class="px-3 py-2 border-b border-border align-top ${a}">${renderInline(cell)}</td>`;
        });
        html += '</tr>';
      });
      html += '</tbody></table></div>';
      continue;
    }

    const ulMatch = line.match(/^\s*[-*]\s+(.*)$/);
    const olMatch = line.match(/^\s*\d+\.\s+(.*)$/);
    const h3 = line.match(/^###\s+(.*)$/);
    const h2 = line.match(/^##\s+(.*)$/);
    const h1 = line.match(/^#\s+(.*)$/);

    if (ulMatch) {
      if (inOl) { html += '</ol>'; inOl = false; }
      if (!inUl) { html += '<ul class="list-disc pl-5 my-1 space-y-0.5">'; inUl = true; }
      html += `<li>${renderInline(ulMatch[1])}</li>`;
      i++;
      continue;
    }
    if (olMatch) {
      if (inUl) { html += '</ul>'; inUl = false; }
      if (!inOl) { html += '<ol class="list-decimal pl-5 my-1 space-y-0.5">'; inOl = true; }
      html += `<li>${renderInline(olMatch[1])}</li>`;
      i++;
      continue;
    }

    closeLists();

    if (h3) { html += `<div class="font-semibold mt-2 mb-1">${renderInline(h3[1])}</div>`; i++; continue; }
    if (h2) { html += `<div class="font-semibold text-base mt-2 mb-1">${renderInline(h2[1])}</div>`; i++; continue; }
    if (h1) { html += `<div class="font-bold text-base mt-2 mb-1">${renderInline(h1[1])}</div>`; i++; continue; }

    if (line.trim() === '') {
      html += '<div class="h-2"></div>';
    } else {
      html += `<p class="my-0.5">${renderInline(line)}</p>`;
    }
    i++;
  }
  closeLists();
  return html;
};

const MarkdownMessage = ({ content }) => (
  <div
    className="markdown-chat"
    dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
  />
);

// Desactivadas temporalmente: en mobile ocupaban casi toda la pantalla del chat.
const MOSTRAR_SUGERENCIAS = false;

const SUGERENCIAS = [
  '¿Cuánto se vendió hoy?',
  'Mostrame saldo y últimos movimientos de cta cte de un cliente',
  'Buscá las transf de MercadoPago de las últimas 24 horas',
  'Mostrame los últimos registros de auditoría',
  'Mostrame la últimas 10 ventas',
  '¿Cuánto se vendió los últimos 3 días?'
];

const SUGERENCIAS_METRICAS = ['¿Cuántas horas trabajé este mes?'];

const SUGERENCIAS_METRICAS_ADMIN = [
  '¿Cuánto vendió Tomás en noviembre?',
  'Estimá las horas que trabajó Juan esta semana',
  'Hacé el ranking de mejor a peor',
  'Hacé el ranking de peor a mejor usando pesos parejos'
];

const GREETING = {
  role: 'assistant',
  content:
    'Hola, soy el asistente de consultas del sistema. Puedo ayudarte con productos, ventas, cuentas corrientes (clientes y proveedores), egresos, transferencias de MercadoPago y auditoría. ¿Qué querés consultar?',
};

const ChatIA = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState([GREETING]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [listening, setListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [cooldown, setCooldown] = useState(false);
  const endRef = useRef(null);
  const textareaRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);
  const cooldownTimerRef = useRef(null);
  const loadingRef = useRef(false);
  const userInitial = (user?.nombre || user?.username || 'U').trim().charAt(0).toUpperCase() || 'U';
  const esAdmin = user?.rol === 'admin';
  const sugerencias = useMemo(
    () => (esAdmin ? [...SUGERENCIAS, ...SUGERENCIAS_METRICAS_ADMIN] : [...SUGERENCIAS, ...SUGERENCIAS_METRICAS]),
    [esAdmin]
  );

  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  useEffect(() => {
    return () => {
      if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current);
    };
  }, []);

  const speechSupported = canRecordAudio();

  useEffect(() => {
    return () => {
      try {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
        }
      } catch {}
      try {
        streamRef.current?.getTracks?.().forEach((t) => t.stop());
      } catch {}
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadHistory = async ({ initial = false } = {}) => {
      if (initial) setLoadingHistory(true);
      try {
        const res = await apiGet(`${API}/chat/history`);
        if (cancelled) return;
        // No pisar el estado local mientras hay una consulta en curso
        if (!initial && loadingRef.current) return;
        const history = Array.isArray(res?.data) ? res.data : [];
        if (history.length > 0) {
          setMessages(history.map((m) => ({ role: m.role, content: m.content, data: m.data || null })));
        } else {
          setMessages([GREETING]);
        }
      } catch (e) {
        if (cancelled) return;
        // En carga inicial, si falla seguimos con saludo; en refrescos mantenemos lo actual
        if (initial) setMessages([GREETING]);
      } finally {
        if (initial && !cancelled) setLoadingHistory(false);
      }
    };

    loadHistory({ initial: true });

    const onFocus = () => {
      if (!loadingRef.current) loadHistory();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && !loadingRef.current) loadHistory();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  useEffect(() => {
    if (loadingHistory) return;
    endRef.current?.scrollIntoView({ behavior: 'auto' });
  }, [messages, loading, loadingHistory]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = '0px';
    const next = Math.max(44, Math.min(el.scrollHeight, 128));
    el.style.height = `${next}px`;
  }, [input]);

  const canSend = useMemo(
    () => input.trim().length > 0 && !loading && !loadingHistory && !transcribing && !cooldown,
    [input, loading, loadingHistory, transcribing, cooldown]
  );

  const sendMessage = async (text) => {
    const content = (text ?? input).trim();
    if (!content || loading || loadingHistory || transcribing || cooldown) return;

    const userMsg = { role: 'user', content };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await apiPost(`${API}/chat`, { message: content });
      const reply = res?.data?.reply || 'No recibí respuesta del asistente.';
      const datoMetrica = res?.data?.data || null;
      setMessages((prev) => [...prev, { role: 'assistant', content: reply, data: datoMetrica }]);
    } catch (error) {
      const status = error?.response?.status;
      const detail = error?.response?.data?.detail || 'No se pudo obtener respuesta del asistente.';
      const detailText = typeof detail === 'string' ? detail : 'Error al consultar el asistente';
      const isRateLimit =
        status === 429 ||
        /rate limit|límite de tokens|tokens por minuto|per \d+ (minute|second)/i.test(detailText);

      toast.error(detailText);

      if (isRateLimit) {
        let waitMs = 20000;
        const m = detailText.match(/~?\s*(\d+)\s*seg/i);
        if (m) {
          const secs = parseInt(m[1], 10);
          if (!Number.isNaN(secs) && secs > 0) waitMs = Math.min(Math.max(secs, 3), 60) * 1000;
        }
        setCooldown(true);
        if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current);
        cooldownTimerRef.current = setTimeout(() => {
          setCooldown(false);
          cooldownTimerRef.current = null;
        }, waitMs);
      }

      // Si no se pudo enviar, restaurar el mensaje en el textarea y quitar el mensaje optimista
      setMessages((prev) => {
        if (prev.length) {
          const last = prev[prev.length - 1];
          if (last.role === 'user' && last.content === content) {
            return prev.slice(0, -1);
          }
        }
        return prev;
      });
      setInput(content);
    } finally {
      setLoading(false);
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const stopStreamTracks = () => {
    try {
      streamRef.current?.getTracks?.().forEach((t) => t.stop());
    } catch {}
    streamRef.current = null;
  };

  const toggleListening = async () => {
    if (!speechSupported) {
      toast.error('Tu navegador no soporta grabación de voz. Probá con un navegador actualizado (Chrome/Edge).');
      return;
    }
    if (loading || loadingHistory || transcribing) return;

    if (listening) {
      try {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
        }
      } catch {}
      setListening(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      let mimeType = '';
      if (typeof MediaRecorder.isTypeSupported === 'function') {
        const candidates = [
          'audio/webm;codecs=opus',
          'audio/webm',
          'audio/ogg;codecs=opus',
          'audio/mp4',
        ];
        mimeType = candidates.find((t) => MediaRecorder.isTypeSupported(t)) || '';
      }

      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onerror = () => {
        toast.error('Error al grabar el audio.');
        setListening(false);
        stopStreamTracks();
      };

      recorder.onstop = async () => {
        setListening(false);
        const chunks = audioChunksRef.current || [];
        audioChunksRef.current = [];
        const usedMime = recorder.mimeType || mimeType || 'audio/webm';
        stopStreamTracks();

        if (!chunks.length) {
          toast.error('No se grabó audio. Intentá de nuevo.');
          return;
        }

        const blob = new Blob(chunks, { type: usedMime });
        if (!blob.size) {
          toast.error('No se grabó audio. Intentá de nuevo.');
          return;
        }

        setTranscribing(true);
        try {
          const ext = usedMime.includes('mp4') || usedMime.includes('m4a')
            ? 'm4a'
            : usedMime.includes('ogg')
            ? 'ogg'
            : usedMime.includes('wav')
            ? 'wav'
            : 'webm';
          const form = new FormData();
          form.append('file', blob, `audio.${ext}`);

          const res = await apiPost(`${API}/chat/transcribe`, form);
          const text = (res?.data?.text || '').trim();
          if (text) {
            setInput((prev) => (prev && prev.trim() ? `${prev.trim()} ${text}` : text));
          } else {
            toast.error('No se pudo transcribir el audio. Intentá hablar más claro o de nuevo.');
          }
        } catch (error) {
          const detail = error?.response?.data?.detail || 'No se pudo transcribir el audio.';
          toast.error(typeof detail === 'string' ? detail : 'No se pudo transcribir el audio.');
        } finally {
          setTranscribing(false);
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setListening(true);
    } catch (e) {
      stopStreamTracks();
      setListening(false);
      if (e?.name === 'NotAllowedError' || e?.name === 'PermissionDeniedError' || e?.name === 'SecurityError') {
        toast.error('Permiso de micrófono denegado. Habilitalo en el navegador.');
      } else if (e?.name === 'NotFoundError' || e?.name === 'DevicesNotFoundError') {
        toast.error('No se encontró micrófono disponible.');
      } else if (e?.name === 'NotReadableError' || e?.name === 'TrackStartError') {
        toast.error('No se pudo acceder al micrófono (puede estar en uso por otra app).');
      } else {
        toast.error('No se pudo iniciar la grabación de voz.');
      }
    }
  };

  const clearChat = async () => {
    if (loading) return;
    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    } catch {}
    setListening(false);
    stopStreamTracks();
    try {
      await apiDelete(`${API}/chat/history`);
      setMessages([
        {
          role: 'assistant',
          content:
            'Historial reiniciado. Puedo ayudarte con productos, ventas, cuentas corrientes (clientes y proveedores), egresos, MercadoPago y auditoría. ¿Qué querés consultar?',
        },
      ]);
      toast.success('Historial eliminado');
    } catch (e) {
      toast.error('No se pudo eliminar el historial');
    }
  };

  return (
    <div className="flex h-[calc(100dvh-132px)] flex-col lg:h-[calc(100dvh-80px)]">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
            <Bot className="w-6 h-6 text-primary" />
            Chat IA
          </h1>
          <p className="text-sm text-muted-foreground">
            Consultá datos del sistema (solo lectura): productos, ventas, cuentas corrientes, egresos, MercadoPago, auditoría y métricas del equipo.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={clearChat} disabled={loading || loadingHistory}>
            <Trash2 className="w-4 h-4 mr-2" />
            Borrar historial
          </Button>
        </div>
      </div>

      <Card className="mt-4 flex min-h-0 flex-1 flex-col">
        <CardHeader className="py-3 border-b border-border">
          <CardTitle className="text-base">Conversación</CardTitle>
        </CardHeader>
        <CardContent className="min-h-0 flex-1 overflow-y-auto p-4 space-y-4">
          {loadingHistory ? (
            <div className="py-10">
              <SkeletonLines rows={4} />
            </div>
          ) : (
            <>
              {messages.map((m, idx) => {
                const isUser = m.role === 'user';
                return (
                  <div key={idx} className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
                    {!isUser && (
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Bot className="w-4 h-4 text-primary" />
                      </div>
                    )}
                    <div
                      aria-live={isUser ? undefined : 'polite'}
                      className={`max-w-[90%] sm:max-w-[85%] lg:max-w-[80%] rounded-lg px-4 py-2 text-sm leading-relaxed ${
                        isUser
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-foreground border border-border'
                      }`}
                    >
                      {isUser ? (
                        <div className="whitespace-pre-wrap">{m.content}</div>
                      ) : (
                        <>
                          <MarkdownMessage content={m.content} />
                          {m.data && <MetricasResumen dato={m.data} />}
                        </>
                      )}
                    </div>
                    {isUser && (
                      <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0 text-sm font-semibold">
                        {userInitial}
                      </div>
                    )}
                  </div>
                );
              })}
              {loading && (
                <div className="flex gap-3 justify-start">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4 text-primary" />
                  </div>
                  <div className="bg-muted border border-border rounded-lg px-4 py-2">
                    <SkeletonLines rows={2} width="8rem" />
                  </div>
                </div>
              )}
            </>
          )}
          <div ref={endRef} />
        </CardContent>

        <div className="p-3 border-t border-border space-y-3">
          {MOSTRAR_SUGERENCIAS && messages.length <= 1 && !loading && !loadingHistory && (
            <div className="flex flex-wrap gap-2">
              {sugerencias.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => sendMessage(s)}
                  className="text-xs px-3 py-1.5 rounded-full border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-2 items-end">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              rows={1}
              placeholder="Escribí o dictá tu consulta... (Enter para enviar, Shift+Enter para salto de línea)"
              className="min-h-[44px] max-h-32 h-[44px] resize-none overflow-y-auto py-2.5 leading-5"
              disabled={loading || loadingHistory}
            />
            <Button
              type="button"
              variant={listening ? 'destructive' : 'outline'}
              onClick={toggleListening}
              disabled={loading || loadingHistory || transcribing || !speechSupported}
              className="h-[44px] px-3"
              title={
                !speechSupported
                  ? 'Grabación de voz no soportada en este navegador'
                  : transcribing
                  ? 'Transcribiendo audio...'
                  : listening
                  ? 'Detener grabación'
                  : 'Dictar por voz'
              }
            >
              {transcribing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : listening ? (
                <MicOff className="w-4 h-4" />
              ) : (
                <Mic className="w-4 h-4" />
              )}
            </Button>
            <Button
              onClick={() => sendMessage()}
              disabled={!canSend}
              className="h-[44px] px-4"
              title={cooldown ? 'Esperá unos segundos antes de reintentar' : undefined}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
          <p className="text-[12px] text-muted-foreground flex justify-end">
            {cooldown
              ? 'Límite de uso alcanzado: esperá unos segundos antes de reintentar.'
              : transcribing
              ? 'Transcribiendo audio...'
              : listening
              ? 'Grabando... (tocá el micrófono para detener y transcribir)'
              : speechSupported
              ? 'Podés dictar con el micrófono.'
              : 'Dictado por voz no disponible en este navegador.'}
          </p>
        </div>
      </Card>
    </div>
  );
};

export default ChatIA;