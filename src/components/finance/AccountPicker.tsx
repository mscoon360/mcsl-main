import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface AccountOption {
  id: string;
  account_number: string;
  account_name: string;
}

interface Props {
  value?: string | null;
  options: AccountOption[];
  placeholder: string;
  disabled?: boolean;
  onChange: (value: string | null) => void;
}

export function AccountPicker({ value, options, placeholder, disabled, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = useMemo(
    () => options.find(o => o.account_number === value),
    [options, value]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      o =>
        o.account_number.toLowerCase().includes(q) ||
        o.account_name.toLowerCase().includes(q)
    );
  }, [options, query]);

  return (
    <div className="flex items-center gap-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            disabled={disabled}
            className="h-9 w-full justify-between font-normal"
          >
            <span className={cn('truncate', !selected && 'text-muted-foreground')}>
              {selected ? `${selected.account_number} — ${selected.account_name}` : placeholder}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[360px] p-0 bg-popover z-50" align="start">
          <div className="p-2 border-b">
            <Input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search account number or name…"
              className="h-8"
            />
          </div>
          <ScrollArea className="h-64">
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-sm text-muted-foreground">No accounts found</div>
            ) : (
              filtered.map(o => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => {
                    onChange(o.account_number);
                    setOpen(false);
                    setQuery('');
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
                >
                  <Check
                    className={cn(
                      'h-4 w-4 shrink-0',
                      o.account_number === value ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <span className="font-mono text-xs">{o.account_number}</span>
                  <span className="truncate">{o.account_name}</span>
                </button>
              ))
            )}
          </ScrollArea>
        </PopoverContent>
      </Popover>
      {value && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          title="Clear"
          onClick={() => onChange(null)}
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
