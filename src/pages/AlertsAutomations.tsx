import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Bell, Calendar, Gauge, ShieldCheck, Wrench, Package, Sparkles } from "lucide-react";

interface Vehicle {
  id: string;
  make: string;
  model: string;
  license_plate: string;
  driver_name?: string | null;
  mileage?: number | null;
  current_mileage?: number | null;
  next_inspection_date?: string | null;
  next_service_date?: string | null;
  last_service_date?: string | null;
  tire_change_date?: string | null;
  battery_change_date?: string | null;
  brake_service_date?: string | null;
  insurance_expiry_date?: string | null;
  oil_change_interval?: number | null;
  maintenance_status?: string | null;
  status?: string | null;
}

type Severity = "overdue" | "due-soon" | "ok";

interface AlertItem {
  vehicleId: string;
  vehicleLabel: string;
  type: string;
  message: string;
  severity: Severity;
  date?: string | null;
}

const daysBetween = (target: Date, today = new Date()) =>
  Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

const dateAlert = (dateStr: string | null | undefined, type: string, vehicle: Vehicle, warnDays = 14): AlertItem | null => {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const days = daysBetween(d);
  let severity: Severity = "ok";
  if (days < 0) severity = "overdue";
  else if (days <= warnDays) severity = "due-soon";
  if (severity === "ok") return null;
  const label = `${vehicle.make} ${vehicle.model} (${vehicle.license_plate})`;
  const message =
    severity === "overdue"
      ? `${type} overdue by ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"}`
      : `${type} due in ${days} day${days === 1 ? "" : "s"}`;
  return { vehicleId: vehicle.id, vehicleLabel: label, type, message, severity, date: dateStr };
};

const severityBadge = (s: Severity) => {
  if (s === "overdue") return <Badge variant="destructive">Overdue</Badge>;
  if (s === "due-soon") return <Badge className="bg-amber-500 hover:bg-amber-500 text-white">Due Soon</Badge>;
  return <Badge variant="secondary">OK</Badge>;
};

const CLEANLINESS_KEY = "vehicle-cleanliness-status";
type Cleanliness = "Clean" | "Needs Cleaning" | "Sanitized";

