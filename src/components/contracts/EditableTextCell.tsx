import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Pencil, Check, X } from "lucide-react";

interface EditableTextCellProps {
  value: string;
  onSave: (newValue: string) => Promise<void>;
  disabled?: boolean;
  className?: string;
}

export function EditableTextCell({ value, onSave, disabled = false, className }: EditableTextCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
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
    setEditValue(value);
    setIsEditing(true);
  };

  const handleCancel = () => {
    setEditValue(value);
    setIsEditing(false);
  };

  const handleSave = async () => {
    if (!editValue.trim()) {
      handleCancel();
      return;
    }
    setIsSaving(true);
    try {
      await onSave(editValue.trim());
      setIsEditing(false);
    } catch {
      // Keep editing on error
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
    else if (e.key === 'Escape') handleCancel();
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-1">
        <Input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className="h-7 w-32 text-sm"
          disabled={isSaving}
        />
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleSave} disabled={isSaving}>
          <Check className="h-3.5 w-3.5 text-green-600" />
        </Button>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleCancel} disabled={isSaving}>
          <X className="h-3.5 w-3.5 text-destructive" />
        </Button>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-1 group ${disabled ? '' : 'cursor-pointer'} ${className || ''}`} onClick={handleStartEdit}>
      <span>{value}</span>
      {!disabled && <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />}
    </div>
  );
}
