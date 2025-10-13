import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Download, Printer, ChevronDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import bwipjs from 'bwip-js';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

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
  const [openItems, setOpenItems] = useState<Set<string>>(new Set());
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

  const generateBarcode = (itemId: string, barcode: string) => {
    const canvas = canvasRefs.current[itemId];
    if (canvas) {
      try {
        bwipjs.toCanvas(canvas, {
          bcid: 'code128',
          text: barcode,
          scale: 3,
          height: 10,
          includetext: true,
          textxalign: 'center',
        });
      } catch (error) {
        console.error('Error generating barcode:', error);
      }
    }
  };

  const handleOpenChange = (itemId: string, isOpen: boolean) => {
    if (isOpen && !openItems.has(itemId)) {
      setOpenItems(prev => new Set(prev).add(itemId));
      // Generate barcode after a small delay to ensure canvas is rendered
      setTimeout(() => {
        const item = items.find(i => i.id === itemId);
        if (item) {
          generateBarcode(itemId, item.barcode);
        }
      }, 10);
    }
  };

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
              <Collapsible 
                key={item.id}
                onOpenChange={(isOpen) => handleOpenChange(item.id, isOpen)}
              >
                <div className="border rounded-lg bg-card">
                  <CollapsibleTrigger className="w-full p-4 hover:bg-accent transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="text-left">
                        <p className="font-medium text-sm">{item.barcode}</p>
                        <p className="text-xs text-muted-foreground capitalize">
                          Status: {item.status}
                        </p>
                      </div>
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="p-4 pt-0 flex justify-center">
                      <canvas
                        ref={(el) => {
                          canvasRefs.current[item.id] = el;
                        }}
                        className="bg-white p-2 rounded"
                      />
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
