import { useState, useRef } from "react";
import { Camera, Upload, Loader2, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

interface ExtractedData {
  customer_name?: string;
  customer_contact?: string;
  customer_address?: string;
  date?: string;
  items?: Array<{
    description: string;
    quantity?: number;
    amount?: number;
  }>;
  total_amount?: number;
  document_type?: string;
}

export default function DataExtractor() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setIsCameraActive(true);
      }
    } catch (error) {
      console.error("Error accessing camera:", error);
      toast({
        title: "Camera Error",
        description: "Unable to access camera. Please check permissions.",
        variant: "destructive",
      });
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        const imageData = canvas.toDataURL("image/jpeg");
        setCapturedImage(imageData);
        stopCamera();
        processImage(imageData);
      }
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const imageData = e.target?.result as string;
        setCapturedImage(imageData);
        processImage(imageData);
      };
      reader.readAsDataURL(file);
    }
  };

  const processImage = async (imageData: string) => {
    setIsProcessing(true);
    setExtractedData(null);

    try {
      const { data, error } = await supabase.functions.invoke("extract-document-data", {
        body: { image: imageData },
      });

      if (error) throw error;

      if (data?.extractedData) {
        setExtractedData(data.extractedData);
        toast({
          title: "Success",
          description: "Document data extracted successfully!",
        });
      } else {
        throw new Error("No data extracted");
      }
    } catch (error) {
      console.error("Error processing image:", error);
      toast({
        title: "Processing Error",
        description: "Failed to extract data from document. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const reset = () => {
    setCapturedImage(null);
    setExtractedData(null);
    stopCamera();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Data Extractor</h1>
        <p className="text-muted-foreground">
          Capture or upload invoices and notification forms to automatically extract data
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Camera/Upload Section */}
        <Card>
          <CardHeader>
            <CardTitle>Capture Document</CardTitle>
            <CardDescription>
              Use your camera or upload an image of an invoice or notification form
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!capturedImage && !isCameraActive && (
              <div className="flex flex-col gap-3">
                <Button onClick={startCamera} className="w-full">
                  <Camera className="mr-2 h-4 w-4" />
                  Open Camera
                </Button>
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Image
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>
            )}

            {isCameraActive && (
              <div className="space-y-3">
                <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={capturePhoto} className="flex-1">
                    <Camera className="mr-2 h-4 w-4" />
                    Capture
                  </Button>
                  <Button variant="outline" onClick={stopCamera}>
                    <X className="mr-2 h-4 w-4" />
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {capturedImage && (
              <div className="space-y-3">
                <div className="relative aspect-video rounded-lg overflow-hidden border">
                  <img
                    src={capturedImage}
                    alt="Captured document"
                    className="w-full h-full object-contain"
                  />
                </div>
                {isProcessing && (
                  <div className="flex items-center justify-center p-4">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <span className="ml-2">Processing document...</span>
                  </div>
                )}
                <Button variant="outline" onClick={reset} className="w-full">
                  <X className="mr-2 h-4 w-4" />
                  Clear & Retry
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Extracted Data Section */}
        <Card>
          <CardHeader>
            <CardTitle>Extracted Data</CardTitle>
            <CardDescription>
              Automatically extracted information from the document
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!extractedData && !isProcessing && (
              <div className="text-center py-12 text-muted-foreground">
                <p>No data extracted yet</p>
                <p className="text-sm mt-2">Capture or upload a document to begin</p>
              </div>
            )}

            {extractedData && (
              <div className="space-y-4">
                {extractedData.document_type && (
                  <div>
                    <Badge variant="outline" className="mb-4">
                      {extractedData.document_type}
                    </Badge>
                  </div>
                )}

                {/* Customer Information */}
                <div className="space-y-2">
                  <h3 className="font-semibold text-sm text-muted-foreground">
                    Customer Information
                  </h3>
                  <div className="space-y-1 pl-2 border-l-2 border-primary/20">
                    {extractedData.customer_name && (
                      <p>
                        <span className="font-medium">Name:</span>{" "}
                        {extractedData.customer_name}
                      </p>
                    )}
                    {extractedData.customer_contact && (
                      <p>
                        <span className="font-medium">Contact:</span>{" "}
                        {extractedData.customer_contact}
                      </p>
                    )}
                    {extractedData.customer_address && (
                      <p>
                        <span className="font-medium">Address:</span>{" "}
                        {extractedData.customer_address}
                      </p>
                    )}
                  </div>
                </div>

                {/* Date */}
                {extractedData.date && (
                  <div className="space-y-2">
                    <h3 className="font-semibold text-sm text-muted-foreground">Date</h3>
                    <p className="pl-2 border-l-2 border-primary/20">
                      {extractedData.date}
                    </p>
                  </div>
                )}

                {/* Items */}
                {extractedData.items && extractedData.items.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="font-semibold text-sm text-muted-foreground">Items</h3>
                    <div className="space-y-2">
                      {extractedData.items.map((item, index) => (
                        <div
                          key={index}
                          className="p-3 rounded-lg border bg-muted/50 space-y-1"
                        >
                          <p className="font-medium">{item.description}</p>
                          <div className="flex justify-between text-sm text-muted-foreground">
                            {item.quantity && <span>Qty: {item.quantity}</span>}
                            {item.amount && (
                              <span className="font-medium">
                                ${item.amount.toFixed(2)}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Total Amount */}
                {extractedData.total_amount && (
                  <div className="pt-3 border-t">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold">Total Amount:</span>
                      <span className="text-xl font-bold text-primary">
                        ${extractedData.total_amount.toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
