import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { DatePreset, DateRange, presetRange } from './reportUtils';

interface Props {
  preset: DatePreset;
  range: DateRange;
  onChange: (preset: DatePreset, range: DateRange) => void;
  presets?: DatePreset[];
}

const ALL_PRESETS: DatePreset[] = ['this-month', 'last-month', 'this-quarter', 'this-year', 'last-year', 'all-time', 'custom'];
const PRESET_LABEL: Record<DatePreset, string> = {
  'this-month': 'This Month',
  'last-month': 'Last Month',
  'this-quarter': 'This Quarter',
  'this-year': 'This Year',
  'last-year': 'Last Year',
  'all-time': 'All Time',
  'custom': 'Custom',
};

export function DateRangePicker({ preset, range, onChange, presets = ALL_PRESETS }: Props) {
  const handlePreset = (p: DatePreset) => {
    onChange(p, p === 'custom' ? range : presetRange(p));
  };

  return (
    <div className="flex flex-wrap gap-2">
      <Select value={preset} onValueChange={(v) => handlePreset(v as DatePreset)}>
        <SelectTrigger className="w-[160px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {presets.map(p => (
            <SelectItem key={p} value={p}>{PRESET_LABEL[p]}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {preset === 'custom' && (
        <>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn('w-[150px] justify-start text-left font-normal', !range.from && 'text-muted-foreground')}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {range.from ? format(range.from, 'PP') : 'From'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar mode="single" selected={range.from ?? undefined} onSelect={(d) => onChange('custom', { ...range, from: d ?? null })} />
            </PopoverContent>
          </Popover>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn('w-[150px] justify-start text-left font-normal', !range.to && 'text-muted-foreground')}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {range.to ? format(range.to, 'PP') : 'To'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar mode="single" selected={range.to ?? undefined} onSelect={(d) => onChange('custom', { ...range, to: d ?? null })} />
            </PopoverContent>
          </Popover>
        </>
      )}
    </div>
  );
}
