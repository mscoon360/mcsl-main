import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Download, Printer } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

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
  const canvasRefs = useRef<{ [key: string]: HTMLCanvasElement | null }>({});

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
    if (items.length > 0) {
      items.forEach((item) => {
        const canvas = canvasRefs.current[item.id];
        if (canvas) {
          try {
            // Using canvas 2D context to draw barcode
            const ctx = canvas.getContext('2d');
            if (ctx) {
              canvas.width = 400;
              canvas.height = 120;
              ctx.fillStyle = 'white';
              ctx.fillRect(0, 0, canvas.width, canvas.height);
              ctx.fillStyle = 'black';
              ctx.font = '14px monospace';
              ctx.textAlign = 'center';
              ctx.fillText(item.barcode, canvas.width / 2, canvas.height / 2);
            }
          } catch (error) {
            console.error('Error generating barcode:', error);
          }
        }
      });
    }
  }, [items]);

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
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex flex-col items-center p-4 border rounded-lg bg-white"
              >
                <canvas
                  ref={(el) => {
                    canvasRefs.current[item.id] = el;
                  }}
                  className="mb-2"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  {item.barcode}
                </p>
                <p className="text-xs text-muted-foreground capitalize mt-1">
                  Status: {item.status}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
