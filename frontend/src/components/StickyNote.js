import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { 
  Edit2, 
  Trash2, 
  Save, 
  X, 
  Pin, 
  PinOff,
  Palette,
  MessageCircle,
  Send
} from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import { API } from '@/lib/config';
import { format } from 'date-fns';
import { noteColorClass, noteSwatchClass } from '@/lib/noteColors';

const StickyNote = ({ note, onUpdate, onDelete }) => {
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(note.texto);
  const [editColor, setEditColor] = useState(note.color);
  const [editFijada, setEditFijada] = useState(note.fijada);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showComments, setShowComments] = useState(true);
  const [comentarios, setComentarios] = useState(note.comentarios || []);
  const [newComment, setNewComment] = useState('');
  const editTextareaRef = useRef(null);

  useEffect(() => {
    if (isEditing && editTextareaRef.current) {
      const el = editTextareaRef.current;
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight}px`;
    }
  }, [isEditing, editText]);

  const colores = [
    { nombre: 'amarillo', value: 'yellow' },
    { nombre: 'vino', value: 'pink' },
    { nombre: 'azul', value: 'blue' },
    { nombre: 'verde', value: 'green' }
  ];

  const handleSave = async () => {
    if (!editText.trim()) {
      toast.error('La nota no puede estar vacía');
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      toast.error('No hay token de autenticación. Por favor, inicia sesión nuevamente.');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.put(
        `${API}/sticky-notes/${note.id}`,
        {
          texto: editText.trim(),
          color: editColor,
          fijada: editFijada
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      onUpdate(response.data);
      setIsEditing(false);
      toast.success('Nota actualizada correctamente');
    } catch (error) {
      console.error('Error updating sticky note:', error);
      if (error.code === 'NETWORK_ERROR') {
        toast.error('Error de red: No se puede conectar al backend.');
      } else if (error.response?.status === 401) {
        toast.error('Token inválido. Inicia sesión nuevamente.');
      } else {
        toast.error('Error al actualizar la nota: ' + (error.response?.data?.detail || error.message));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setEditText(note.texto);
    setEditColor(note.color);
    setEditFijada(note.fijada);
    setIsEditing(false);
    setShowColorPicker(false);
  };

  const handleDelete = async () => {
    if (!confirm('¿Estás seguro de que quieres eliminar esta nota?')) {
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      toast.error('No hay token de autenticación. Por favor, inicia sesión nuevamente.');
      return;
    }

    setLoading(true);
    try {
      await axios.delete(
        `${API}/sticky-notes/${note.id}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      onDelete(note.id);
      toast.success('Nota eliminada correctamente');
    } catch (error) {
      console.error('Error deleting sticky note:', error);
      if (error.code === 'NETWORK_ERROR') {
        toast.error('Error de red: No se puede conectar al backend.');
      } else if (error.response?.status === 401) {
        toast.error('Token inválido. Inicia sesión nuevamente.');
      } else if (error.response?.status === 403) {
        toast.error('Solo el autor puede eliminar esta nota');
      } else {
        toast.error('Error al eliminar la nota: ' + (error.response?.data?.detail || error.message));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) {
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      toast.error('No hay token de autenticación. Por favor, inicia sesión nuevamente.');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(
        `${API}/sticky-notes/${note.id}/comentarios`,
        { texto: newComment.trim() },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const updatedComentarios = [...comentarios, response.data];
      setComentarios(updatedComentarios);
      setNewComment('');
      toast.success('Comentario agregado');
      
      if (onUpdate) {
        onUpdate({ ...note, comentarios: updatedComentarios });
      }
    } catch (error) {
      console.error('Error adding comment:', error);
      if (error.code === 'NETWORK_ERROR') {
        toast.error('Error de red: No se puede conectar al backend.');
      } else if (error.response?.status === 401) {
        toast.error('Token inválido. Inicia sesión nuevamente.');
      } else {
        toast.error('Error al agregar comentario: ' + (error.response?.data?.detail || error.message));
      }
    } finally {
      setLoading(false);
    }
  };

  const formatCommentDate = (dateStr) => {
    if (!dateStr) return '';
    
    const date = new Date(dateStr);
    const now = new Date();
    
    if (isNaN(date.getTime())) return '';
    
    const diffMs = now.getTime() - date.getTime();

    if (diffMs < 0) return 'ahora';

    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffSecs < 60) return 'ahora';
    if (diffMins < 60) return `hace ${diffMins} min`;
    if (diffHours < 24) return `hace ${diffHours} h`;
    if (diffDays < 7) return `hace ${diffDays} d`;

    return date.toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit'
    });
  };

  const canDelete = user?.id === note.autor_id;
  const canEdit = user?.id === note.autor_id;
  const tiempoRelativo = note.tiempo_relativo || 'hace instantes';
  const commentCount = comentarios?.length || 0;

  const fechaReferencia = (note.editada && note.fecha_actualizacion) ? note.fecha_actualizacion : note.timestamp;
  const fechaTooltip = fechaReferencia ? format(new Date(fechaReferencia), 'dd/MM/yy HH:mm') : '';

  return (
    <div className={`relative ${noteColorClass(isEditing ? editColor : note.color)} ${
      (isEditing ? editFijada : note.fijada) ? 'is-pinned' : ''
    } ${isEditing ? 'is-editing' : ''}`}>

      {/* Indicador de nota fijada */}
      {(isEditing ? editFijada : note.fijada) && (
        <div className="absolute -top-2 -right-2 vpm-pin-badge rounded-full p-1">
          <Pin className="w-4 h-4" />
        </div>
      )}

      {/* Contenido capturable */}
      <div>
        <div className="note-body">
          {/* Header con autor y timestamp */}
          <div className="vpm-note-top">
            <div className="vpm-avatar vpm-note-avatar" aria-hidden="true">
              {note.autor_nombre?.charAt(0)?.toUpperCase()}
            </div>
            <div className="vpm-note-meta">
              <span className="vpm-note-author">{note.autor_nombre}</span>
              <span className="vpm-note-time" title={fechaTooltip}>{tiempoRelativo}</span>
            </div>
            <div className="vpm-note-tools">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowComments(!showComments)}
                aria-label={showComments ? 'Ocultar comentarios' : 'Mostrar comentarios'}
                aria-expanded={showComments}
                className="vpm-note-tool relative"
              >
                <MessageCircle className="w-4 h-4" />
                {commentCount > 0 && (
                  <span className="absolute -top-1 -right-1 vpm-pin-badge text-[10px] rounded-full w-3.5 h-3.5 flex items-center justify-center">
                    {commentCount}
                  </span>
                )}
              </Button>
              {canEdit && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                  aria-label="Editar nota"
                  className="vpm-note-tool"
                >
                  <Edit2 className="w-4 h-4" />
                </Button>
              )}
              {canDelete && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDelete}
                  aria-label="Eliminar nota"
                  className="vpm-note-tool"
                  disabled={loading}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Contenido de la nota */}
          <div className="note-content">
            {isEditing ? (
              <div className="space-y-2">
                <Textarea
                  ref={editTextareaRef}
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  className="vpm-note-input"
                  placeholder="Escribe tu nota..."
                />

                <div className="vpm-edit-bar">
                  <div className="vpm-swatches" role="radiogroup" aria-label="Color de la nota">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowColorPicker(!showColorPicker)}
                      aria-label="Elegir color"
                      aria-expanded={showColorPicker}
                      className="vpm-note-tool"
                    >
                      <Palette className="w-4 h-4" />
                    </Button>

                    {showColorPicker && colores.map((color) => (
                      <button
                        key={color.value}
                        role="radio"
                        aria-checked={editColor === color.value}
                        onClick={() => {
                          setEditColor(color.value);
                          setShowColorPicker(false);
                        }}
                        className={noteSwatchClass(color.value)}
                        title={color.nombre}
                      />
                    ))}

                    {/* Toggle fijada */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditFijada(!editFijada)}
                      aria-label={editFijada ? 'Desfijar nota' : 'Fijar nota'}
                      aria-pressed={editFijada}
                      className={`vpm-note-tool ${editFijada ? 'is-pinned' : ''}`}
                    >
                      {editFijada ? <Pin className="w-4 h-4" /> : <PinOff className="w-4 h-4" />}
                    </Button>
                  </div>

                  {/* Botones de acción */}
                  <div className="vpm-edit-actions">
                    <Button
                      size="sm"
                      onClick={handleSave}
                      disabled={loading}
                      className="vpm-btn vpm-btn-save"
                    >
                      <Save className="w-4 h-4" />
                      Guardar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCancel}
                      disabled={loading}
                      className="vpm-btn vpm-btn-ghost"
                    >
                      <X className="w-4 h-4" />
                      Cancelar
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <p className="vpm-note-text mb-2 max-h-40 overflow-y-auto">
                  {note.texto}
                </p>
                
                {/* Sección de comentarios */}
                {showComments && (
                  <div className="vpm-note-foot">
                    <div className="vpm-comments-toggle">
                      <MessageCircle className="w-3.5 h-3.5" />
                      Comentarios ({commentCount})
                    </div>
                    
                    {/* Lista de comentarios */}
                    <div className="vpm-comment-list max-h-40 overflow-y-auto comentarios-scroll">
                      {comentarios && comentarios.length > 0 ? (
                        comentarios.map((comentario) => (
                          <div 
                            key={comentario.id} 
                            className="vpm-comment"
                          >
                            <div className="flex justify-between items-start gap-2 mb-1">
                              <span className="font-semibold text-[10px]">
                                {comentario.autor_nombre}
                              </span>
                               <span className="text-[9px]" title={comentario.fecha ? format(new Date(comentario.fecha), 'dd/MM/yy HH:mm') : ''}>
                                 {comentario.tiempo_relativo || formatCommentDate(comentario.fecha)}
                               </span>
                            </div>
                            <p>{comentario.texto}</p>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs italic">Sin comentarios aún</p>
                      )}
                    </div>
                    
                    {/* Input para nuevo comentario */}
                    <div className="flex gap-1">
                      <input
                        type="text"
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
                        placeholder="Escribir comentario..."
                        className="vpm-comment-input"
                      />
                      <Button
                        size="sm"
                        onClick={handleAddComment}
                        disabled={loading || !newComment.trim()}
                        aria-label="Agregar comentario"
                        className="vpm-note-tool vpm-comment-send"
                      >
                        <Send className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StickyNote;
