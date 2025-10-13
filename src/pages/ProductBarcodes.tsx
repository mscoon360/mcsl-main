import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Download, Printer } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import bwipjs from 'bwip-js';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ProductItem {
  id: string;
  barcode: string;
  status: string;
  created_at: string;
  product_id: string;
  price?: number;
  destination_address?: string | null;
}

interface Product {
  id: string;
  name: string;
  sku: string;
}

export default function ProductBarcodes() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [product, setProduct] = useState<Product | null>(null);
  const [items, setItems] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<ProductItem | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    fetchProductAndBarcodes();
  }, [productId]);

  const fetchProductAndBarcodes = async () => {
    try {
      const { data: productData, error: productError } = await supabase
        .from('products')
        .select('id, name, sku')
        .eq('id', productId)
        .single();

      if (productError) throw productError;
      setProduct(productData);

      const { data: itemsData, error: itemsError } = await supabase
        .from('product_items')
        .select('*, products!inner(price)')
        .eq('product_id', productId)
        .order('barcode', { ascending: true });

      if (itemsError) throw itemsError;
      
      // Map the data to include price
      const mappedItems = itemsData?.map(item => ({
        ...item,
        price: item.products?.price
      })) || [];
      
      setItems(mappedItems);
    } catch (error: any) {
      console.error('Error fetching data:', error);
      toast({
        title: 'Error loading barcodes',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedItem && canvasRef.current) {
      try {
        bwipjs.toCanvas(canvasRef.current, {
          bcid: 'code128',
          text: selectedItem.barcode,
          scale: 2,
          height: 10,
          includetext: true,
          textxalign: 'center',
          paddingwidth: 10,
          paddingheight: 8,
        });
      } catch (error) {
        console.error('Error generating barcode:', error);
      }
    }
  }, [selectedItem]);

  const handlePrint = () => {
    window.print();
  };

  const handlePrintSingle = (item: ProductItem) => {
    const canvas = document.createElement('canvas');
    try {
      bwipjs.toCanvas(canvas, {
        bcid: 'code128',
        text: item.barcode,
        scale: 3,
        height: 12,
        includetext: true,
        textxalign: 'center',
        paddingwidth: 10,
        paddingheight: 10,
      });

      // Create print window
      const printWindow = window.open('', '', 'width=400,height=300');
      if (printWindow) {
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Print Barcode - ${item.barcode}</title>
              <style>
                @media print {
                  @page {
                    size: 2in 1in;
                    margin: 0;
                  }
                  body {
                    margin: 0;
                    padding: 0;
                  }
                }
                body {
                  font-family: Arial, sans-serif;
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                  justify-content: center;
                  width: 2in;
                  height: 1in;
                  margin: 0;
                  padding: 0;
                }
                .label-container {
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                  justify-content: center;
                  width: 100%;
                  height: 100%;
                  background: white;
                }
                .barcode-img {
                  max-width: 90%;
                  height: auto;
                }
                .price {
                  font-size: 14px;
                  font-weight: bold;
                  margin-top: 2px;
                }
              </style>
            </head>
            <body>
              <div class="label-container">
                <img src="${canvas.toDataURL()}" alt="Barcode" class="barcode-img" />
                ${item.price ? `<div class="price">$${item.price.toFixed(2)}</div>` : ''}
              </div>
              <script>
                window.onload = function() {
                  window.print();
                  window.onafterprint = function() {
                    window.close();
                  };
                };
              </script>
            </body>
          </html>
        `);
        printWindow.document.close();
      }
    } catch (error) {
      console.error('Error generating barcode for print:', error);
      toast({
        title: 'Print error',
        description: 'Failed to generate barcode for printing',
        variant: 'destructive',
      });
    }
  };

  const handleDownloadAll = () => {
    toast({
      title: 'Feature coming soon',
      description: 'Bulk download will be available soon.',
    });
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <p>Loading...</p>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="container mx-auto py-8">
        <p>Product not found</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="mb-6 flex items-center justify-between print:hidden">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => navigate('/products')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Products
          </Button>
          <h1 className="text-3xl font-bold">
            Barcodes for {product.name}
          </h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="mr-2 h-4 w-4" />
            Print All
          </Button>
          <Button variant="outline" onClick={handleDownloadAll}>
            <Download className="mr-2 h-4 w-4" />
            Download All
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {items.length} Barcode{items.length !== 1 ? 's' : ''} Generated
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((item) => (
              <div
                key={item.id}
                className="border rounded-lg bg-card p-4 flex items-center justify-between"
              >
                <div className="flex-1">
                  <p className="font-medium text-sm">{item.barcode}</p>
                  <p className="text-xs text-muted-foreground capitalize">
                    Status: {item.status}
                  </p>
                  {item.destination_address && (
                    <p className="text-xs text-muted-foreground mt-1">
                      📍 {item.destination_address}
                    </p>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedItem(item)}
                >
                  View Barcode
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)}>
        <DialogContent className="sm:max-w-xl w-[90vw] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Barcode: {selectedItem?.barcode}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            <canvas
              ref={(el) => {
                canvasRef.current = el;
                if (el && selectedItem) {
                  try {
                    bwipjs.toCanvas(el, {
                      bcid: 'code128',
                      text: selectedItem.barcode,
                      scale: 2,
                      height: 10,
                      includetext: true,
                      textxalign: 'center',
                      paddingwidth: 10,
                      paddingheight: 8,
                    });
                  } catch (error) {
                    console.error('Error generating barcode:', error);
                  }
                }
              }}
              className="bg-white p-4 rounded border w-full max-w-[560px] mx-auto"
            />
            <div className="text-center space-y-2">
              {selectedItem?.price && (
                <p className="text-2xl font-bold text-primary">
                  ${selectedItem.price.toFixed(2)}
                </p>
              )}
              <p className="text-sm text-muted-foreground capitalize">
                Status: {selectedItem?.status}
              </p>
            </div>
            <Button 
              onClick={() => selectedItem && handlePrintSingle(selectedItem)}
              className="w-full"
            >
              <Printer className="mr-2 h-4 w-4" />
              Print Label
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
