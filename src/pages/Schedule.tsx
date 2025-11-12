import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';

export default function Schedule() {
  const [date, setDate] = useState<Date | undefined>(new Date());

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Maintenance Schedule</h1>
          <p className="text-muted-foreground">View and manage maintenance schedules</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar View */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Schedule Calendar</CardTitle>
          </CardHeader>
          <CardContent>
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              className="rounded-md border"
            />
          </CardContent>
        </Card>

        {/* Upcoming Maintenance */}
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Maintenance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-center py-12">
                <CalendarIcon className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-semibold">No scheduled maintenance</h3>
                <p className="text-muted-foreground">
                  Maintenance schedules will appear here when contracts are active.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Today's Schedule */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>
              {date ? format(date, 'MMMM d, yyyy') : "Today's Schedule"}
            </CardTitle>
            <Badge variant="outline">0 scheduled</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <CalendarIcon className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">No maintenance scheduled</h3>
            <p className="text-muted-foreground">
              No maintenance activities scheduled for this date.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
