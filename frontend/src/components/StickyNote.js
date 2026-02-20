import { useState } from 'react';
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
  Check
} from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import { API } from '@/lib/config';

const StickyNote = ({ note, onUpdate, onDelete }) => {
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(note.texto);
  const [editColor, setEditColor] = useState(note.color);
  const [editFijada, setEditFijada] = useState(note.fijada);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [loading, setLoading] = useState(false);

  const colores = [
    { nombre: 'amarillo', clase: 'bg-yellow-200 border-yellow-300 hover:bg-yellow-300', value: 'yellow' },
    { nombre: 'rosa', clase: 'bg-pink-200 border-pink-300 hover:bg-pink-300', value: 'pink' },
    { nombre: 'azul', clase: 'bg-blue-200 border-blue-300 hover:bg-blue-300', value: 'blue' },
    { nombre: 'verde', clase: 'bg-green-200 border-green-300 hover:bg-green-300', value: 'green' }
  ];

  const getColorClasses = (color) => {
    const colorMap = {
      'yellow': 'bg-yellow-200 border-yellow-300',
      'pink': 'bg-pink-200 border-pink-300', 
      'blue': 'bg-blue-200 border-blue-300',
      'green': 'bg-green-200 border-green-300'
    };
    return colorMap[color] || colorMap['yellow'];
  };

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

  const canDelete = user?.id === note.autor_id;
  const canEdit = user?.id === note.autor_id;
  const tiempoRelativo = note.tiempo_relativo || 'hace instantes';

  return (
    <div className={`relative border-2 rounded-lg p-4 min-h-[150px] w-full max-w-xs transition-all duration-200 ${
      isEditing ? getColorClasses(editColor) : getColorClasses(note.color)
    } ${isEditing && editFijada ? 'ring-2 ring-red-400 shadow-lg' : 
        !isEditing && note.fijada ? 'ring-2 ring-red-400 shadow-lg' : 
        'shadow-md hover:shadow-lg'}`}>
      
      {/* Indicador de nota fijada */}
      {(isEditing ? editFijada : note.fijada) && (
        <div className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1">
          <Pin className="w-4 h-4" />
        </div>
      )}

      {/* Header con autor y timestamp */}
      <div className="mb-2 border-b border-gray-400 pb-1">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-700">
            {note.autor_nombre}
          </span>
          <div className="flex gap-1">
            {canEdit && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditing(true)}
                className="h-4 w-6 p-0 text-gray-600 hover:text-blue-600"
              >
                <Edit2 className="w-3 h-3" />
              </Button>
            )}
            {canDelete && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDelete}
                className="h-4 w-6 p-0 text-gray-600 hover:text-red-600"
                disabled={loading}
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            )}
          </div>
        </div>
        <span className="text-xs text-gray-600">
          {tiempoRelativo}
        </span>
      </div>

      {/* Contenido de la nota */}
      {isEditing ? (
        <div className="space-y-2">
          <Textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            className="min-h-[80px] text-sm resize-none bg-white/50"
            placeholder="Escribe tu nota..."
          />
          
          {/* Selector de color */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowColorPicker(!showColorPicker)}
              className="h-6 text-xs"
            >
              <Palette className="w-3 h-3 mr-1" />
              Color
            </Button>
            
            {/* Toggle fijada */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditFijada(!editFijada)}
              className={`h-6 text-xs ${editFijada ? 'bg-red-100 border-red-300' : ''}`}
            >
              {editFijada ? <Pin className="w-3 h-3 mr-1" /> : <PinOff className="w-3 h-3 mr-1" />}
              {editFijada ? 'Fijada' : 'Fijar'}
            </Button>
          </div>

          {/* Paleta de colores */}
          {showColorPicker && (
            <div className="flex gap-1 mt-2">
              {colores.map((color) => (
                <button
                  key={color.value}
                  onClick={() => {
                    setEditColor(color.value);
                    setShowColorPicker(false);
                  }}
                  className={`w-6 h-6 rounded border-2 ${color.clase} ${
                    editColor === color.value ? 'ring-2 ring-blue-500' : ''
                  }`}
                  title={color.nombre}
                />
              ))}
            </div>
          )}

          {/* Botones de acción */}
          <div className="flex gap-1">
            <Button
              size="sm"
              onClick={handleSave}
              disabled={loading}
              className="h-6 text-xs bg-green-600 hover:bg-green-700"
            >
              <Save className="w-3 h-3 mr-1" />
              Guardar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancel}
              disabled={loading}
              className="h-6 text-xs"
            >
              <X className="w-3 h-3 mr-1" />
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <div>
          <p className="text-sm text-gray-800 whitespace-pre-wrap mb-2">
            {note.texto}
          </p>
        </div>
      )}
    </div>
  );
};

export default StickyNote;