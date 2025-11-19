import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Search, Truck, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

const vehicleSchema = z.object({
  make: z.string().trim().min(1, "Make is required").max(50, "Make must be less than 50 characters"),
  model: z.string().trim().min(1, "Model is required").max(50, "Model must be less than 50 characters"),
  licensePlate: z.string().trim().min(1, "License plate is required").max(20, "License plate must be less than 20 characters"),
  driverName: z.string().trim().min(1, "Driver name is required").max(100, "Driver name must be less than 100 characters"),
  driverPhone: z.string().trim().min(10, "Phone number must be at least 10 digits").max(20, "Phone number must be less than 20 characters"),
  mpg: z.string().trim().min(1, "MPG is required").refine((val) => !isNaN(Number(val)) && Number(val) > 0, "MPG must be a positive number"),
  inspectionCycle: z.string().trim().min(1, "Inspection cycle is required").max(50, "Inspection cycle must be less than 50 characters"),
});

export default function Fleet() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
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

  // Mock data for fleet vehicles
  const fleetData: any[] = [];

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
      
      // Success - here you would normally save to database
      toast({
        title: "Vehicle Added",
        description: `${formData.make} ${formData.model} has been added to the fleet.`,
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

  const stats = [
    {
      title: "Total Vehicles",
      value: "12",
      icon: Truck,
      description: "Active fleet count",
    },
    {
      title: "Active",
      value: "10",
      icon: CheckCircle2,
      description: "Ready for operations",
    },
    {
      title: "In Maintenance",
      value: "2",
      icon: Clock,
      description: "Under service",
    },
    {
      title: "Inspections Due",
      value: "3",
      icon: AlertCircle,
      description: "Next 30 days",
    },
  ];

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
                  <Input
                    id="driverName"
                    value={formData.driverName}
                    onChange={(e) => handleInputChange("driverName", e.target.value)}
                    placeholder="e.g., John Smith"
                    className={errors.driverName ? "border-destructive" : ""}
                  />
                  {errors.driverName && <p className="text-sm text-destructive">{errors.driverName}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="driverPhone">Driver Phone *</Label>
                  <Input
                    id="driverPhone"
                    value={formData.driverPhone}
                    onChange={(e) => handleInputChange("driverPhone", e.target.value)}
                    placeholder="e.g., (555) 123-4567"
                    className={errors.driverPhone ? "border-destructive" : ""}
                  />
                  {errors.driverPhone && <p className="text-sm text-destructive">{errors.driverPhone}</p>}
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
                  <Input
                    id="inspectionCycle"
                    value={formData.inspectionCycle}
                    onChange={(e) => handleInputChange("inspectionCycle", e.target.value)}
                    placeholder="e.g., Every 3 months"
                    className={errors.inspectionCycle ? "border-destructive" : ""}
                  />
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
              {fleetData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                    No vehicles in fleet. Click "Add Vehicle" to get started.
                  </TableCell>
                </TableRow>
              ) : (
                fleetData.map((vehicle) => (
                  <TableRow key={vehicle.id}>
                    <TableCell className="font-medium">{vehicle.licensePlate}</TableCell>
                    <TableCell>{vehicle.make} {vehicle.model}</TableCell>
                    <TableCell>{vehicle.driverName}</TableCell>
                    <TableCell>{vehicle.driverPhone}</TableCell>
                    <TableCell>{vehicle.mpg} MPG</TableCell>
                    <TableCell>{vehicle.inspectionCycle}</TableCell>
                    <TableCell>{getStatusBadge(vehicle.status)}</TableCell>
                    <TableCell>{new Date(vehicle.nextInspection).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm">
                        View Details
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
