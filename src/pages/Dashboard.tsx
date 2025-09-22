import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart3, DollarSign, ShoppingCart, Users, TrendingUp, Plus } from "lucide-react";
import { Link } from "react-router-dom";

export default function Dashboard() {
  // Real data - ready for your input
  const stats = [
    {
      title: "Total Sales",
      value: "$0.00",
      change: "Start logging sales to see progress",
      icon: DollarSign,
      positive: true
    },
    {
      title: "Customers",
      value: "0",
      change: "Add your first customer",
      icon: Users,
      positive: true
    },
    {
      title: "Sales Closed",
      value: "0",
      change: "Log your first sale",
      icon: ShoppingCart,
      positive: true
    },
    {
      title: "Conversion Rate",
      value: "0.0%",
      change: "Track performance as you grow",
      icon: TrendingUp,
      positive: true
    }
  ];

  const recentSales: Array<{customer: string, amount: string, product: string, date: string}> = [];

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

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
              <Link to="/sales">
                <BarChart3 className="h-4 w-4 mr-2" />
                View Reports
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}