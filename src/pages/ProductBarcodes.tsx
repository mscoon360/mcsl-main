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
        .select('*')
        .eq('product_id', productId)
        .order('barcode', { ascending: true });

      if (itemsError) throw itemsError;
      setItems(itemsData || []);
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
                <div>
                  <p className="font-medium text-sm">{item.barcode}</p>
                  <p className="text-xs text-muted-foreground capitalize">
                    Status: {item.status}
                  </p>
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
            <p className="text-sm text-muted-foreground capitalize">
              Status: {selectedItem?.status}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