export default function AlertsAutomations() {
  const { user } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [mileageThreshold, setMileageThreshold] = useState<number>(150000);
  const [cleanliness, setCleanliness] = useState<Record<string, Cleanliness>>({});

  useEffect(() => {
    const stored = localStorage.getItem(CLEANLINESS_KEY);
    if (stored) {
      try { setCleanliness(JSON.parse(stored)); } catch {}
    }
  }, []);

  const setVehicleCleanliness = (id: string, status: Cleanliness) => {
    setCleanliness((prev) => {
      const next = { ...prev, [id]: status };
      localStorage.setItem(CLEANLINESS_KEY, JSON.stringify(next));
      return next;
    });
  };

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data } = await (supabase as any)
        .from("fleet_vehicles")
        .select("*")
        .order("created_at", { ascending: false });
      setVehicles((data as Vehicle[]) || []);
      setLoading(false);
    })();
  }, [user]);

  const alerts = useMemo<AlertItem[]>(() => {
    const out: AlertItem[] = [];
    for (const v of vehicles) {
      const service = dateAlert(v.next_service_date, "Service Reminder", v, 14);
      if (service) out.push(service);

      const insurance = dateAlert(v.insurance_expiry_date, "Insurance Expiry", v, 30);
      if (insurance) out.push(insurance);

      const inspection = dateAlert(v.next_inspection_date, "Inspection Due", v, 14);
      if (inspection) out.push(inspection);

      // Tire replacement: warn 2 years after last tire change
      if (v.tire_change_date) {
        const d = new Date(v.tire_change_date);
        const dueDate = new Date(d.getFullYear() + 2, d.getMonth(), d.getDate());
        const tire = dateAlert(dueDate.toISOString(), "Tire Replacement", v, 30);
        if (tire) out.push(tire);
      }

      const currentMiles = v.current_mileage ?? v.mileage ?? 0;
      if (currentMiles >= mileageThreshold) {
        out.push({
          vehicleId: v.id,
          vehicleLabel: `${v.make} ${v.model} (${v.license_plate})`,
          type: "Mileage Threshold",
          message: `Mileage ${currentMiles.toLocaleString()} exceeds threshold ${mileageThreshold.toLocaleString()}`,
          severity: "overdue",
        });
      } else if (currentMiles >= mileageThreshold * 0.9) {
        out.push({
          vehicleId: v.id,
          vehicleLabel: `${v.make} ${v.model} (${v.license_plate})`,
          type: "Mileage Threshold",
          message: `Mileage ${currentMiles.toLocaleString()} approaching threshold ${mileageThreshold.toLocaleString()}`,
          severity: "due-soon",
        });
      }
    }
    // Sort: overdue first
    return out.sort((a, b) => (a.severity === "overdue" ? -1 : 1));
  }, [vehicles, mileageThreshold]);

  const counts = useMemo(() => ({
    overdue: alerts.filter((a) => a.severity === "overdue").length,
    dueSoon: alerts.filter((a) => a.severity === "due-soon").length,
    total: alerts.length,
  }), [alerts]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Bell className="h-7 w-7 text-primary" />
            Alerts & Automations
          </h1>
          <p className="text-muted-foreground text-sm">
            Automated reminders for fleet maintenance, compliance, and operational status.
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Overdue</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{counts.overdue}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Due Soon</CardTitle>
            <Calendar className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-500">{counts.dueSoon}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Active Alerts</CardTitle>
            <Bell className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{counts.total}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="alerts" className="space-y-4">
        <TabsList>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
          <TabsTrigger value="equipment">Equipment Assigned</TabsTrigger>
          <TabsTrigger value="cleanliness">Vehicle Cleanliness</TabsTrigger>
        </TabsList>

        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Gauge className="h-4 w-4" /> Mileage Threshold Setting
              </CardTitle>
              <CardDescription>Vehicles exceeding this mileage will trigger an alert.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3 max-w-sm">
                <Label htmlFor="threshold" className="whitespace-nowrap">Threshold (mi)</Label>
                <Input
                  id="threshold"
                  type="number"
                  value={mileageThreshold}
                  onChange={(e) => setMileageThreshold(Number(e.target.value) || 0)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Active Alerts</CardTitle>
              <CardDescription>
                Service, insurance, inspection, tire, and mileage alerts across the fleet.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : alerts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <ShieldCheck className="h-10 w-10 text-emerald-500 mb-2" />
                  <p className="font-medium">All clear</p>
                  <p className="text-sm text-muted-foreground">No alerts at this time.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Severity</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Vehicle</TableHead>
                      <TableHead>Details</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {alerts.map((a, i) => (
                      <TableRow key={`${a.vehicleId}-${a.type}-${i}`}>
                        <TableCell>{severityBadge(a.severity)}</TableCell>
                        <TableCell className="font-medium">{a.type}</TableCell>
                        <TableCell>{a.vehicleLabel}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{a.message}</TableCell>
                        <TableCell className="text-sm">
                          {a.date ? new Date(a.date).toLocaleDateString() : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="equipment">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="h-4 w-4" /> Equipment Assigned
              </CardTitle>
              <CardDescription>All fleet equipment currently registered.</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : vehicles.length === 0 ? (
                <p className="text-sm text-muted-foreground">No equipment registered.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Make / Model</TableHead>
                      <TableHead>License Plate</TableHead>
                      <TableHead>Driver</TableHead>
                      <TableHead>Mileage</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vehicles.map((v) => (
                      <TableRow key={v.id}>
                        <TableCell className="font-medium">{v.make} {v.model}</TableCell>
                        <TableCell>{v.license_plate}</TableCell>
                        <TableCell>{v.driver_name || "—"}</TableCell>
                        <TableCell>{(v.current_mileage ?? v.mileage ?? 0).toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{v.status || "active"}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cleanliness">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4" /> Vehicle Cleanliness Status
              </CardTitle>
              <CardDescription>Track cleanliness state per vehicle.</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : vehicles.length === 0 ? (
                <p className="text-sm text-muted-foreground">No vehicles registered.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vehicle</TableHead>
                      <TableHead>License Plate</TableHead>
                      <TableHead>Current Status</TableHead>
                      <TableHead className="w-[200px]">Update</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vehicles.map((v) => {
                      const status = cleanliness[v.id] || "Clean";
                      const badgeClass =
                        status === "Sanitized"
                          ? "bg-emerald-500 hover:bg-emerald-500 text-white"
                          : status === "Needs Cleaning"
                          ? "bg-amber-500 hover:bg-amber-500 text-white"
                          : "bg-sky-500 hover:bg-sky-500 text-white";
                      return (
                        <TableRow key={v.id}>
                          <TableCell className="font-medium">{v.make} {v.model}</TableCell>
                          <TableCell>{v.license_plate}</TableCell>
                          <TableCell>
                            <Badge className={badgeClass}>{status}</Badge>
                          </TableCell>
                          <TableCell>
                            <Select
                              value={status}
                              onValueChange={(val) => setVehicleCleanliness(v.id, val as Cleanliness)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Clean">Clean</SelectItem>
                                <SelectItem value="Needs Cleaning">Needs Cleaning</SelectItem>
                                <SelectItem value="Sanitized">Sanitized</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
