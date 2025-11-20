import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Search, Truck, CheckCircle2, AlertCircle, Clock, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { useFleetVehicles } from "@/hooks/useFleetVehicles";
import { useUsers } from "@/hooks/useUsers";
import { useAuth } from "@/contexts/AuthContext";

const vehicleSchema = z.object({
  make: z.string().trim().min(1, "Make is required").max(50, "Make must be less than 50 characters"),
  model: z.string().trim().min(1, "Model is required").max(50, "Model must be less than 50 characters"),
  licensePlate: z.string().trim().min(1, "License plate is required").max(20, "License plate must be less than 20 characters"),
  driverName: z.string().trim().min(1, "Driver name is required").max(100, "Driver name must be less than 100 characters"),
  mpg: z.string().trim().min(1, "MPG is required").refine((val) => !isNaN(Number(val)) && Number(val) > 0, "MPG must be a positive number"),
  inspectionCycle: z.enum(["daily", "weekly"], { errorMap: () => ({ message: "Please select an inspection cycle" }) }),
});

export default function Fleet() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<any>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [formData, setFormData] = useState({
    make: "",
    model: "",
    licensePlate: "",
    driverName: "",
    driverPhone: "",
    mpg: "",
    inspectionCycle: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { toast } = useToast();
  const { vehicles, isLoading, addVehicle, deleteVehicle } = useFleetVehicles();
  const { users, isLoading: usersLoading } = useUsers("Procurement and Logistics");
  const { isAdmin } = useAuth();

  const handleDeleteVehicle = (vehicleId: string, licensePlate: string) => {
    if (!isAdmin) {
      toast({
        title: "Access Denied",
        description: "Only administrators can delete vehicles.",
        variant: "destructive",
      });
      return;
    }
    deleteVehicle.mutate(vehicleId);
  };

  const handleViewDetails = (vehicle: any) => {
    setSelectedVehicle(vehicle);
    setIsDetailsOpen(true);
  };

  // Calculate statistics from real data
  const stats = useMemo(() => {
    const totalVehicles = vehicles.length;
    const activeVehicles = vehicles.filter(v => v.status === 'active').length;
    const maintenanceVehicles = vehicles.filter(v => v.status === 'maintenance').length;
    
    // Count vehicles with inspections due in next 30 days
    const today = new Date();
    const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
    const inspectionsDue = vehicles.filter(v => {
      if (!v.next_inspection_date) return false;
      const nextInspection = new Date(v.next_inspection_date);
      return nextInspection >= today && nextInspection <= thirtyDaysFromNow;
    }).length;

    return [
      {
        title: "Total Vehicles",
        value: totalVehicles.toString(),
        icon: Truck,
        description: "Active fleet count",
      },
      {
        title: "Active",
        value: activeVehicles.toString(),
        icon: CheckCircle2,
        description: "Ready for operations",
      },
      {
        title: "In Maintenance",
        value: maintenanceVehicles.toString(),
        icon: Clock,
        description: "Under service",
      },
      {
        title: "Inspections Due",
        value: inspectionsDue.toString(),
        icon: AlertCircle,
        description: "Next 30 days",
      },
    ];
  }, [vehicles]);

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error for this field when user types
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      vehicleSchema.parse(formData);
      
      // Calculate next inspection date based on cycle
      const today = new Date();
      let nextInspectionDate: Date;
      
      if (formData.inspectionCycle === 'daily') {
        // Tomorrow for daily cycle
        nextInspectionDate = new Date(today);
        nextInspectionDate.setDate(today.getDate() + 1);
      } else {
        // 7 days from now for weekly cycle
        nextInspectionDate = new Date(today);
        nextInspectionDate.setDate(today.getDate() + 7);
      }
      
      // Save to database
      addVehicle.mutate({
        make: formData.make,
        model: formData.model,
        license_plate: formData.licensePlate,
        driver_name: formData.driverName,
        driver_phone: formData.driverPhone,
        mpg: parseFloat(formData.mpg),
        inspection_cycle: formData.inspectionCycle,
        next_inspection_date: nextInspectionDate.toISOString().split('T')[0],
        status: 'active',
        mileage: 0,
      });
      
      // Reset form and close dialog
      setFormData({
        make: "",
        model: "",
        licensePlate: "",
        driverName: "",
        driverPhone: "",
        mpg: "",
        inspectionCycle: "",
      });
      setErrors({});
      setIsDialogOpen(false);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            newErrors[err.path[0].toString()] = err.message;
          }
        });
        setErrors(newErrors);
      }
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-500"><CheckCircle2 className="w-3 h-3 mr-1" />Active</Badge>;
      case "maintenance":
        return <Badge className="bg-yellow-500"><Clock className="w-3 h-3 mr-1" />Maintenance</Badge>;
      case "inactive":
        return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" />Inactive</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Fleet Management</h1>
          <p className="text-muted-foreground">Track and manage your vehicle fleet and inspections</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Vehicle
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Vehicle</DialogTitle>
              <DialogDescription>
                Enter the vehicle details to add it to your fleet.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="make">Vehicle Make *</Label>
                  <Input
                    id="make"
                    value={formData.make}
                    onChange={(e) => handleInputChange("make", e.target.value)}
                    placeholder="e.g., Ford, Toyota"
                    className={errors.make ? "border-destructive" : ""}
                  />
                  {errors.make && <p className="text-sm text-destructive">{errors.make}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="model">Model *</Label>
                  <Input
                    id="model"
                    value={formData.model}
                    onChange={(e) => handleInputChange("model", e.target.value)}
                    placeholder="e.g., Transit, Camry"
                    className={errors.model ? "border-destructive" : ""}
                  />
                  {errors.model && <p className="text-sm text-destructive">{errors.model}</p>}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="licensePlate">License Plate *</Label>
                <Input
                  id="licensePlate"
                  value={formData.licensePlate}
                  onChange={(e) => handleInputChange("licensePlate", e.target.value)}
                  placeholder="e.g., ABC-1234"
                  className={errors.licensePlate ? "border-destructive" : ""}
                />
                {errors.licensePlate && <p className="text-sm text-destructive">{errors.licensePlate}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="driverName">Driver Name *</Label>
                  <Select
                    value={formData.driverName}
                    onValueChange={(value) => {
                      const selectedUser = users.find(u => u.name === value);
                      setFormData({ 
                        ...formData, 
                        driverName: value,
                        driverPhone: selectedUser?.id || ""
                      });
                      setErrors({ ...errors, driverName: "" });
                    }}
                  >
                    <SelectTrigger className={errors.driverName ? "border-destructive" : ""}>
                      <SelectValue placeholder="Select a driver" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.name}>
                          {user.name} ({user.username})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.driverName && <p className="text-sm text-destructive">{errors.driverName}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="mpg">Miles Per Gallon (MPG) *</Label>
                  <Input
                    id="mpg"
                    type="number"
                    step="0.1"
                    value={formData.mpg}
                    onChange={(e) => handleInputChange("mpg", e.target.value)}
                    placeholder="e.g., 18.5"
                    className={errors.mpg ? "border-destructive" : ""}
                  />
                  {errors.mpg && <p className="text-sm text-destructive">{errors.mpg}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="inspectionCycle">Inspection Cycle *</Label>
                  <Select
                    value={formData.inspectionCycle}
                    onValueChange={(value) => handleInputChange("inspectionCycle", value)}
                  >
                    <SelectTrigger className={errors.inspectionCycle ? "border-destructive" : ""}>
                      <SelectValue placeholder="Select inspection cycle" />
                    </SelectTrigger>
                    <SelectContent className="bg-background z-50">
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.inspectionCycle && <p className="text-sm text-destructive">{errors.inspectionCycle}</p>}
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Add Vehicle</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground">{stat.description}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Fleet Table */}
      <Card>
        <CardHeader>
          <CardTitle>Fleet Overview</CardTitle>
          <CardDescription>Manage your vehicles and track inspection schedules</CardDescription>
          <div className="flex items-center gap-2 pt-4">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by vehicle ID or model..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>License Plate</TableHead>
                <TableHead>Make/Model</TableHead>
                <TableHead>Driver</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>MPG</TableHead>
                <TableHead>Inspection Cycle</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Next Inspection</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                    Loading vehicles...
                  </TableCell>
                </TableRow>
              ) : vehicles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                    No vehicles in fleet. Click "Add Vehicle" to get started.
                  </TableCell>
                </TableRow>
              ) : (
                vehicles
                  .filter(
                    (vehicle) =>
                      vehicle.license_plate.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      vehicle.make.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      vehicle.model.toLowerCase().includes(searchQuery.toLowerCase())
                  )
                  .map((vehicle) => (
                    <TableRow key={vehicle.id}>
                      <TableCell className="font-medium">{vehicle.license_plate}</TableCell>
                      <TableCell>{vehicle.make} {vehicle.model}</TableCell>
                      <TableCell>{vehicle.driver_name}</TableCell>
                      <TableCell>{vehicle.driver_phone}</TableCell>
                      <TableCell>{vehicle.mpg} MPG</TableCell>
                      <TableCell>{vehicle.inspection_cycle}</TableCell>
                      <TableCell>{getStatusBadge(vehicle.status)}</TableCell>
                      <TableCell>
                        {vehicle.next_inspection_date
                          ? new Date(vehicle.next_inspection_date).toLocaleDateString()
                          : "Not scheduled"}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => handleViewDetails(vehicle)}>
                            View Details
                          </Button>
                          {isAdmin && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="destructive" size="sm">
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="bg-background z-50">
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Remove Vehicle</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to remove {vehicle.license_plate} ({vehicle.make} {vehicle.model}) from the fleet? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDeleteVehicle(vehicle.id, vehicle.license_plate)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Remove Vehicle
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Vehicle Details Dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-2xl bg-background z-50">
          <DialogHeader>
            <DialogTitle>Vehicle Details</DialogTitle>
            <DialogDescription>
              Complete information for {selectedVehicle?.license_plate}
            </DialogDescription>
          </DialogHeader>
          {selectedVehicle && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-muted-foreground">License Plate</Label>
                  <p className="font-medium">{selectedVehicle.license_plate}</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Status</Label>
                  <div>{getStatusBadge(selectedVehicle.status)}</div>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Make</Label>
                  <p className="font-medium">{selectedVehicle.make}</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Model</Label>
                  <p className="font-medium">{selectedVehicle.model}</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Driver Name</Label>
                  <p className="font-medium">{selectedVehicle.driver_name}</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Driver Phone</Label>
                  <p className="font-medium">{selectedVehicle.driver_phone}</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Miles Per Gallon</Label>
                  <p className="font-medium">{selectedVehicle.mpg} MPG</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Current Mileage</Label>
                  <p className="font-medium">{selectedVehicle.mileage.toLocaleString()} miles</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Inspection Cycle</Label>
                  <p className="font-medium capitalize">{selectedVehicle.inspection_cycle}</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Next Inspection</Label>
                  <p className="font-medium">
                    {selectedVehicle.next_inspection_date
                      ? new Date(selectedVehicle.next_inspection_date).toLocaleDateString()
                      : "Not scheduled"}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Last Inspection</Label>
                  <p className="font-medium">
                    {selectedVehicle.last_inspection_date
                      ? new Date(selectedVehicle.last_inspection_date).toLocaleDateString()
                      : "No previous inspection"}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Added to Fleet</Label>
                  <p className="font-medium">
                    {new Date(selectedVehicle.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDetailsOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
