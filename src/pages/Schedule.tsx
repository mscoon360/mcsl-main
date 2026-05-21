import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format, isSameDay, startOfDay } from 'date-fns';
import { Calendar as CalendarIcon, ClipboardCheck, Wrench, ArrowRight, AlertTriangle, Truck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useFleetVehicles } from '@/hooks/useFleetVehicles';
import { useVehicleParts } from '@/hooks/useVehicleParts';

type ScheduleKind = 'inspection' | 'part';

interface ScheduleItem {
  id: string;
  kind: ScheduleKind;
  date: Date;
  title: string;
  subtitle: string;
  vehicleId?: string;
}

export default function Schedule() {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [kindFilter, setKindFilter] = useState<'all' | ScheduleKind>('all');
  const { vehicles } = useFleetVehicles();
  const { vehicleParts } = useVehicleParts();
  const navigate = useNavigate();

  const vehicleById = useMemo(() => {
    const m = new Map<string, typeof vehicles[number]>();
    vehicles.forEach(v => m.set(v.id, v));
    return m;
  }, [vehicles]);

  const items: ScheduleItem[] = useMemo(() => {
    const out: ScheduleItem[] = [];

    vehicles.forEach(v => {
      if (!v.next_inspection_date) return;
      out.push({
        id: `inspection-${v.id}`,
        kind: 'inspection',
        date: startOfDay(new Date(v.next_inspection_date)),
        title: `${v.make} ${v.model} — ${v.license_plate}`,
        subtitle: `${v.inspection_cycle === 'daily' ? 'Daily' : 'Weekly'} inspection due`,
        vehicleId: v.id,
      });
    });

    vehicleParts.forEach(p => {
      if (!p.next_replacement_date) return;
      const v = vehicleById.get(p.vehicle_id);
      out.push({
        id: `part-${p.id}`,
        kind: 'part',
        date: startOfDay(new Date(p.next_replacement_date)),
        title: p.part_name + (p.part_category ? ` (${p.part_category})` : ''),
        subtitle: v ? `${v.make} ${v.model} — ${v.license_plate}` : 'Unknown vehicle',
        vehicleId: p.vehicle_id,
      });
    });

    return out.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [vehicles, vehicleParts, vehicleById]);

  const filteredItems = useMemo(
    () => items.filter(i => kindFilter === 'all' || i.kind === kindFilter),
    [items, kindFilter]
  );

  const today = startOfDay(new Date());
  const overdue = filteredItems.filter(i => i.date < today);
  const upcoming30 = filteredItems.filter(i => {
    const days = Math.floor((i.date.getTime() - today.getTime()) / 86400000);
    return days >= 0 && days <= 30;
  });
  const itemsOnSelectedDate = date ? filteredItems.filter(i => isSameDay(i.date, date)) : [];
  const datesWithItems = useMemo(() => filteredItems.map(i => i.date), [filteredItems]);

  const kindMeta = (k: ScheduleKind) =>
    k === 'inspection'
      ? { icon: ClipboardCheck, color: 'text-blue-600', bg: 'bg-blue-500/10', label: 'Inspection' }
      : { icon: Wrench, color: 'text-amber-600', bg: 'bg-amber-500/10', label: 'Part Replacement' };

  const goTo = (item: ScheduleItem) => {
    navigate(item.kind === 'inspection' ? '/inspections' : '/parts');
  };

  const renderItemRow = (item: ScheduleItem) => {
    const meta = kindMeta(item.kind);
    const Icon = meta.icon;
    const days = Math.floor((item.date.getTime() - today.getTime()) / 86400000);
    const dueLabel =
      days < 0 ? `${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} overdue`
      : days === 0 ? 'Today'
      : days === 1 ? 'Tomorrow'
      : `in ${days} days`;

    return (
      <button
        key={item.id}
        onClick={() => goTo(item)}
        className="w-full flex items-start gap-3 p-3 rounded-md hover:bg-muted/60 transition-colors text-left border"
      >
        <div className={`p-2 rounded-md ${meta.bg}`}>
          <Icon className={`h-4 w-4 ${meta.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">{item.title}</span>
            <Badge variant="outline" className="text-[10px]">{meta.label}</Badge>
            {days < 0 && (
              <Badge variant="destructive" className="text-[10px]">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Overdue
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{item.subtitle}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{format(item.date, 'PP')} · {dueLabel}</p>
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 mt-2" />
      </button>
    );
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold">Maintenance Schedule</h1>
          <p className="text-muted-foreground">Upcoming vehicle inspections and parts replacements</p>
        </div>
        <Tabs value={kindFilter} onValueChange={(v) => setKindFilter(v as any)}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="inspection">Inspections</TabsTrigger>
            <TabsTrigger value="part">Parts</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-destructive/10"><AlertTriangle className="h-5 w-5 text-destructive" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Overdue</p>
                <p className="text-2xl font-bold">{overdue.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-blue-500/10"><ClipboardCheck className="h-5 w-5 text-blue-600" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Next 30 days</p>
                <p className="text-2xl font-bold">{upcoming30.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-muted"><Truck className="h-5 w-5" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Vehicles tracked</p>
                <p className="text-2xl font-bold">{vehicles.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Schedule Calendar</CardTitle></CardHeader>
          <CardContent>
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              modifiers={{ scheduled: datesWithItems }}
              modifiersClassNames={{ scheduled: 'bg-primary/15 text-primary font-semibold' }}
              className="rounded-md border"
            />
            <p className="text-xs text-muted-foreground mt-3">
              Highlighted dates have an inspection or parts replacement scheduled.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Upcoming (next 30 days)</CardTitle></CardHeader>
          <CardContent>
            {upcoming30.length === 0 ? (
              <div className="text-center py-8">
                <CalendarIcon className="mx-auto h-10 w-10 text-muted-foreground" />
                <p className="mt-3 text-sm text-muted-foreground">Nothing scheduled in the next 30 days.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[420px] overflow-auto pr-1">
                {upcoming30.map(renderItemRow)}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {overdue.length > 0 && (
        <Card className="border-destructive/40">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-destructive flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Overdue
              </CardTitle>
              <Badge variant="destructive">{overdue.length}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">{overdue.map(renderItemRow)}</div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{date ? format(date, 'EEEE, MMMM d, yyyy') : 'Selected date'}</CardTitle>
            <Badge variant="outline">{itemsOnSelectedDate.length} scheduled</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {itemsOnSelectedDate.length === 0 ? (
            <div className="text-center py-8">
              <CalendarIcon className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="mt-3 text-sm text-muted-foreground">Nothing scheduled for this date.</p>
            </div>
          ) : (
            <div className="space-y-2">{itemsOnSelectedDate.map(renderItemRow)}</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
