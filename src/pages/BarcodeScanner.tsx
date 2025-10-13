import { useState, useEffect, useRef } from "react";
import { BrowserMultiFormatReader } from "@zxing/library";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Camera, CameraOff, RotateCcw, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ScannedProduct {
  barcode: string;
  productName: string;
  sku: string;
  price: number;
  stock: number;
  status: string;
  scannedAt: Date;
}

export default function BarcodeScanner() {
  const [isScanning, setIsScanning] = useState(false);
  const [scannedProduct, setScannedProduct] = useState<ScannedProduct | null>(null);
  const [scanHistory, setScanHistory] = useState<ScannedProduct[]>([]);
  const [error, setError] = useState<string>("");
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Initialize code reader
    codeReaderRef.current = new BrowserMultiFormatReader();
    
    return () => {
      stopScanning();
    };
  }, []);

  const startScanning = async () => {
    setError("");
    setScannedProduct(null);
    
    try {
      if (!codeReaderRef.current || !videoRef.current) return;

      // Request camera permission and start scanning
      await codeReaderRef.current.decodeFromVideoDevice(
        undefined, // Use default camera
        videoRef.current,
        async (result, error) => {
          if (result) {
            const barcodeText = result.getText();
            console.log("Barcode detected:", barcodeText);
            
            // Stop scanning temporarily
            setIsScanning(false);
            stopScanning();
            
            // Look up the product
            await lookupProduct(barcodeText);
          }
          
          if (error && !(error.name === 'NotFoundException')) {
            console.error("Scanning error:", error);
          }
        }
      );
      
      setIsScanning(true);
      setHasPermission(true);
      
    } catch (err: any) {
      console.error("Camera error:", err);
      setHasPermission(false);
      
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
    setIsScanning(false);
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
            stock
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
      };

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
                <Button onClick={stopScanning} variant="destructive" className="flex-1">
                  <CameraOff className="w-4 h-4 mr-2" />
                  Stop Scanning
                </Button>
              )}
              
              {scannedProduct && (
                <Button onClick={startScanning} variant="outline">
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Scan Again
                </Button>
              )}
            </div>
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
