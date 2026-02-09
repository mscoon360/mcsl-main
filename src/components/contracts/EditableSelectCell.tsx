import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pencil } from "lucide-react";

interface EditableSelectCellProps {
  value: string;
  options: { value: string; label: string }[];
  onSave: (newValue: string) => Promise<void>;
  disabled?: boolean;
  displayValue?: string;
}

export function EditableSelectCell({ value, options, onSave, disabled = false, displayValue }: EditableSelectCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleStartEdit = () => {
    if (disabled) return;
    setIsEditing(true);
  };

  const handleChange = async (newValue: string) => {
    if (newValue === value) {
      setIsEditing(false);
      return;
    }
    setIsSaving(true);
    try {
      await onSave(newValue);
      setIsEditing(false);
    } catch {
      // Keep editing on error
    } finally {
      setIsSaving(false);
    }
  };

  if (isEditing) {
    return (
      <Select value={value} onValueChange={handleChange} disabled={isSaving} open defaultOpen onOpenChange={(open) => { if (!open) setIsEditing(false); }}>
        <SelectTrigger className="h-7 w-32 text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map(opt => (
            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  return (
    <div className={`flex items-center gap-1 group ${disabled ? '' : 'cursor-pointer'}`} onClick={handleStartEdit}>
      <span className="capitalize">{displayValue || value}</span>
      {!disabled && <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />}
    </div>
  );
}
