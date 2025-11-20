import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Camera, Upload, CheckCircle2, AlertCircle, Image as ImageIcon, ChevronDown, ChevronUp, MapPin } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useFleetVehicles } from "@/hooks/useFleetVehicles";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import DriverMap from "@/components/DriverMap";
export default function Companion() {
  const [selectedVehicle, setSelectedVehicle] = useState("");
  const [inspectionType, setInspectionType] = useState("");
  const [notes, setNotes] = useState("");
  const [uploadedImages, setUploadedImages] = useState<File[]>([]);
  const [isInspectionOpen, setIsInspectionOpen] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { vehicles, isLoading } = useFleetVehicles();
  const { user } = useAuth();

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setUploadedImages((prev) => [...prev, ...files]);
    toast({
      title: "Images Added",
      description: `${files.length} image(s) added to inspection`,
    });
  };

  const handleSubmitInspection = async () => {
    if (!selectedVehicle || !inspectionType) {
      toast({
        title: "Missing Information",
        description: "Please select a vehicle and inspection type",
        variant: "destructive",
      });
      return;
    }

    if (!user) {
      toast({
        title: "Authentication Required",
        description: "You must be logged in to submit inspections",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Upload photos to storage
      const photoUrls: string[] = [];
      
      for (const file of uploadedImages) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}-${Math.random()}.${fileExt}`;
        
        const { error: uploadError, data } = await supabase.storage
          .from('inspection-photos')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('inspection-photos')
          .getPublicUrl(fileName);

        photoUrls.push(publicUrl);
      }

      // Create inspection record
      const { error: insertError } = await supabase
        .from('inspections')
        .insert({
          user_id: user.id,
          vehicle_id: selectedVehicle,
          notes: `${inspectionType}: ${notes}`,
          photos: photoUrls,
          status: 'pending',
        });

      if (insertError) throw insertError;

      toast({
        title: "Inspection Submitted",
        description: "Vehicle inspection has been recorded successfully",
      });

      // Reset form
      setSelectedVehicle("");
      setInspectionType("");
      setNotes("");
      setUploadedImages([]);
    } catch (error: any) {
      toast({
        title: "Submission Failed",
        description: error.message || "Failed to submit inspection",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 p-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Driver Companion</h2>
        <p className="text-muted-foreground">Vehicle inspection and driver tools</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Quick Actions */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Quick Inspection
            </CardTitle>
            <CardDescription>Record vehicle condition quickly</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Take photos and submit inspection reports for your assigned vehicle.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" />
              Daily Checklist
            </CardTitle>
            <CardDescription>Complete your pre-trip inspection</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Follow the daily vehicle checklist before starting your route.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Report Issue
            </CardTitle>
            <CardDescription>Flag maintenance concerns</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Report any issues or concerns with your vehicle immediately.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Map Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Nearby Gas Stations & EV Chargers
          </CardTitle>
          <CardDescription>Find the nearest refueling and charging stations</CardDescription>
        </CardHeader>
        <CardContent>
          <DriverMap />
        </CardContent>
      </Card>

      {/* Vehicle Inspection Form - Collapsible */}
      <Collapsible open={isInspectionOpen} onOpenChange={setIsInspectionOpen}>
        <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Vehicle Inspection</CardTitle>
                <CardDescription>Upload photos and document vehicle condition</CardDescription>
              </div>
              {isInspectionOpen ? (
                <ChevronUp className="h-5 w-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="vehicle">Select Vehicle</Label>
              <Select value={selectedVehicle} onValueChange={setSelectedVehicle}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose your vehicle" />
                </SelectTrigger>
                <SelectContent>
                  {isLoading ? (
                    <SelectItem value="loading" disabled>
                      Loading vehicles...
                    </SelectItem>
                  ) : vehicles.length === 0 ? (
                    <SelectItem value="none" disabled>
                      No vehicles available
                    </SelectItem>
                  ) : (
                    vehicles.map((vehicle) => (
                      <SelectItem key={vehicle.id} value={vehicle.id}>
                        {vehicle.license_plate} - {vehicle.make} {vehicle.model}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="inspectionType">Inspection Type</Label>
              <Select value={inspectionType} onValueChange={setInspectionType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily Pre-Trip</SelectItem>
                  <SelectItem value="issue">Issue Report</SelectItem>
                  <SelectItem value="post-trip">Post-Trip Review</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Inspection Notes</Label>
            <Textarea
              id="notes"
              placeholder="Document any observations, issues, or notes about the vehicle condition..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
            />
          </div>

          <div className="space-y-4">
            <Label>Upload Photos</Label>
            <div className="border-2 border-dashed rounded-lg p-8 text-center space-y-4">
              <div className="flex justify-center">
                <ImageIcon className="h-12 w-12 text-muted-foreground" />
              </div>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Upload photos of the vehicle condition
                </p>
                <Input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageUpload}
                  className="hidden"
                  id="image-upload"
                />
                <Label htmlFor="image-upload" className="cursor-pointer">
                  <div className="flex items-center justify-center gap-2">
                    <Button type="button" variant="outline" asChild>
                      <span>
                        <Upload className="h-4 w-4 mr-2" />
                        Choose Files
                      </span>
                    </Button>
                  </div>
                </Label>
              </div>
            </div>

            {uploadedImages.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">
                  {uploadedImages.length} image(s) selected
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {uploadedImages.map((file, index) => (
                    <div
                      key={index}
                      className="relative aspect-square rounded-lg border bg-muted overflow-hidden"
                    >
                      <img
                        src={URL.createObjectURL(file)}
                        alt={`Inspection ${index + 1}`}
                        className="object-cover w-full h-full"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setSelectedVehicle("");
                setInspectionType("");
                setNotes("");
                setUploadedImages([]);
              }}
            >
              Clear
            </Button>
            <Button onClick={handleSubmitInspection} disabled={isSubmitting}>
              {isSubmitting ? "Submitting..." : "Submit Inspection"}
            </Button>
          </div>
        </CardContent>
        </CollapsibleContent>
      </Card>
      </Collapsible>
    </div>
  );
}
