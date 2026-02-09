import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Pencil } from "lucide-react";
import { format } from "date-fns";

interface EditableDateCellProps {
  value: Date;
  onSave: (newValue: Date) => Promise<void>;
  disabled?: boolean;
  dateFormat?: string;
}

export function EditableDateCell({ value, onSave, disabled = false, dateFormat = 'MMM dd, yyyy' }: EditableDateCellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSelect = async (date: Date | undefined) => {
    if (!date) return;
    setIsSaving(true);
    try {
      await onSave(date);
      setIsOpen(false);
    } catch {
      // Keep open on error
    } finally {
      setIsSaving(false);
    }
  };

  if (disabled) {
    return <span>{format(value, dateFormat)}</span>;
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <div className="flex items-center gap-1 group cursor-pointer">
          <span>{format(value, dateFormat)}</span>
          <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <CalendarComponent
          mode="single"
          selected={value}
          onSelect={handleSelect}
          initialFocus
          disabled={isSaving}
        />
      </PopoverContent>
    </Popover>
  );
}
