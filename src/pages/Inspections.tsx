import { useState } from "react";
import { useInspections } from "@/hooks/useInspections";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CheckCircle2, XCircle, Image as ImageIcon } from "lucide-react";
import { format } from "date-fns";

const Inspections = () => {
  const { inspections, isLoading, updateInspectionStatus } = useInspections();
  const { isAdmin } = useAuth();
  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([]);
  const [showPhotoDialog, setShowPhotoDialog] = useState(false);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);

  const handleViewPhotos = (photos: string[]) => {
    setSelectedPhotos(photos);
    setCurrentPhotoIndex(0);
    setShowPhotoDialog(true);
  };

  const handleStatusUpdate = async (id: string, status: "passed" | "failed") => {
    await updateInspectionStatus.mutateAsync({ id, status });
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
      <div>
        <h1 className="text-3xl font-bold">Vehicle Inspections</h1>
        <p className="text-muted-foreground">Review and manage vehicle inspection reports</p>
      </div>

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
