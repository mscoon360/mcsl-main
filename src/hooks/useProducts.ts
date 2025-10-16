import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  rental_price?: number;
  sku: string;
  category?: string;
  units?: string;
  stock: number;
  status: string;
  last_sold?: string;
  is_rental?: boolean;
  is_rental_only?: boolean;
}

export const useProducts = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProducts(data || []);
    } catch (error: any) {
      console.error('Error fetching products:', error);
      toast({
        title: 'Error loading products',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const addProduct = async (product: Omit<Product, 'id'>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');

      const { data, error } = await supabase
        .from('products')
        .insert([{ ...product, user_id: user.id }])
        .select()
        .single();

      if (error) throw error;

      // Generate barcodes for each unit of stock
      if (data && product.stock > 0) {
        const barcodeItems = Array.from({ length: product.stock }, (_, index) => ({
          product_id: data.id,
          barcode: `${data.sku}-${String(index + 1).padStart(6, '0')}`,
          status: 'in storage',
        }));

        const { error: barcodeError } = await supabase
          .from('product_items')
          .insert(barcodeItems);

        if (barcodeError) {
          console.error('Error generating barcodes:', barcodeError);
          throw new Error(`Failed to generate barcodes: ${barcodeError.message}`);
        }
      }
      
      toast({
        title: 'Product added',
        description: 'Product has been added successfully.',
      });
      
      return data;
    } catch (error: any) {
      console.error('Error adding product:', error);
      toast({
        title: 'Error adding product',
        description: error.message,
        variant: 'destructive',
      });
      throw error;
    }
  };

  const updateProduct = async (id: string, updates: Partial<Product>) => {
    try {
      const { data, error } = await supabase
        .from('products')
        .update(updates)
        .eq('id', id)
        .select();

      if (error) throw error;
      
      if (!data || data.length === 0) {
        throw new Error('Permission denied: You can only update your own products or you need admin access.');
      }
      
      setProducts(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
      toast({
        title: 'Product updated',
        description: 'Product has been updated successfully.',
      });
    } catch (error: any) {
      console.error('Error updating product:', error);
      toast({
        title: 'Error updating product',
        description: error.message,
        variant: 'destructive',
      });
      throw error;
    }
  };

  const deleteProduct = async (id: string) => {
    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      setProducts(prev => prev.filter(p => p.id !== id));
      toast({
        title: 'Product deleted',
        description: 'Product has been removed successfully.',
      });
    } catch (error: any) {
      console.error('Error deleting product:', error);
      toast({
        title: 'Error deleting product',
        description: error.message,
        variant: 'destructive',
      });
      throw error;
    }
  };

  useEffect(() => {
    fetchProducts();

    // Subscribe to realtime changes
    const channel = supabase
      .channel('products-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'products'
        },
        () => {
          fetchProducts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return {
    products,
    loading,
    addProduct,
    updateProduct,
    deleteProduct,
    refetch: fetchProducts,
  };
};
