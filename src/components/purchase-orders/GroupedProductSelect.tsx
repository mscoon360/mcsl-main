import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ChevronDown, ChevronRight, Package } from 'lucide-react';
import { Product } from '@/hooks/useProducts';
import { Division } from '@/hooks/useDivisions';
import { cn } from '@/lib/utils';

interface GroupedProductSelectProps {
  products: Product[];
  divisions: Division[];
  value?: string;
  onSelect: (productId: string) => void;
}

interface GroupNode {
  divisionId: string;
  divisionName: string;
  subdivisions: {
    subdivisionId: string;
    subdivisionName: string;
    categories: {
      category: string;
      products: Product[];
    }[];
  }[];
  uncategorizedProducts: Product[]; // products directly under division with no subdivision
}

function buildTree(products: Product[], divisions: Division[]): { tree: GroupNode[]; uncategorized: Product[] } {
  const tree: GroupNode[] = [];
  const uncategorized: Product[] = [];

  for (const division of divisions) {
    const divProducts = products.filter(p => p.division_id === division.id);
    if (divProducts.length === 0) continue;

    const node: GroupNode = {
      divisionId: division.id,
      divisionName: division.name,
      subdivisions: [],
      uncategorizedProducts: [],
    };

    // Products with no subdivision
    const noSub = divProducts.filter(p => !p.subdivision_id);
    if (noSub.length > 0) {
      node.uncategorizedProducts = noSub;
    }

    for (const sub of division.subdivisions || []) {
      const subProducts = divProducts.filter(p => p.subdivision_id === sub.id);
      if (subProducts.length === 0) continue;

      // Group by category
      const catMap = new Map<string, Product[]>();
      for (const p of subProducts) {
        const cat = p.category || 'Uncategorized';
        if (!catMap.has(cat)) catMap.set(cat, []);
        catMap.get(cat)!.push(p);
      }

      node.subdivisions.push({
        subdivisionId: sub.id,
        subdivisionName: sub.name,
        categories: Array.from(catMap.entries()).map(([category, prods]) => ({ category, products: prods })),
      });
    }

    tree.push(node);
  }

  // Products with no division
  const noDivision = products.filter(p => !p.division_id);
  uncategorized.push(...noDivision);

  return { tree, uncategorized };
}

export function GroupedProductSelect({ products, divisions, value, onSelect }: GroupedProductSelectProps) {
  const [open, setOpen] = useState(false);
  const [expandedDivisions, setExpandedDivisions] = useState<Set<string>>(new Set());
  const [expandedSubdivisions, setExpandedSubdivisions] = useState<Set<string>>(new Set());
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const { tree, uncategorized } = buildTree(products, divisions);
  const selectedProduct = products.find(p => p.id === value);

  const toggle = (set: Set<string>, key: string, setter: React.Dispatch<React.SetStateAction<Set<string>>>) => {
    const next = new Set(set);
    if (next.has(key)) next.delete(key); else next.add(key);
    setter(next);
  };

  const handleSelect = (productId: string) => {
    onSelect(productId);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
          <span className="truncate">
            {selectedProduct ? `${selectedProduct.name} (${selectedProduct.sku})` : 'Select product'}
          </span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0 max-h-[350px] overflow-y-auto" align="start">
        <div className="p-1">
          {tree.map(div => (
            <div key={div.divisionId}>
              <button
                type="button"
                className="flex items-center gap-1 w-full px-2 py-1.5 text-sm font-semibold hover:bg-muted rounded-sm"
                onClick={() => toggle(expandedDivisions, div.divisionId, setExpandedDivisions)}
              >
                {expandedDivisions.has(div.divisionId) ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                {div.divisionName}
              </button>

              {expandedDivisions.has(div.divisionId) && (
                <div className="ml-3">
                  {/* Direct division products */}
                  {div.uncategorizedProducts.map(p => (
                    <ProductItem key={p.id} product={p} selected={value === p.id} onSelect={handleSelect} />
                  ))}

                  {div.subdivisions.map(sub => (
                    <div key={sub.subdivisionId}>
                      <button
                        type="button"
                        className="flex items-center gap-1 w-full px-2 py-1 text-sm font-medium text-muted-foreground hover:bg-muted rounded-sm"
                        onClick={() => toggle(expandedSubdivisions, sub.subdivisionId, setExpandedSubdivisions)}
                      >
                        {expandedSubdivisions.has(sub.subdivisionId) ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                        {sub.subdivisionName}
                      </button>

                      {expandedSubdivisions.has(sub.subdivisionId) && (
                        <div className="ml-3">
                          {sub.categories.map(cat => {
                            const catKey = `${sub.subdivisionId}-${cat.category}`;
                            return (
                              <div key={catKey}>
                                <button
                                  type="button"
                                  className="flex items-center gap-1 w-full px-2 py-0.5 text-xs font-medium text-muted-foreground/80 hover:bg-muted rounded-sm"
                                  onClick={() => toggle(expandedCategories, catKey, setExpandedCategories)}
                                >
                                  {expandedCategories.has(catKey) ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                  {cat.category}
                                </button>

                                {expandedCategories.has(catKey) && (
                                  <div className="ml-3">
                                    {cat.products.map(p => (
                                      <ProductItem key={p.id} product={p} selected={value === p.id} onSelect={handleSelect} />
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {uncategorized.length > 0 && (
            <div>
              <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">Uncategorized</div>
              {uncategorized.map(p => (
                <ProductItem key={p.id} product={p} selected={value === p.id} onSelect={handleSelect} />
              ))}
            </div>
          )}

          {tree.length === 0 && uncategorized.length === 0 && (
            <div className="px-2 py-4 text-sm text-center text-muted-foreground">No products found</div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ProductItem({ product, selected, onSelect }: { product: Product; selected: boolean; onSelect: (id: string) => void }) {
  return (
    <button
      type="button"
      className={cn(
        "flex items-center gap-2 w-full px-2 py-1 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground",
        selected && "bg-accent text-accent-foreground"
      )}
      onClick={() => onSelect(product.id)}
    >
      <Package className="h-3 w-3 shrink-0 text-muted-foreground" />
      <span className="truncate">{product.name}</span>
      <span className="ml-auto text-xs text-muted-foreground shrink-0">{product.sku}</span>
    </button>
  );
}
