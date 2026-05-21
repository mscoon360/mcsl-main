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
import { useDivisions } from "@/hooks/useDivisions";
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
    year: "",
    vin: "",
    engineNumber: "",
    vehicleType: "",
    fuelType: "",
    transmission: "",
    color: "",
    seatingCapacity: "",
    company: "",
    division: "",
    subDivision: "",
    technician: "",
    licensePlate: "",
    driverName: "",
    driverUserId: "",
    driverPhone: "",
    mpg: "",
    inspectionCycle: "",
    purchaseDate: "",
    purchasePrice: "",
    financingStatus: "",
    monthlyPayment: "",
    insuranceProvider: "",
    insuranceExpiry: "",
    registrationExpiry: "",
    warrantyExpiry: "",
    currentMileage: "",
    lastServiceDate: "",
    nextServiceDate: "",
    oilChangeInterval: "",
    tireChangeDate: "",
    batteryChangeDate: "",
    brakeServiceDate: "",
    maintenanceStatus: "",
    preferredMechanic: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { toast } = useToast();
  const { vehicles, isLoading, addVehicle, deleteVehicle } = useFleetVehicles();
  const { users, isLoading: usersLoading, error: usersError } = useUsers();
  const { divisions } = useDivisions();
  const selectedDivision = divisions.find((d) => d.name === formData.division);
  const { isAdmin } = useAuth();

  console.log("[Fleet] render", {
    vehiclesLength: vehicles?.length,
    isLoading,
    usersLength: users?.length,
    usersLoading,
    usersError,
  });

  if (usersError) {
    console.error("[Fleet] Failed to load users:", usersError);
  }

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
        driver_user_id: formData.driverUserId || null,
        driver_phone: formData.driverPhone || null,
        mpg: parseFloat(formData.mpg),
        inspection_cycle: formData.inspectionCycle,
        next_inspection_date: nextInspectionDate.toISOString().split('T')[0],
        status: 'active',
        mileage: 0,
        year: formData.year ? parseInt(formData.year) : null,
        vin: formData.vin || null,
        engine_number: formData.engineNumber || null,
        vehicle_type: formData.vehicleType || null,
        fuel_type: formData.fuelType || null,
        transmission: formData.transmission || null,
        color: formData.color || null,
        seating_capacity: formData.seatingCapacity ? parseInt(formData.seatingCapacity) : null,
        company: formData.company || null,
        division: formData.division || null,
        sub_division: formData.subDivision || null,
        technician: formData.technician || null,
        purchase_date: formData.purchaseDate || null,
        purchase_price: formData.purchasePrice ? parseFloat(formData.purchasePrice) : null,
        financing_status: formData.financingStatus || null,
        monthly_payment: formData.monthlyPayment ? parseFloat(formData.monthlyPayment) : null,
        insurance_provider: formData.insuranceProvider || null,
        insurance_expiry: formData.insuranceExpiry || null,
        registration_expiry: formData.registrationExpiry || null,
        warranty_expiry: formData.warrantyExpiry || null,
        current_mileage: formData.currentMileage ? parseFloat(formData.currentMileage) : null,
        last_service_date: formData.lastServiceDate || null,
        next_service_date: formData.nextServiceDate || null,
        oil_change_interval: formData.oilChangeInterval || null,
        tire_change_date: formData.tireChangeDate || null,
        battery_change_date: formData.batteryChangeDate || null,
        brake_service_date: formData.brakeServiceDate || null,
        maintenance_status: formData.maintenanceStatus || null,
        preferred_mechanic: formData.preferredMechanic || null,
      } as any);
      
      // Reset form and close dialog
      setFormData({
        make: "",
        model: "",
        year: "",
        vin: "",
        engineNumber: "",
        vehicleType: "",
        fuelType: "",
        transmission: "",
        color: "",
        seatingCapacity: "",
        company: "",
        division: "",
        subDivision: "",
        technician: "",
        licensePlate: "",
        driverName: "",
        driverUserId: "",
        driverPhone: "",
        mpg: "",
        inspectionCycle: "",
        purchaseDate: "",
        purchasePrice: "",
        financingStatus: "",
        monthlyPayment: "",
        insuranceProvider: "",
        insuranceExpiry: "",
        registrationExpiry: "",
        warrantyExpiry: "",
        currentMileage: "",
        lastServiceDate: "",
        nextServiceDate: "",
        oilChangeInterval: "",
        tireChangeDate: "",
        batteryChangeDate: "",
        brakeServiceDate: "",
        maintenanceStatus: "",
        preferredMechanic: "",
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
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Vehicle</DialogTitle>
              <DialogDescription>
                Enter the vehicle details to add it to your fleet.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="driverName">Driver Name *</Label>
                  <Select
                    value={formData.driverName}
                    onValueChange={(value) => {
                      const selectedUser = users.find(u => u.name === value);
                      setFormData({
                        ...formData,
                        driverName: value,
                        driverUserId: selectedUser?.id || "",
                      });
                      setErrors({ ...errors, driverName: "" });
                    }}
                  >
                    <SelectTrigger className={errors.driverName ? "border-destructive" : ""}>
                      <SelectValue placeholder={usersLoading ? "Loading drivers..." : users.length === 0 ? "No drivers available" : "Select a driver"} />
                    </SelectTrigger>
                    <SelectContent>
                      {users.length === 0 ? (
                        <SelectItem value="no-users" disabled>No drivers found</SelectItem>
                      ) : (
                        users.map((user) => (
                          <SelectItem key={user.id} value={user.name}>
                            {user.name} ({user.username})
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  {errors.driverName && <p className="text-sm text-destructive">{errors.driverName}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="driverPhone">Driver Phone</Label>
                  <Input
                    id="driverPhone"
                    type="tel"
                    value={formData.driverPhone}
                    onChange={(e) => setFormData({ ...formData, driverPhone: e.target.value })}
                    placeholder="e.g., +1 555-123-4567"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="year">Year</Label>
                  <Input id="year" type="number" value={formData.year} onChange={(e) => handleInputChange("year", e.target.value)} placeholder="e.g., 2022" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vin">VIN</Label>
                  <Input id="vin" value={formData.vin} onChange={(e) => handleInputChange("vin", e.target.value)} placeholder="VIN" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="engineNumber">Engine #</Label>
                  <Input id="engineNumber" value={formData.engineNumber} onChange={(e) => handleInputChange("engineNumber", e.target.value)} placeholder="Engine number" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="vehicleType">Vehicle Type</Label>
                  <Input id="vehicleType" value={formData.vehicleType} onChange={(e) => handleInputChange("vehicleType", e.target.value)} placeholder="e.g., Sedan, Truck" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fuelType">Fuel Type</Label>
                  <Select value={formData.fuelType} onValueChange={(v) => handleInputChange("fuelType", v)}>
                    <SelectTrigger><SelectValue placeholder="Select fuel" /></SelectTrigger>
                    <SelectContent className="bg-background z-50">
                      <SelectItem value="gasoline">Gasoline</SelectItem>
                      <SelectItem value="diesel">Diesel</SelectItem>
                      <SelectItem value="electric">Electric</SelectItem>
                      <SelectItem value="hybrid">Hybrid</SelectItem>
                      <SelectItem value="lpg">LPG</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="transmission">Transmission</Label>
                  <Select value={formData.transmission} onValueChange={(v) => handleInputChange("transmission", v)}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent className="bg-background z-50">
                      <SelectItem value="automatic">Automatic</SelectItem>
                      <SelectItem value="manual">Manual</SelectItem>
                      <SelectItem value="cvt">CVT</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="color">Color</Label>
                  <Input id="color" value={formData.color} onChange={(e) => handleInputChange("color", e.target.value)} placeholder="e.g., White" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="seatingCapacity">Seating Capacity</Label>
                  <Input id="seatingCapacity" type="number" value={formData.seatingCapacity} onChange={(e) => handleInputChange("seatingCapacity", e.target.value)} placeholder="e.g., 5" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                <div className="space-y-2">
                  <Label htmlFor="company">Company</Label>
                  <Input id="company" value={formData.company} onChange={(e) => handleInputChange("company", e.target.value)} placeholder="Company" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="division">Division</Label>
                  <Select
                    value={formData.division}
                    onValueChange={(v) => {
                      handleInputChange("division", v);
                      handleInputChange("subDivision", "");
                    }}
                  >
                    <SelectTrigger id="division"><SelectValue placeholder="Select division" /></SelectTrigger>
                    <SelectContent className="bg-background z-50">
                      {divisions.map((d) => (
                        <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="subDivision">Sub Division</Label>
                  <Select
                    value={formData.subDivision}
                    onValueChange={(v) => handleInputChange("subDivision", v)}
                    disabled={!selectedDivision || !(selectedDivision.subdivisions?.length)}
                  >
                    <SelectTrigger id="subDivision">
                      <SelectValue placeholder={selectedDivision ? "Select sub-division" : "Select division first"} />
                    </SelectTrigger>
                    <SelectContent className="bg-background z-50">
                      {selectedDivision?.subdivisions?.map((s) => (
                        <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="technician">Technician</Label>
                  <Input id="technician" value={formData.technician} onChange={(e) => handleInputChange("technician", e.target.value)} placeholder="Technician" />
                </div>
              </div>



              <div className="pt-2 border-t">
                <h3 className="text-sm font-semibold mb-3">Ownership & Financial</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="purchaseDate">Purchase Date</Label>
                    <Input id="purchaseDate" type="date" value={formData.purchaseDate} onChange={(e) => handleInputChange("purchaseDate", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="purchasePrice">Purchase Price</Label>
                    <Input id="purchasePrice" type="number" step="0.01" value={formData.purchasePrice} onChange={(e) => handleInputChange("purchasePrice", e.target.value)} placeholder="0.00" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="financingStatus">Financing / Lease Status</Label>
                    <Select value={formData.financingStatus} onValueChange={(v) => handleInputChange("financingStatus", v)}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent className="bg-background z-50">
                        <SelectItem value="owned">Owned</SelectItem>
                        <SelectItem value="financed">Financed</SelectItem>
                        <SelectItem value="leased">Leased</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="monthlyPayment">Monthly Payment</Label>
                    <Input id="monthlyPayment" type="number" step="0.01" value={formData.monthlyPayment} onChange={(e) => handleInputChange("monthlyPayment", e.target.value)} placeholder="0.00" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="insuranceProvider">Insurance Provider</Label>
                    <Input id="insuranceProvider" value={formData.insuranceProvider} onChange={(e) => handleInputChange("insuranceProvider", e.target.value)} placeholder="Provider" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="insuranceExpiry">Insurance Expiry</Label>
                    <Input id="insuranceExpiry" type="date" value={formData.insuranceExpiry} onChange={(e) => handleInputChange("insuranceExpiry", e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="registrationExpiry">Registration Expiry</Label>
                    <Input id="registrationExpiry" type="date" value={formData.registrationExpiry} onChange={(e) => handleInputChange("registrationExpiry", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="warrantyExpiry">Warranty Expiry</Label>
                    <Input id="warrantyExpiry" type="date" value={formData.warrantyExpiry} onChange={(e) => handleInputChange("warrantyExpiry", e.target.value)} />
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t">
                <h3 className="text-sm font-semibold mb-3">Service & Maintenance</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="currentMileage">Current Mileage</Label>
                    <Input id="currentMileage" type="number" value={formData.currentMileage} onChange={(e) => handleInputChange("currentMileage", e.target.value)} placeholder="e.g., 45000" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastServiceDate">Last Service</Label>
                    <Input id="lastServiceDate" type="date" value={formData.lastServiceDate} onChange={(e) => handleInputChange("lastServiceDate", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nextServiceDate">Next Service</Label>
                    <Input id="nextServiceDate" type="date" value={formData.nextServiceDate} onChange={(e) => handleInputChange("nextServiceDate", e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="oilChangeInterval">Oil Change Interval</Label>
                    <Input id="oilChangeInterval" value={formData.oilChangeInterval} onChange={(e) => handleInputChange("oilChangeInterval", e.target.value)} placeholder="e.g., 5000 mi / 6 mo" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tireChangeDate">Tire Change Date</Label>
                    <Input id="tireChangeDate" type="date" value={formData.tireChangeDate} onChange={(e) => handleInputChange("tireChangeDate", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="batteryChangeDate">Battery Change Date</Label>
                    <Input id="batteryChangeDate" type="date" value={formData.batteryChangeDate} onChange={(e) => handleInputChange("batteryChangeDate", e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="brakeServiceDate">Brake Service Date</Label>
                    <Input id="brakeServiceDate" type="date" value={formData.brakeServiceDate} onChange={(e) => handleInputChange("brakeServiceDate", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maintenanceStatus">Maintenance Status</Label>
                    <Select value={formData.maintenanceStatus} onValueChange={(v) => handleInputChange("maintenanceStatus", v)}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent className="bg-background z-50">
                        <SelectItem value="active">Active (green)</SelectItem>
                        <SelectItem value="due_soon">Due Soon (yellow)</SelectItem>
                        <SelectItem value="overdue">Overdue (red)</SelectItem>
                        <SelectItem value="in_repair">In Repair (blue)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="preferredMechanic">Preferred Mechanic / Garage</Label>
                    <Input id="preferredMechanic" value={formData.preferredMechanic} onChange={(e) => handleInputChange("preferredMechanic", e.target.value)} placeholder="Shop name" />
                  </div>
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
                    <TableRow key={vehicle.id} className="cursor-pointer hover:bg-muted/50" onClick={() => handleViewDetails(vehicle)}>
                      <TableCell className="font-medium">{vehicle.license_plate}</TableCell>
                      <TableCell>{vehicle.make} {vehicle.model}</TableCell>
                      <TableCell>{vehicle.driver_name}</TableCell>
                      <TableCell>{vehicle.driver_phone || <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell>{vehicle.mpg} MPG</TableCell>
                      <TableCell>{vehicle.inspection_cycle}</TableCell>
                      <TableCell>{getStatusBadge(vehicle.status)}</TableCell>
                      <TableCell>
                        {vehicle.next_inspection_date
                          ? new Date(vehicle.next_inspection_date).toLocaleDateString()
                          : "Not scheduled"}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
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
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-background z-50">
          <DialogHeader>
            <DialogTitle>Vehicle Details</DialogTitle>
            <DialogDescription>
              Complete information for {selectedVehicle?.license_plate}
            </DialogDescription>
          </DialogHeader>
          {selectedVehicle && (() => {
            const v: any = selectedVehicle;
            const Field = ({ label, value }: { label: string; value: any }) => (
              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">{label}</Label>
                <p className="font-medium text-sm">{value ?? <span className="text-muted-foreground">—</span>}</p>
              </div>
            );
            const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString() : null);
            const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold border-b pb-2">{title}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{children}</div>
              </div>
            );
            return (
              <div className="space-y-6">
                <Section title="Identification">
                  <Field label="License Plate" value={v.license_plate} />
                  <Field label="Make" value={v.make} />
                  <Field label="Model" value={v.model} />
                  <Field label="Year" value={v.year} />
                  <Field label="VIN" value={v.vin} />
                  <Field label="Engine Number" value={v.engine_number} />
                  <Field label="Vehicle Type" value={v.vehicle_type} />
                  <Field label="Fuel Type" value={v.fuel_type} />
                  <Field label="Transmission" value={v.transmission} />
                  <Field label="Color" value={v.color} />
                  <Field label="Seating Capacity" value={v.seating_capacity} />
                  <Field label="Status" value={getStatusBadge(v.status)} />
                </Section>

                <Section title="Assignment">
                  <Field label="Company" value={v.company} />
                  <Field label="Division" value={v.division} />
                  <Field label="Sub Division" value={v.sub_division} />
                  <Field label="Technician" value={v.technician} />
                  <Field label="Driver Name" value={v.driver_name} />
                  <Field label="Driver Phone" value={v.driver_phone} />
                </Section>

                <Section title="Ownership & Financial">
                  <Field label="Purchase Date" value={fmtDate(v.purchase_date)} />
                  <Field label="Purchase Price" value={v.purchase_price != null ? `$${Number(v.purchase_price).toLocaleString()}` : null} />
                  <Field label="Financing Status" value={v.financing_status} />
                  <Field label="Monthly Payment" value={v.monthly_payment != null ? `$${Number(v.monthly_payment).toLocaleString()}` : null} />
                  <Field label="Insurance Provider" value={v.insurance_provider} />
                  <Field label="Insurance Expiry" value={fmtDate(v.insurance_expiry)} />
                  <Field label="Registration Expiry" value={fmtDate(v.registration_expiry)} />
                  <Field label="Warranty Expiry" value={fmtDate(v.warranty_expiry)} />
                </Section>

                <Section title="Service & Maintenance">
                  <Field label="Current Mileage" value={v.current_mileage != null ? Number(v.current_mileage).toLocaleString() : v.mileage?.toLocaleString()} />
                  <Field label="MPG" value={`${v.mpg} MPG`} />
                  <Field label="Last Service" value={fmtDate(v.last_service_date)} />
                  <Field label="Next Service" value={fmtDate(v.next_service_date)} />
                  <Field label="Oil Change Interval" value={v.oil_change_interval} />
                  <Field label="Tire Change" value={fmtDate(v.tire_change_date)} />
                  <Field label="Battery Change" value={fmtDate(v.battery_change_date)} />
                  <Field label="Brake Service" value={fmtDate(v.brake_service_date)} />
                  <Field label="Maintenance Status" value={v.maintenance_status} />
                  <Field label="Preferred Mechanic" value={v.preferred_mechanic} />
                </Section>

                <Section title="Inspection">
                  <Field label="Inspection Cycle" value={<span className="capitalize">{v.inspection_cycle}</span>} />
                  <Field label="Last Inspection" value={fmtDate(v.last_inspection_date)} />
                  <Field label="Next Inspection" value={fmtDate(v.next_inspection_date)} />
                  <Field label="Added to Fleet" value={fmtDate(v.created_at)} />
                </Section>
              </div>
            );
          })()}
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
