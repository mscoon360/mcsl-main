import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useFleetVehicles } from "@/hooks/useFleetVehicles";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, UserCog } from "lucide-react";

interface DriverAssignment {
  id: string;
  user_id: string;
  vehicle_id: string | null;
  driver_name: string;
  driver_license_number: string | null;
  license_expiry_date: string | null;
  driver_contact: string | null;
  backup_driver: string | null;
  assignment_date: string | null;
  responsibility_agreement_signed: boolean;
  notes: string | null;
  created_at: string;
}

const emptyForm = {
  vehicle_id: "",
  driver_name: "",
  driver_license_number: "",
  license_expiry_date: "",
  driver_contact: "",
  backup_driver: "",
  assignment_date: "",
  responsibility_agreement_signed: false,
  notes: "",
};

export default function DriverManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { vehicles } = useFleetVehicles();
  const [assignments, setAssignments] = useState<DriverAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("driver_assignments")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setAssignments(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (user) load();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!form.driver_name.trim()) {
      toast({ title: "Driver name is required", variant: "destructive" });
      return;
    }
    const payload = {
      user_id: user.id,
      vehicle_id: form.vehicle_id || null,
      driver_name: form.driver_name,
      driver_license_number: form.driver_license_number || null,
      license_expiry_date: form.license_expiry_date || null,
      driver_contact: form.driver_contact || null,
      backup_driver: form.backup_driver || null,
      assignment_date: form.assignment_date || null,
      responsibility_agreement_signed: form.responsibility_agreement_signed,
      notes: form.notes || null,
    };
    const { error } = await (supabase as any).from("driver_assignments").insert([payload]);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Driver assigned", description: "Assignment recorded." });
    setForm(emptyForm);
    setOpen(false);
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remove this driver assignment?")) return;
    const { error } = await (supabase as any).from("driver_assignments").delete().eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    load();
  };

  const vehicleLabel = (id: string | null) => {
    if (!id) return "—";
    const v = vehicles.find((x) => x.id === id);
    return v ? `${v.license_plate} · ${v.make} ${v.model}` : "Unknown";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Driver Management</h1>
          <p className="text-muted-foreground">Assign drivers to vehicles and track licenses and agreements</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Assign Driver
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>New Driver Assignment</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Vehicle</Label>
                  <Select value={form.vehicle_id} onValueChange={(v) => setForm({ ...form, vehicle_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select vehicle" /></SelectTrigger>
                    <SelectContent className="bg-background z-50">
                      {vehicles.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.license_plate} — {v.make} {v.model}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Driver Name *</Label>
                  <Input value={form.driver_name} onChange={(e) => setForm({ ...form, driver_name: e.target.value })} placeholder="Full name" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Driver License #</Label>
                  <Input value={form.driver_license_number} onChange={(e) => setForm({ ...form, driver_license_number: e.target.value })} placeholder="License number" />
                </div>
                <div className="space-y-2">
                  <Label>License Expiry Date</Label>
                  <Input type="date" value={form.license_expiry_date} onChange={(e) => setForm({ ...form, license_expiry_date: e.target.value })} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Driver Contact</Label>
                  <Input value={form.driver_contact} onChange={(e) => setForm({ ...form, driver_contact: e.target.value })} placeholder="Phone or email" />
                </div>
                <div className="space-y-2">
                  <Label>Backup Driver</Label>
                  <Input value={form.backup_driver} onChange={(e) => setForm({ ...form, backup_driver: e.target.value })} placeholder="Backup driver name" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Driver Assignment Date</Label>
                  <Input type="date" value={form.assignment_date} onChange={(e) => setForm({ ...form, assignment_date: e.target.value })} />
                </div>
                <div className="flex items-end gap-2 pb-2">
                  <Checkbox
                    id="agreement"
                    checked={form.responsibility_agreement_signed}
                    onCheckedChange={(c) => setForm({ ...form, responsibility_agreement_signed: !!c })}
                  />
                  <Label htmlFor="agreement" className="cursor-pointer">Vehicle Responsibility Agreement Signed</Label>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Notes</Label>
                <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional notes" />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit">Save Assignment</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Assignments</CardTitle>
          <CardDescription>All driver-vehicle assignments</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-center py-8">Loading...</p>
          ) : assignments.length === 0 ? (
            <div className="text-center py-12">
              <UserCog className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">No assignments yet</h3>
              <p className="text-muted-foreground">Click "Assign Driver" to get started.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Driver</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>License #</TableHead>
                  <TableHead>License Expiry</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Backup</TableHead>
                  <TableHead>Assigned</TableHead>
                  <TableHead>Agreement</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignments.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.driver_name}</TableCell>
                    <TableCell>{vehicleLabel(a.vehicle_id)}</TableCell>
                    <TableCell>{a.driver_license_number || "—"}</TableCell>
                    <TableCell>{a.license_expiry_date ? new Date(a.license_expiry_date).toLocaleDateString() : "—"}</TableCell>
                    <TableCell>{a.driver_contact || "—"}</TableCell>
                    <TableCell>{a.backup_driver || "—"}</TableCell>
                    <TableCell>{a.assignment_date ? new Date(a.assignment_date).toLocaleDateString() : "—"}</TableCell>
                    <TableCell>
                      {a.responsibility_agreement_signed ? (
                        <Badge className="bg-green-500">Signed</Badge>
                      ) : (
                        <Badge variant="secondary">Pending</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(a.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
