import { useState } from "react";
import { useInspections } from "@/hooks/useInspections";
import { useFleetVehicles } from "@/hooks/useFleetVehicles";
import { useAuth } from "@/contexts/AuthContext";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, XCircle, Image as ImageIcon, Plus, Upload, X } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const Inspections = () => {
  const { inspections, isLoading, addInspection, updateInspectionStatus } = useInspections();
  const { vehicles } = useFleetVehicles();
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([]);
  const [showPhotoDialog, setShowPhotoDialog] = useState(false);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newInspection, setNewInspection] = useState<{
    vehicle_id: string;
    inspection_date: string;
    status: "pending" | "passed" | "failed";
    notes: string;
  }>({
    vehicle_id: "",
    inspection_date: new Date().toISOString().split("T")[0],
    status: "pending",
    notes: "",
  });
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  const handleViewPhotos = (photos: string[]) => {
    setSelectedPhotos(photos);
    setCurrentPhotoIndex(0);
    setShowPhotoDialog(true);
  };

  const handleStatusUpdate = async (id: string, status: "passed" | "failed") => {
    await updateInspectionStatus.mutateAsync({ id, status });
  };

  const resetAddForm = () => {
    setNewInspection({
      vehicle_id: "",
      inspection_date: new Date().toISOString().split("T")[0],
      status: "pending",
      notes: "",
    });
    setPhotoFiles([]);
  };

  const handleCreate = async () => {
    if (!newInspection.vehicle_id) {
      toast({ title: "Vehicle required", description: "Select a vehicle for the inspection.", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const photoUrls: string[] = [];
      for (const file of photoFiles) {
        const ext = file.name.split(".").pop();
        const path = `inspections/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: upErr } = await supabase.storage.from("inspection-photos").upload(path, file);
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("inspection-photos").getPublicUrl(path);
        photoUrls.push(pub.publicUrl);
      }
      await addInspection.mutateAsync({
        vehicle_id: newInspection.vehicle_id,
        inspection_date: newInspection.inspection_date,
        status: newInspection.status,
        notes: newInspection.notes || null,
        photos: photoUrls,
      });
      setShowAddDialog(false);
      resetAddForm();
    } catch (e: any) {
      toast({ title: "Failed to add inspection", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "passed":
        return "bg-green-500";
      case "failed":
        return "bg-red-500";
      default:
        return "bg-yellow-500";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold">Vehicle Inspections</h1>
          <p className="text-muted-foreground">Review and manage vehicle inspection reports</p>
        </div>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Inspection
        </Button>
      </div>

      <Dialog open={showAddDialog} onOpenChange={(o) => { setShowAddDialog(o); if (!o) resetAddForm(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New Inspection</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label>Vehicle *</Label>
              <Select value={newInspection.vehicle_id} onValueChange={(v) => setNewInspection({ ...newInspection, vehicle_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder={vehicles.length === 0 ? "No vehicles in fleet" : "Select a vehicle"} />
                </SelectTrigger>
                <SelectContent>
                  {vehicles.map(v => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.license_plate} — {v.make} {v.model}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date *</Label>
                <Input
                  type="date"
                  value={newInspection.inspection_date}
                  onChange={(e) => setNewInspection({ ...newInspection, inspection_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={newInspection.status} onValueChange={(v) => setNewInspection({ ...newInspection, status: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending review</SelectItem>
                    <SelectItem value="passed">Passed</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={newInspection.notes}
                onChange={(e) => setNewInspection({ ...newInspection, notes: e.target.value })}
                placeholder="Anything noteworthy from this inspection"
              />
            </div>
            <div className="space-y-2">
              <Label>Photos</Label>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" asChild>
                  <label className="cursor-pointer">
                    <Upload className="h-4 w-4 mr-2" />
                    Add photos
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files) setPhotoFiles(prev => [...prev, ...Array.from(e.target.files!)]);
                      }}
                    />
                  </label>
                </Button>
                <span className="text-xs text-muted-foreground">
                  {photoFiles.length === 0 ? "No photos selected" : `${photoFiles.length} photo${photoFiles.length === 1 ? "" : "s"} ready`}
                </span>
              </div>
              {photoFiles.length > 0 && (
                <ul className="space-y-1">
                  {photoFiles.map((f, i) => (
                    <li key={i} className="flex items-center justify-between text-xs text-muted-foreground border rounded px-2 py-1">
                      <span className="truncate">{f.name}</span>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setPhotoFiles(prev => prev.filter((_, j) => j !== i))}>
                        <X className="h-3 w-3" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddDialog(false); resetAddForm(); }} disabled={uploading}>Cancel</Button>
            <Button onClick={handleCreate} disabled={uploading || !newInspection.vehicle_id}>
              {uploading ? "Saving…" : "Save Inspection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Vehicle</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead>Photos</TableHead>
              <TableHead>Reviewed</TableHead>
              {isAdmin && <TableHead>Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={isAdmin ? 7 : 6} className="text-center">
                  Loading inspections...
                </TableCell>
              </TableRow>
            ) : inspections.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isAdmin ? 7 : 6} className="text-center">
                  No inspections found
                </TableCell>
              </TableRow>
            ) : (
              inspections.map((inspection: any) => (
                <TableRow key={inspection.id}>
                  <TableCell>
                    {format(new Date(inspection.inspection_date), "MMM dd, yyyy HH:mm")}
                  </TableCell>
                  <TableCell>
                    {inspection.fleet_vehicles ? (
                      <div>
                        <div className="font-medium">
                          {inspection.fleet_vehicles.make} {inspection.fleet_vehicles.model}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {inspection.fleet_vehicles.license_plate}
                        </div>
                      </div>
                    ) : (
                      "N/A"
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(inspection.status)}>
                      {inspection.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-xs truncate">
                    {inspection.notes || "-"}
                  </TableCell>
                  <TableCell>
                    {inspection.photos && inspection.photos.length > 0 ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewPhotos(inspection.photos)}
                      >
                        <ImageIcon className="h-4 w-4 mr-2" />
                        View ({inspection.photos.length})
                      </Button>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell>
                    {inspection.reviewed_at
                      ? format(new Date(inspection.reviewed_at), "MMM dd, yyyy")
                      : "-"}
                  </TableCell>
                  {isAdmin && (
                    <TableCell>
                      {inspection.status === "pending" && (
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleStatusUpdate(inspection.id, "passed")}
                            disabled={updateInspectionStatus.isPending}
                          >
                            <CheckCircle2 className="h-4 w-4 mr-1" />
                            Pass
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleStatusUpdate(inspection.id, "failed")}
                            disabled={updateInspectionStatus.isPending}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Fail
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={showPhotoDialog} onOpenChange={setShowPhotoDialog}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              Inspection Photos ({currentPhotoIndex + 1} of {selectedPhotos.length})
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedPhotos.length > 0 && (
              <>
                <img
                  src={selectedPhotos[currentPhotoIndex]}
                  alt={`Inspection photo ${currentPhotoIndex + 1}`}
                  className="w-full h-auto rounded-lg"
                />
                {selectedPhotos.length > 1 && (
                  <div className="flex justify-center gap-2">
                    <Button
                      variant="outline"
                      onClick={() =>
                        setCurrentPhotoIndex((prev) =>
                          prev > 0 ? prev - 1 : selectedPhotos.length - 1
                        )
                      }
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() =>
                        setCurrentPhotoIndex((prev) =>
                          prev < selectedPhotos.length - 1 ? prev + 1 : 0
                        )
                      }
                    >
                      Next
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Inspections;
