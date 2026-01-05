import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, X } from 'lucide-react';

interface SortableImageProps {
  id: string;
  url: string;
  index: number;
  onRemove: (index: number) => void;
}

const SortableImage = ({ id, url, index, onRemove }: SortableImageProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.8 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative group aspect-video ${isDragging ? 'ring-2 ring-primary' : ''}`}
    >
      <img
        src={url}
        alt={`Vehicle ${index + 1}`}
        className="w-full h-full object-cover rounded"
      />
      
      {/* Drag Handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute top-1 right-1 p-1.5 bg-black/70 rounded cursor-grab active:cursor-grabbing touch-none"
      >
        <GripVertical className="w-4 h-4 text-white" />
      </div>
      
      {/* Remove Button */}
      <button
        type="button"
        onClick={() => onRemove(index)}
        className="absolute top-1 left-1 p-1.5 bg-destructive rounded opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <X className="w-4 h-4 text-white" />
      </button>
      
      {/* Cover Badge */}
      {index === 0 && (
        <span className="absolute bottom-1 left-1 bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded font-medium">
          Cover
        </span>
      )}
    </div>
  );
};

export default SortableImage;