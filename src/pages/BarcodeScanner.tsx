import { useState, useEffect, useRef } from "react";
import { BrowserMultiFormatReader, DecodeHintType, BarcodeFormat } from "@zxing/library";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Camera, CameraOff, RotateCcw, AlertCircle, MapPin, Flashlight } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ScannedProduct {
  barcode: string;
  productName: string;
  sku: string;
  price: number;
  stock: number;
  status: string;
  scannedAt: Date;
  itemId: string;
  destinationAddress: string | null;
  isRental: boolean;
  isRentalOnly: boolean;
}

export default function BarcodeScanner() {
  const [isScanning, setIsScanning] = useState(false);
  const [scannedProduct, setScannedProduct] = useState<ScannedProduct | null>(null);
  const [scanHistory, setScanHistory] = useState<ScannedProduct[]>([]);
  const [error, setError] = useState<string>("");
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [destinationAddress, setDestinationAddress] = useState<string>("");
  const [isSavingAddress, setIsSavingAddress] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [isSavingStatus, setIsSavingStatus] = useState(false);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Initialize code reader with hints for better performance
    const hints = new Map();
    hints.set(DecodeHintType.TRY_HARDER, true);
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.CODE_128,
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
      BarcodeFormat.CODE_39,
    ]);
    
    codeReaderRef.current = new BrowserMultiFormatReader(hints);
    
    return () => {
      stopScanning();
    };
  }, []);

  const startScanning = async () => {
    setError("");
    setScannedProduct(null);
    
    const callback = async (result: any, error: any) => {
      if (result) {
        const barcodeText = result.getText();
        console.log("Barcode detected:", barcodeText);
        setIsScanning(false);
        stopScanning();
        await lookupProduct(barcodeText);
      }
      if (error && !(error.name === 'NotFoundException')) {
        console.error("Scanning error:", error);
      }
    };

    try {
      if (!codeReaderRef.current || !videoRef.current) return;

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
          frameRate: { ideal: 30, max: 60 },
          // @ts-ignore - non-standard but supported on many Android devices
          advanced: [{ focusMode: 'continuous' }],
        } as any,
      };

      await codeReaderRef.current.decodeFromConstraints(
        constraints,
        videoRef.current,
        callback
      );

      setIsScanning(true);
      setHasPermission(true);

      // After start, capture the stream from the video for torch support
      setTimeout(() => {
        const stream = (videoRef.current?.srcObject as MediaStream) || null;
        if (stream) {
          streamRef.current = stream;
          const track = stream.getVideoTracks()[0];
          const capabilities = track.getCapabilities?.();
          if (capabilities && 'torch' in capabilities) {
            setTorchSupported(true);
          }
        }
      }, 200);

    } catch (err: any) {
      console.error("Camera error:", err);
      setHasPermission(false);

      // Fallback with simpler constraints (Android compatibility)
      if (codeReaderRef.current && videoRef.current) {
        try {
          await codeReaderRef.current.decodeFromConstraints(
            { video: { facingMode: 'environment' } },
            videoRef.current,
            callback
          );
          setIsScanning(true);
          setHasPermission(true);
          return;
        } catch (e2) {
          console.error('Fallback start failed:', e2);
        }
      }
      
      if (err.name === 'NotAllowedError') {
        setError("Camera permission denied. Please allow camera access to scan barcodes.");
      } else if (err.name === 'NotFoundError') {
        setError("No camera found on this device.");
      } else {
        setError("Failed to access camera. Please try again.");
      }
      
      toast({
        title: "Camera Error",
        description: "Unable to access camera",
        variant: "destructive",
      });
    }
  };

  const stopScanning = () => {
    if (codeReaderRef.current) {
      codeReaderRef.current.reset();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsScanning(false);
    setTorchEnabled(false);
  };

  const toggleTorch = async () => {
    if (!streamRef.current || !torchSupported) return;
    
    try {
      const track = streamRef.current.getVideoTracks()[0];
      await track.applyConstraints({
        // @ts-ignore - torch is not in TypeScript types yet
        advanced: [{ torch: !torchEnabled }]
      });
      setTorchEnabled(!torchEnabled);
    } catch (err) {
      console.error("Torch error:", err);
      toast({
        title: "Flashlight Error",
        description: "Unable to toggle flashlight",
        variant: "destructive",
      });
    }
  };

  const lookupProduct = async (barcode: string) => {
    try {
      // Query product_items with barcode
      const { data: itemData, error: itemError } = await supabase
        .from('product_items')
        .select(`
          *,
          products!inner(
            name,
            sku,
            price,
            stock,
            is_rental,
            is_rental_only
          )
        `)
        .eq('barcode', barcode)
        .single();

      if (itemError) {
        if (itemError.code === 'PGRST116') {
          setError(`Barcode "${barcode}" not found in database.`);
          toast({
            title: "Barcode Not Found",
            description: `The barcode "${barcode}" doesn't exist in your inventory.`,
            variant: "destructive",
          });
        } else {
          throw itemError;
        }
        return;
      }

      const product: ScannedProduct = {
        barcode: itemData.barcode,
        productName: itemData.products.name,
        sku: itemData.products.sku,
        price: itemData.products.price,
        stock: itemData.products.stock,
        status: itemData.status,
        scannedAt: new Date(),
        itemId: itemData.id,
        destinationAddress: itemData.destination_address,
        isRental: itemData.products.is_rental || false,
        isRentalOnly: itemData.products.is_rental_only || false,
      };

      setDestinationAddress(itemData.destination_address || "");
      setSelectedStatus(itemData.status || "");

      setScannedProduct(product);
      setScanHistory(prev => [product, ...prev.slice(0, 9)]); // Keep last 10
      
      toast({
        title: "Product Found!",
        description: `${product.productName} - $${product.price.toFixed(2)}`,
      });

    } catch (err: any) {
      console.error("Lookup error:", err);
      setError("Failed to lookup product in database.");
      toast({
        title: "Database Error",
        description: "Failed to retrieve product information",
        variant: "destructive",
      });
    }
  };

  const saveDestinationAddress = async () => {
    if (!scannedProduct) return;

    setIsSavingAddress(true);
    try {
      const { error: updateError } = await supabase
        .from('product_items')
        .update({ destination_address: destinationAddress })
        .eq('id', scannedProduct.itemId);

      if (updateError) throw updateError;

      setScannedProduct({
        ...scannedProduct,
        destinationAddress: destinationAddress,
      });

      toast({
        title: "Address Updated",
        description: "Destination address has been saved successfully.",
      });

    } catch (err: any) {
      console.error("Address save error:", err);
      toast({
        title: "Save Failed",
        description: "Failed to save destination address.",
        variant: "destructive",
      });
    } finally {
      setIsSavingAddress(false);
    }
  };

  const saveStatus = async (newStatus: string) => {
    if (!scannedProduct) return;

    setIsSavingStatus(true);
    try {
      const { error: updateError } = await supabase
        .from('product_items')
        .update({ status: newStatus })
        .eq('id', scannedProduct.itemId);

      if (updateError) throw updateError;

      setScannedProduct({
        ...scannedProduct,
        status: newStatus,
      });

      setSelectedStatus(newStatus);

      toast({
        title: "Status Updated",
        description: `Status changed to "${newStatus}"`,
      });

    } catch (err: any) {
      console.error("Status save error:", err);
      toast({
        title: "Save Failed",
        description: "Failed to update status.",
        variant: "destructive",
      });
    } finally {
      setIsSavingStatus(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'available':
        return 'bg-green-500';
      case 'sold':
        return 'bg-blue-500';
      case 'rented':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Barcode Scanner</h1>
        <p className="text-muted-foreground">
          Scan Code 128 barcodes using your device camera
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Scanner Section */}
        <Card>
          <CardHeader>
            <CardTitle>Camera Scanner</CardTitle>
            <CardDescription>
              Point your camera at a barcode to scan
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Video Preview */}
            <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                playsInline
                muted
                autoPlay
              />
              {!isScanning && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                  <Camera className="w-16 h-16 text-white/50" />
                </div>
              )}
            </div>

            {/* Error Alert */}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Control Buttons */}
            <div className="flex gap-2">
              {!isScanning ? (
                <Button onClick={startScanning} className="flex-1">
                  <Camera className="w-4 h-4 mr-2" />
                  Start Scanning
                </Button>
              ) : (
                <>
                  <Button onClick={stopScanning} variant="destructive" className="flex-1">
                    <CameraOff className="w-4 h-4 mr-2" />
                    Stop Scanning
                  </Button>
                  {torchSupported && (
                    <Button 
                      onClick={toggleTorch} 
                      variant={torchEnabled ? "default" : "outline"}
                      size="icon"
                    >
                      <Flashlight className="w-4 h-4" />
                    </Button>
                  )}
                </>
              )}
              
              {scannedProduct && (
                <Button onClick={startScanning} variant="outline">
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Scan Again
                </Button>
              )}
            </div>
            
            {isScanning && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  Hold the barcode steady and ensure good lighting. {torchSupported && "Use the flashlight button if needed."}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Results Section */}
        <Card>
          <CardHeader>
            <CardTitle>Scanned Product</CardTitle>
            <CardDescription>
              Product details from your inventory
            </CardDescription>
          </CardHeader>
          <CardContent>
            {scannedProduct ? (
              <div className="space-y-4">
                <div className="text-center p-6 bg-muted rounded-lg">
                  <p className="text-4xl font-bold text-primary mb-2">
                    ${scannedProduct.price.toFixed(2)}
                  </p>
                  <p className="text-xl font-semibold mb-1">
                    {scannedProduct.productName}
                  </p>
                  <p className="text-sm text-muted-foreground mb-3">
                    SKU: {scannedProduct.sku}
                  </p>
                  <Badge className={getStatusColor(scannedProduct.status)}>
                    {scannedProduct.status}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Barcode</p>
                    <p className="font-mono font-semibold">{scannedProduct.barcode}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Stock</p>
                    <p className="font-semibold">{scannedProduct.stock} units</p>
                  </div>
                </div>

                {/* Status Update Section */}
                <div className="space-y-2 pt-4 border-t">
                  <Label htmlFor="status-select">Update Status</Label>
                  <Select 
                    value={selectedStatus} 
                    onValueChange={saveStatus}
                    disabled={isSavingStatus}
                  >
                    <SelectTrigger id="status-select">
                      <SelectValue placeholder="Select status..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="in storage">In Storage</SelectItem>
                      {!scannedProduct.isRental && !scannedProduct.isRentalOnly && (
                        <SelectItem value="sold">Sold</SelectItem>
                      )}
                      {(scannedProduct.isRental || scannedProduct.isRentalOnly) && (
                        <>
                          <SelectItem value="rented out">Rented Out</SelectItem>
                          <SelectItem value="in transit">In Transit</SelectItem>
                          <SelectItem value="returned">Returned</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {/* Destination Address Section */}
                <div className="space-y-2 pt-4 border-t">
                  <Label htmlFor="destination-address" className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    Destination Address
                  </Label>
                  <Input
                    id="destination-address"
                    placeholder="Enter destination address..."
                    value={destinationAddress}
                    onChange={(e) => setDestinationAddress(e.target.value)}
                  />
                  <Button 
                    onClick={saveDestinationAddress} 
                    disabled={isSavingAddress}
                    className="w-full"
                    variant="outline"
                  >
                    {isSavingAddress ? "Saving..." : "Save Address"}
                  </Button>
                  {scannedProduct.destinationAddress && (
                    <p className="text-sm text-muted-foreground">
                      Current: {scannedProduct.destinationAddress}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Camera className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No product scanned yet</p>
                <p className="text-sm">Start scanning to see product details</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Scan History */}
      {scanHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Scans</CardTitle>
            <CardDescription>
              Last {scanHistory.length} scanned items
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {scanHistory.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-muted rounded-lg"
                >
                  <div className="flex-1">
                    <p className="font-semibold">{item.productName}</p>
                    <p className="text-sm text-muted-foreground">
                      {item.barcode} • {item.sku}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-primary">
                      ${item.price.toFixed(2)}
                    </p>
                    <Badge className={`${getStatusColor(item.status)} text-xs`}>
                      {item.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
