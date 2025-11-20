import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Fuel as FuelIcon, Trash2, Image as ImageIcon } from "lucide-react";
import { useFuelRecords } from "@/hooks/useFuelRecords";
import { useFleetVehicles } from "@/hooks/useFleetVehicles";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function Fuel() {
  const { fuelRecords, isLoading, deleteFuelRecord } = useFuelRecords();
  const { vehicles } = useFleetVehicles();
  const [selectedReceipt, setSelectedReceipt] = useState<string | null>(null);

  const getVehicleName = (vehicleId: string | null) => {
    if (!vehicleId) return "N/A";
    const vehicle = vehicles.find(v => v.id === vehicleId);
    return vehicle ? `${vehicle.license_plate} - ${vehicle.make} ${vehicle.model}` : "Unknown";
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const totalGallons = fuelRecords.reduce((sum, record) => sum + Number(record.gallons), 0);
  const totalCost = fuelRecords.reduce((sum, record) => sum + Number(record.total_cost), 0);
  const avgPricePerGallon = totalGallons > 0 ? totalCost / totalGallons : 0;

  return (
    <div className="space-y-8 p-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Fuel Management</h2>
        <p className="text-muted-foreground">Track and monitor fleet refueling records</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Gallons</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalGallons.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">All-time total</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalCost)}</div>
            <p className="text-xs text-muted-foreground">All-time spending</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Avg Price/Gallon</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(avgPricePerGallon)}</div>
            <p className="text-xs text-muted-foreground">Average cost</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FuelIcon className="h-5 w-5" />
            Fuel Records
          </CardTitle>
          <CardDescription>Complete history of all refueling transactions</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center text-muted-foreground py-8">Loading fuel records...</p>
          ) : fuelRecords.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No fuel records found</p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Vehicle</TableHead>
                    <TableHead className="text-right">Gallons</TableHead>
                    <TableHead className="text-right">Total Cost</TableHead>
                    <TableHead className="text-right">Price/Gallon</TableHead>
                    <TableHead>Receipt</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fuelRecords.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>{formatDate(record.refuel_date)}</TableCell>
                      <TableCell>{getVehicleName(record.vehicle_id)}</TableCell>
                      <TableCell className="text-right">{Number(record.gallons).toFixed(2)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(Number(record.total_cost))}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(Number(record.total_cost) / Number(record.gallons))}
                      </TableCell>
                      <TableCell>
                        {record.receipt_photo ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedReceipt(record.receipt_photo)}
                          >
                            <ImageIcon className="h-4 w-4" />
                          </Button>
                        ) : (
                          <span className="text-muted-foreground text-sm">No receipt</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {record.notes || "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteFuelRecord.mutate(record.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedReceipt} onOpenChange={() => setSelectedReceipt(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Receipt Image</DialogTitle>
          </DialogHeader>
          {selectedReceipt && (
            <img
              src={selectedReceipt}
              alt="Receipt"
              className="w-full h-auto rounded-lg"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
