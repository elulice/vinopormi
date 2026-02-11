import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import StickyNote from './StickyNote';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Plus, 
  StickyNote as StickyNoteIcon,
  RefreshCw,
  Palette
} from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

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

  const colores = [
    { nombre: 'amarillo', clase: 'bg-yellow-200 border-yellow-300 hover:bg-yellow-300', value: 'yellow' },
    { nombre: 'rosa', clase: 'bg-pink-200 border-pink-300 hover:bg-pink-300', value: 'pink' },
    { nombre: 'azul', clase: 'bg-blue-200 border-blue-300 hover:bg-blue-300', value: 'blue' },
    { nombre: 'verde', clase: 'bg-green-200 border-green-300 hover:bg-green-300', value: 'green' }
  ];

  const fetchStickyNotes = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        toast.error('No hay token de autenticación. Por favor, inicia sesión nuevamente.');
        return;
      }

      const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
      console.log('Making request to:', `${BACKEND_URL}/api/sticky-notes`);
      console.log('Token exists:', !!token);
      
      const response = await axios.get(`${BACKEND_URL}/api/sticky-notes`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      setStickyNotes(response.data);
    } catch (error) {
      console.error('Error fetching sticky notes:', error);
      console.error('Error response:', error.response);
      console.error('Error request:', error.request);
      
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
      const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
      const response = await axios.post(
        `${BACKEND_URL}/api/sticky-notes`,
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

      setStickyNotes([response.data, ...stickyNotes]);
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

  const handleUpdateNote = (updatedNote) => {
    setStickyNotes(notes => 
      notes.map(note => 
        note.id === updatedNote.id ? { ...note, ...updatedNote } : note
      )
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
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <StickyNoteIcon className="w-5 h-5" />
            Sticky Notes
            <span className="text-sm text-muted-foreground ml-2">
              ({stickyNotes.length} {stickyNotes.length === 1 ? 'nota' : 'notas'})
            </span>
          </CardTitle>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchStickyNotes}
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              onClick={() => setShowCreateForm(true)}
              size="sm"
            >
              <Plus className="w-4 h-4 mr-1" />
              Nueva Nota
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        {/* Formulario de creación */}
        {showCreateForm && (
          <div className="mb-6 p-4 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
            <div className="space-y-3">
              <Textarea
                value={newNoteText}
                onChange={(e) => setNewNoteText(e.target.value)}
                className="min-h-[80px] resize-none"
                placeholder="Escribe tu nota aquí..."
                autoFocus
              />
              
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowColorPicker(!showColorPicker)}
                  className="text-xs"
                >
                  <Palette className="w-3 h-3 mr-1" />
                  Color: {colores.find(c => c.value === newNoteColor)?.nombre}
                </Button>
                
                {/* Selector de color */}
                {showColorPicker && (
                  <div className="flex gap-1">
                    {colores.map((color) => (
                      <button
                        key={color.value}
                        onClick={() => {
                          setNewNoteColor(color.value);
                          setShowColorPicker(false);
                        }}
                        className={`w-6 h-6 rounded border-2 ${color.clase} ${
                          newNoteColor === color.value ? 'ring-2 ring-blue-500' : ''
                        }`}
                        title={color.nombre}
                      />
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleCreateNote}
                  disabled={creating || !newNoteText.trim()}
                >
                  Crear Nota
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancelCreate}
                  disabled={creating}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Lista de sticky notes */}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-6 h-6 animate-spin mr-2" />
            Cargando notas...
          </div>
        ) : stickyNotes.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <StickyNoteIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No hay sticky notes todavía</p>
            <p className="text-sm">Crea tu primera nota para comenzar</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {stickyNotes.map((note) => (
              <StickyNote
                key={note.id}
                note={note}
                onUpdate={handleUpdateNote}
                onDelete={handleDeleteNote}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default StickyNotesContainer;