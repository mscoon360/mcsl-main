import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart3, DollarSign, ShoppingCart, Users, Plus, Package, FileText, TrendingUp, AlertCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { useSales } from "@/hooks/useSales";
import { useProducts } from "@/hooks/useProducts";
import { useCustomers } from "@/hooks/useCustomers";
import { startOfMonth, endOfMonth, format, subMonths } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";

export default function Dashboard() {
  const { sales, loading } = useSales();
  const { products } = useProducts();
  const { customers } = useCustomers();
  const { user, isAdmin } = useAuth();

  // Admins see all sales, regular users see only their own - only completed sales
  const userSales = (isAdmin ? sales : sales.filter(sale => sale.user_id === user?.id))
    .filter(sale => sale.status === 'completed');

  // Calculate real stats
  const totalSales = userSales.reduce((sum, sale) => sum + sale.total, 0);
  const totalSalesCount = userSales.length;
  const customersCount = customers.length;

  // Calculate monthly revenue for last 6 months
  const monthlyRevenue = Array.from({ length: 6 }, (_, i) => {
    const month = subMonths(new Date(), 5 - i);
    const monthStart = startOfMonth(month);
    const monthEnd = endOfMonth(month);
    
    const revenue = userSales
      .filter(sale => {
        const saleDate = new Date(sale.date);
        return saleDate >= monthStart && saleDate <= monthEnd;
      })
      .reduce((sum, sale) => sum + sale.total, 0);
    
    return {
      month: format(month, 'MMM yyyy'),
      revenue
    };
  });
  
  const stats = [
    {
      title: "Total Sales",
      value: `$${totalSales.toFixed(2)}`,
      change: totalSales > 0 ? `${totalSalesCount} sales completed` : "Start logging sales to see progress",
      icon: DollarSign,
      positive: true
    },
    {
      title: "Customers",
      value: customersCount.toString(),
      change: customersCount > 0 ? `Active customers` : "Add your first customer",
      icon: Users,
      positive: true
    },
    {
      title: "Sales Closed",
      value: totalSalesCount.toString(),
      change: totalSalesCount > 0 ? `Total transactions` : "Log your first sale",
      icon: ShoppingCart,
      positive: true
    }
  ];

  // Get recent sales (last 5)
  const recentSales = userSales
    .slice(0, 5)
    .map(sale => ({
      customer: sale.customer_name,
      amount: `$${sale.total.toFixed(2)}`,
      product: sale.items.map(item => `${item.quantity}x ${item.product_name}`).join(', '),
      date: new Date(sale.date).toLocaleDateString(),
      rep: sale.rep_name
    }));

  // Get out of stock products
  const outOfStockProducts = products.filter(product => product.stock === 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Sales Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back! Here's what's happening with your sales today.
          </p>
        </div>
        <div className="flex gap-3">
          <Button asChild>
            <Link to="/sales">
              <Plus className="h-4 w-4 mr-2" />
              Log New Sale
            </Link>
          </Button>
        </div>
      </div>

      {/* Monthly Revenue Tracker */}
      <Card className="dashboard-card">
        <CardHeader>
          <CardTitle className="text-card-foreground flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Monthly Revenue (Last 6 Months)
          </CardTitle>
          <CardDescription>
            Track your revenue trends over time
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {monthlyRevenue.map((data, index) => (
              <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div>
                  <p className="text-sm font-medium text-foreground">{data.month}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-success">${data.revenue.toFixed(2)}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.title} className="dashboard-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-card-foreground">
                {stat.title}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-card-foreground">{stat.value}</div>
              <p className={`text-xs ${stat.positive ? 'text-success' : 'text-destructive'}`}>
                {stat.change}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Out of Stock Notifications */}
      {outOfStockProducts.length > 0 && (
        <Card className="dashboard-card border-destructive">
          <CardHeader>
            <CardTitle className="text-card-foreground flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Stock Alerts
            </CardTitle>
            <CardDescription>
              {outOfStockProducts.length} product{outOfStockProducts.length !== 1 ? 's' : ''} out of stock
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {outOfStockProducts.map((product) => (
                <div key={product.id} className="flex items-center justify-between p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                  <div className="flex items-center gap-3">
                    <Package className="h-4 w-4 text-destructive" />
                    <div>
                      <p className="text-sm font-medium text-foreground">{product.name}</p>
                      <p className="text-xs text-muted-foreground">SKU: {product.sku}</p>
                    </div>
                  </div>
                  <Badge variant="destructive">No Stock</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        {/* Recent Sales */}
        <Card className="col-span-4 dashboard-card">
          <CardHeader>
            <CardTitle className="text-card-foreground">Recent Sales</CardTitle>
            <CardDescription>
              Your latest closed deals and transactions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {recentSales.length > 0 ? (
              <div className="space-y-4">
                {recentSales.map((sale, index) => (
                  <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-foreground">{sale.customer}</p>
                      <p className="text-xs text-muted-foreground">{sale.product}</p>
                      <p className="text-xs text-muted-foreground">Rep: {sale.rep}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-success">{sale.amount}</p>
                      <p className="text-xs text-muted-foreground">{sale.date}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mx-auto mb-4">
                  <ShoppingCart className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">No sales yet</h3>
                <p className="text-muted-foreground mb-4">Your recent sales will appear here once you start logging them.</p>
                <Button asChild>
                  <Link to="/sales">
                    <Plus className="h-4 w-4 mr-2" />
                    Log Your First Sale
                  </Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="col-span-3 dashboard-card">
          <CardHeader>
            <CardTitle className="text-card-foreground">Quick Actions</CardTitle>
            <CardDescription>
              Common tasks to keep your sales flowing.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button asChild className="w-full justify-start" variant="outline">
              <Link to="/sales">
                <Plus className="h-4 w-4 mr-2" />
                Log New Sale
              </Link>
            </Button>
            <Button asChild className="w-full justify-start" variant="outline">
              <Link to="/customers">
                <Users className="h-4 w-4 mr-2" />
                Add Customer
              </Link>
            </Button>
            <Button asChild className="w-full justify-start" variant="outline">
              <Link to="/products">
                <ShoppingCart className="h-4 w-4 mr-2" />
                Add Product
              </Link>
            </Button>
            <Button asChild className="w-full justify-start" variant="outline">
              <Link to="/rental-agreements">
                <FileText className="h-4 w-4 mr-2" />
                Rental Agreements
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}