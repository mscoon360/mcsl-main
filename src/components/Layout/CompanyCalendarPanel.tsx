import { useState } from "react";
import { format, isSameDay } from "date-fns";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, AlertCircle, Truck, Users, FileText } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useExpiringContracts } from "@/hooks/useExpiringContracts";

export function CompanyCalendarPanel() {
  const [collapsed, setCollapsed] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const { expiringContracts } = useExpiringContracts();

  const eventsForDay = selectedDate
    ? expiringContracts.filter((c) => isSameDay(new Date(c.endDate), selectedDate))
    : [];

  if (collapsed) {
    return (
      <aside className="hidden xl:flex flex-col items-center gap-2 border-l border-border bg-sidebar px-2 py-4">
        <Button variant="ghost" size="icon" onClick={() => setCollapsed(false)} aria-label="Open company calendar">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <CalendarIcon className="h-5 w-5 text-primary" />
      </aside>
    );
  }

  return (
    <aside className="hidden xl:flex w-[320px] shrink-0 flex-col border-l border-border bg-sidebar">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <CalendarIcon className="h-4 w-4 text-primary" />
          Company Calendar
        </h2>
        <Button variant="ghost" size="icon" onClick={() => setCollapsed(true)} aria-label="Collapse company calendar">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="p-3">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={setSelectedDate}
          className="rounded-md border pointer-events-auto"
        />
      </div>

      <div className="flex-1 min-h-0 px-4 pb-4">
        <h3 className="mb-2 text-xs font-medium text-muted-foreground">
          {selectedDate ? format(selectedDate, "EEEE, MMM d, yyyy") : "Today"}
        </h3>
        <ScrollArea className="h-[220px] pr-2">
          <div className="space-y-2">
            {eventsForDay.length > 0 ? (
              eventsForDay.map((event) => (
                <div key={event.id} className="flex items-start gap-2 rounded bg-muted/50 p-2">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-500" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{event.product}</p>
                    <p className="truncate text-xs text-muted-foreground">{event.customer} — contract expires</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No events scheduled</p>
            )}

            <div className="mt-4 border-t pt-3">
              <p className="mb-2 text-xs text-muted-foreground">Legend:</p>
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Truck className="h-3 w-3 text-blue-500" /> Deliveries</span>
                <span className="flex items-center gap-1"><Users className="h-3 w-3 text-green-500" /> Installations</span>
                <span className="flex items-center gap-1"><FileText className="h-3 w-3 text-purple-500" /> Training</span>
                <span className="flex items-center gap-1"><CalendarIcon className="h-3 w-3 text-primary" /> Events</span>
              </div>
            </div>
          </div>
        </ScrollArea>
      </div>
    </aside>
  );
}
