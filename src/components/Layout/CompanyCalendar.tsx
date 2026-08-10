import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Clock, AlertCircle, PartyPopper } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Calendar } from "@/components/ui/calendar";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { format, getYear, isSameDay, differenceInDays, startOfDay, addYears } from "date-fns";
import { Link } from "react-router-dom";

type CalendarEventType = "anniversary" | "end-date" | "milestone";

interface CalendarEvent {
  id: string;
  client: string;
  type: CalendarEventType;
  date: Date;
  label: string;
  description?: string;
  contractId: string;
}

interface RawContract {
  id: string;
  client: string;
  contract_start_date: string | null;
  contract_end_date: string | null;
  value_of_contract_vat: number | null;
  renewal_status: string | null;
}

const PERMISSION_DEPARTMENTS = [
  "finance",
  "executive",
  "operations",
  "group-finance",
];

export function CompanyCalendar() {
  const { user, isAdmin, userDepartment } = useAuth();
  const [contracts, setContracts] = useState<RawContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [open, setOpen] = useState(false);

  const hasAccess = useMemo(() => {
    if (isAdmin) return true;
    if (!userDepartment) return false;
    const dept = userDepartment.toLowerCase();
    return PERMISSION_DEPARTMENTS.some((allowed) => dept.includes(allowed));
  }, [isAdmin, userDepartment]);

  useEffect(() => {
    if (!user || !hasAccess) return;

    const fetchContracts = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("renewal_contracts")
          .select("id, client, contract_start_date, contract_end_date, value_of_contract_vat, renewal_status");

        if (error) throw error;
        setContracts((data as RawContract[]) || []);
      } catch (error) {
        console.error("Error fetching contracts for company calendar:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchContracts();

    const channel = supabase
      .channel("company-calendar-contracts")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "renewal_contracts" },
        fetchContracts
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, hasAccess]);

  const currentYear = getYear(new Date());

  const events = useMemo<CalendarEvent[]>(() => {
    const list: CalendarEvent[] = [];
    const today = startOfDay(new Date());

    contracts.forEach((contract) => {
      const startDate = contract.contract_start_date
        ? new Date(contract.contract_start_date)
        : null;
      const endDate = contract.contract_end_date
        ? new Date(contract.contract_end_date)
        : null;

      // Anniversary: start date recurring in current year
      if (startDate) {
        const anniversaryThisYear = addYears(startDate, currentYear - getYear(startDate));
        list.push({
          id: `${contract.id}-anniversary-${currentYear}`,
          client: contract.client,
          type: "anniversary",
          date: anniversaryThisYear,
          label: "Contract Anniversary",
          description: `Started ${format(startDate, "MMM d, yyyy")}`,
          contractId: contract.id,
        });
      }

      // End date
      if (endDate) {
        const daysUntil = differenceInDays(startOfDay(endDate), today);
        list.push({
          id: `${contract.id}-end`,
          client: contract.client,
          type: "end-date",
          date: endDate,
          label: daysUntil <= 0 ? "Contract Expired" : "Contract End Date",
          description: daysUntil > 0 ? `${daysUntil} day${daysUntil === 1 ? "" : "s"} remaining` : undefined,
          contractId: contract.id,
        });
      }

      // 75% milestone
      if (startDate && endDate) {
        const totalDays = differenceInDays(startOfDay(endDate), startOfDay(startDate));
        const elapsedDays = differenceInDays(today, startOfDay(startDate));
        if (totalDays > 0) {
          const pct = elapsedDays / totalDays;
          if (pct >= 0.75 && pct < 1) {
            list.push({
              id: `${contract.id}-milestone-75`,
              client: contract.client,
              type: "milestone",
              date: new Date(),
              label: "75% Complete",
              description: `Contract is ${Math.round(pct * 100)}% through its term`,
              contractId: contract.id,
            });
          }
        }
      }
    });

    return list.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [contracts, currentYear]);

  // Upcoming events in the next 30 days, excluding past non-anniversary events
  const upcomingEvents = useMemo(() => {
    const today = startOfDay(new Date());
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(today.getDate() + 30);

    return events.filter((event) => {
      const eventDay = startOfDay(event.date);
      const isWithinWindow = eventDay >= today && eventDay <= thirtyDaysFromNow;
      const isPastAnniversary = event.type === "anniversary" && eventDay < today;
      return isWithinWindow || isPastAnniversary;
    });
  }, [events]);

  const eventCount = upcomingEvents.length;

  // Highlight dates on the calendar that have events
  const eventDates = useMemo(() => events.map((event) => event.date), [events]);

  const selectedDayEvents = useMemo(() => {
    if (!selectedDate) return [];
    return events.filter((event) => isSameDay(event.date, selectedDate));
  }, [selectedDate, events]);

  const getEventIcon = (type: CalendarEventType) => {
    switch (type) {
      case "anniversary":
        return <PartyPopper className="h-4 w-4 text-success" />;
      case "end-date":
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      case "milestone":
        return <Clock className="h-4 w-4 text-amber-500" />;
      default:
        return <CalendarDays className="h-4 w-4" />;
    }
  };

  if (!hasAccess) return null;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" title="Company Calendar">
          <CalendarDays className="h-4 w-4 md:h-5 md:w-5" />
          {eventCount > 0 && (
            <span className="absolute -top-1 -right-1 h-3 w-3 md:h-4 md:w-4 rounded-full bg-primary text-[10px] text-primary-foreground flex items-center justify-center font-medium">
              {eventCount > 9 ? "9+" : eventCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 md:w-96 p-0">
        <div className="p-3 pb-0">
          <DropdownMenuLabel className="px-1">Company Calendar</DropdownMenuLabel>
        </div>
        <DropdownMenuSeparator />
        <div className="p-3">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={setSelectedDate}
            className="pointer-events-auto mx-auto"
            modifiers={{
              event: eventDates,
            }}
            modifiersClassNames={{
              event: "bg-primary/10 text-primary font-semibold border border-primary/30 rounded-full",
            }}
          />
        </div>
        <DropdownMenuSeparator />
        <div className="max-h-64 overflow-y-auto p-2">
          {loading ? (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              Loading calendar...
            </div>
          ) : selectedDayEvents.length > 0 ? (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground px-2 pb-1">
                {format(selectedDate!, "MMMM d, yyyy")}
              </p>
              {selectedDayEvents.map((event) => (
                <DropdownMenuItem
                  key={event.id}
                  asChild
                  className="flex flex-col items-start gap-1 p-3 cursor-pointer"
                >
                  <Link to={`/rental-agreements`} onClick={() => setOpen(false)}>
                    <div className="flex items-center gap-2 w-full">
                      {getEventIcon(event.type)}
                      <span className="font-medium text-sm flex-1">{event.client}</span>
                    </div>
                    <p className="text-xs text-muted-foreground pl-6">{event.label}</p>
                    {event.description && (
                      <p className="text-xs text-muted-foreground pl-6">{event.description}</p>
                    )}
                  </Link>
                </DropdownMenuItem>
              ))}
            </div>
          ) : upcomingEvents.length > 0 ? (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground px-2 pb-1">
                Upcoming in the next 30 days
              </p>
              {upcomingEvents.slice(0, 10).map((event) => (
                <DropdownMenuItem
                  key={event.id}
                  asChild
                  className="flex flex-col items-start gap-1 p-3 cursor-pointer"
                >
                  <Link to={`/rental-agreements`} onClick={() => setOpen(false)}>
                    <div className="flex items-center gap-2 w-full">
                      {getEventIcon(event.type)}
                      <span className="font-medium text-sm flex-1">{event.client}</span>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {format(event.date, "MMM d")}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground pl-6">{event.label}</p>
                    {event.description && (
                      <p className="text-xs text-muted-foreground pl-6">{event.description}</p>
                    )}
                  </Link>
                </DropdownMenuItem>
              ))}
            </div>
          ) : (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              No upcoming contract events
            </div>
          )}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="justify-center font-medium cursor-pointer">
          <Link to="/rental-agreements" onClick={() => setOpen(false)}>
            View All Contracts
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
