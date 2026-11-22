import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import StickyNote from './StickyNote';
import { Button } from '@/components/ui/button';
import Skeleton from '@/components/Skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Plus, 
  StickyNote as StickyNoteIcon,
  RefreshCw,
  Pin,
  PinOff,
  Save,
  X
} from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import { API } from '@/lib/config';
import { noteColorClass, noteSwatchClass } from '@/lib/noteColors';

const StickyNotesContainer = () => {
  const { user } = useAuth();
  const [stickyNotes, setStickyNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newNoteText, setNewNoteText] = useState('');
  const [newNoteColor, setNewNoteColor] = useState('yellow');
  const [newNoteFijada, setNewNoteFijada] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [creating, setCreating] = useState(false);
  const gridRef = useRef(null);

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;

    const rowHeight = 8;
    const gap = 12;

    const applyMasonry = () => {
      const items = Array.from(grid.children);
      if (!items.length) return;
      items.forEach((item) => {
        const h = item.getBoundingClientRect().height;
        const span = Math.max(1, Math.ceil((h + gap) / (rowHeight + gap)));
        if (item.style.gridRowEnd !== `span ${span}`) {
          item.style.gridRowEnd = `span ${span}`;
        }
      });
    };

    const schedule = () => window.requestAnimationFrame(applyMasonry);
    schedule();

    // Sólo observar los hijos: observar el grid hacía que el cambio de
    // gridRowEnd disparara otro resize y causara el "ResizeObserver loop".
    const observer = new ResizeObserver(schedule);
    Array.from(grid.children).forEach((child) => observer.observe(child));

    window.addEventListener('resize', schedule);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', schedule);
    };
  }, [stickyNotes, showCreateForm, loading]);

  const colores = [
    { nombre: 'amarillo', value: 'yellow' },
    { nombre: 'vino', value: 'pink' },
    { nombre: 'azul', value: 'blue' },
    { nombre: 'verde', value: 'green' }
  ];

  const fetchStickyNotes = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        toast.error('No hay token de autenticación. Por favor, inicia sesión nuevamente.');
        return;
      }

      const response = await axios.get(`${API}/sticky-notes`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      setStickyNotes(response.data);
    } catch (error) {
      if (error.code === 'NETWORK_ERROR' || !error.response) {
        toast.error('Error de red: No se puede conectar al backend. Verifica la conexión.');
      } else if (error.response?.status === 405) {
        toast.error('El backend necesita ser reiniciado para cargar Sticky Notes.');
      } else if (error.response?.status === 401) {
        toast.error('Token inválido o expirado. Por favor, inicia sesión nuevamente.');
      } else if (error.response?.status === 404) {
        toast.error('Los Sticky Notes no están disponibles aún.');
      } else {
        toast.error('Error al cargar las notas: ' + (error.response?.data?.detail || error.message));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStickyNotes();
  }, []);

  const handleCreateNote = async () => {
    if (!newNoteText.trim()) {
      toast.error('La nota no puede estar vacía');
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      toast.error('No hay token de autenticación. Por favor, inicia sesión nuevamente.');
      return;
    }

    setCreating(true);
    try {
      const response = await axios.post(
        `${API}/sticky-notes`,
        {
          texto: newNoteText.trim(),
          color: newNoteColor,
          fijada: newNoteFijada
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      setStickyNotes(notes => sortNotes([response.data, ...notes]));
      setNewNoteText('');
      setNewNoteColor('yellow');
      setNewNoteFijada(false);
      setShowCreateForm(false);
      toast.success('Nota creada correctamente');
    } catch (error) {
      console.error('Error creating sticky note:', error);
      if (error.code === 'NETWORK_ERROR') {
        toast.error('Error de red: No se puede conectar al backend.');
      } else if (error.response?.status === 401) {
        toast.error('Token inválido. Inicia sesión nuevamente.');
      } else {
        toast.error('Error al crear la nota: ' + (error.response?.data?.detail || error.message));
      }
    } finally {
      setCreating(false);
    }
  };

  const sortNotes = (notes) => {
    const refFecha = (n) =>
      n.fecha_actualizacion
        ? new Date(n.fecha_actualizacion).getTime()
        : new Date(n.timestamp || 0).getTime();
    return [...notes].sort((a, b) => {
      if (a.fijada !== b.fijada) return a.fijada ? -1 : 1;
      return refFecha(b) - refFecha(a);
    });
  };

  const handleUpdateNote = (updatedNote) => {
    setStickyNotes(notes => 
      sortNotes(notes.map(note => 
        note.id === updatedNote.id ? { ...note, ...updatedNote } : note
      ))
    );
  };

  const handleDeleteNote = (noteId) => {
    setStickyNotes(notes => notes.filter(note => note.id !== noteId));
  };

  const handleCancelCreate = () => {
    setNewNoteText('');
    setNewNoteColor('yellow');
    setNewNoteFijada(false);
    setShowCreateForm(false);
    setShowColorPicker(false);
  };

  return (
    <Card className="vpm-notes-card w-full">
      <CardHeader className="p-0">
        <div className="vpm-section-head">
          <CardTitle className="vpm-section-title">
            Notas <span>{stickyNotes.length} notas</span>
          </CardTitle>
          <div className="vpm-btn-row">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchStickyNotes}
              disabled={loading}
              title="Actualizar notas"
              aria-label="Actualizar notas"
              className="vpm-icon-btn"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              onClick={() => setShowCreateForm(true)}
              size="sm"
              className="vpm-btn vpm-btn-primary"
            >
              <Plus className="w-4 h-4" />
              Nueva nota
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="vpm-notes-content">


        {/* Lista de sticky notes */}
        {loading ? (
          <Skeleton variant="card" count={3} as="div" />
        ) : stickyNotes.length === 0 && !showCreateForm ? (
          <div className="text-center py-8 text-muted-foreground">
            <StickyNoteIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No hay sticky notes todavía</p>
            <p className="text-sm">Crea tu primera nota para comenzar</p>
          </div>
        ) : (
          <div
            ref={gridRef}
            className="vpm-notes-grid gap-4 items-start"
            style={{ gridAutoRows: '8px' }}
          >
            {/* Nota de creación */}
            {showCreateForm && (
              <div className={`${noteColorClass(newNoteColor)} ${newNoteFijada ? 'is-pinned' : ''}`}>
                {/* Indicador de nota fijada */}
                {newNoteFijada && (
                  <div className="absolute -top-2 -right-2 vpm-pin-badge rounded-full p-1">
                    <Pin className="w-4 h-4" />
                  </div>
                )}

                {/* Header con autor */}
                <div className="vpm-note-top">
                  <div className="vpm-avatar vpm-note-avatar" aria-hidden="true">
                    {(user?.nombre || 'T').charAt(0).toUpperCase()}
                  </div>
                  <div className="vpm-note-meta">
                    <span className="vpm-note-author">{user?.nombre || 'Tú'}</span>
                    <span className="vpm-note-time">Nueva nota</span>
                  </div>
                </div>

                <div className="vpm-note-body-text">
                  <Textarea
                    value={newNoteText}
                    onChange={(e) => setNewNoteText(e.target.value)}
                    className="vpm-note-input"
                    placeholder="Escribe tu nota aquí..."
                    autoFocus
                  />

                  <div className="vpm-edit-bar">
                    <div className="vpm-swatches" role="radiogroup" aria-label="Color de la nota">
                      {colores.map((color) => (
                        <button
                          key={color.value}
                          type="button"
                          role="radio"
                          aria-checked={newNoteColor === color.value}
                          onClick={() => setNewNoteColor(color.value)}
                          className={noteSwatchClass(color.value)}
                          title={color.nombre}
                        />
                      ))}
                      <span className="vpm-sep" aria-hidden="true" />
                      <button
                        type="button"
                        className="vpm-pin-btn"
                        onClick={() => setNewNoteFijada(!newNoteFijada)}
                        aria-label={newNoteFijada ? 'Desfijar nota' : 'Fijar nota'}
                        aria-pressed={newNoteFijada}
                        title="Fijar arriba"
                      >
                        {newNoteFijada ? <Pin className="w-4 h-4" /> : <PinOff className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Botones de acción en una segunda fila, como en el mockup */}
                  <div className="vpm-edit-actions">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCancelCreate}
                      disabled={creating}
                      className="vpm-btn vpm-btn-ghost"
                    >
                      <X className="w-4 h-4" />
                      Cancelar
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleCreateNote}
                      disabled={creating || !newNoteText.trim()}
                      className="vpm-btn vpm-btn-save"
                    >
                      <Save className="w-4 h-4" />
                      Crear
                    </Button>
                  </div>
                </div>
              </div>
            )}
            
            {/* Notas existentes */}
            {stickyNotes.map((note) => (
              <StickyNote
                key={note.id}
                note={note}
                onUpdate={handleUpdateNote}
                onDelete={handleDeleteNote}
              />
            ))}

            {/* Alta rápida, como en el mockup */}
            {!showCreateForm && (
              <button
                type="button"
                onClick={() => setShowCreateForm(true)}
                className="vpm-note-add"
              >
                <Plus className="w-6 h-6" />
                Agregar nota
              </button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default StickyNotesContainer;