import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Pencil, Check, X } from "lucide-react";

interface EditableValueCellProps {
  value: number;
  formatValue?: (value: number) => string;
  onSave: (newValue: number) => Promise<void>;
  disabled?: boolean;
}

export function EditableValueCell({ 
  value, 
  formatValue = (v) => `$${v.toFixed(2)}`, 
  onSave,
  disabled = false 
}: EditableValueCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(String(value));
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleStartEdit = () => {
    if (disabled) return;
    setEditValue(String(value));
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setEditValue(String(value));
    setIsEditing(false);
  };

  const handleSaveEdit = async () => {
    const newValue = parseFloat(editValue);
    if (isNaN(newValue) || newValue < 0) {
      handleCancelEdit();
      return;
    }

    setIsSaving(true);
    try {
      await onSave(newValue);
      setIsEditing(false);
    } catch (error) {
      // Keep editing state on error
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-1">
        <span className="text-muted-foreground">$</span>
        <Input
          ref={inputRef}
          type="number"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className="h-7 w-24 text-sm"
          min="0"
          step="0.01"
          disabled={isSaving}
        />
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={handleSaveEdit}
          disabled={isSaving}
        >
          <Check className="h-3.5 w-3.5 text-green-600" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={handleCancelEdit}
          disabled={isSaving}
        >
          <X className="h-3.5 w-3.5 text-destructive" />
        </Button>
      </div>
    );
  }

  return (
    <div 
      className={`flex items-center gap-1 group ${disabled ? '' : 'cursor-pointer'}`} 
      onClick={handleStartEdit}
    >
      <span>{formatValue(value)}</span>
      {!disabled && (
        <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      )}
    </div>
  );
}
