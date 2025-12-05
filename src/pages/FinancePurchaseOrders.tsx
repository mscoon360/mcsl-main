import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle, XCircle, Eye, FileText } from "lucide-react";
import { toast } from "sonner";

interface OrderItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  productId?: string;
  units?: string;
}

export default function FinancePurchaseOrders() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["purchase-orders-finance"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_orders")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (order: any) => {
      // Approve the order - stock will be updated when procurement marks it as received
      const isRestockOrder = order.description?.includes("[Restock]");
      const { error } = await supabase
        .from("purchase_orders")
        .update({
          status: "approved",
          approved_by: user?.id,
          approved_at: new Date().toISOString(),
          inventory_status: isRestockOrder ? "ordered" : null,
        })
        .eq("id", order.id);
      if (error) throw error;

      // Create accounts payable entry for this approved PO
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30); // Default 30-day payment terms

      const { error: apError } = await supabase
        .from("accounts_payable")
        .insert({
          user_id: user?.id,
          vendor_id: order.vendor_id || null,
          vendor_name: order.vendor_name,
          bill_number: order.order_number,
          bill_date: new Date().toISOString().split('T')[0],
          due_date: dueDate.toISOString().split('T')[0],
          subtotal: order.subtotal,
          vat_amount: order.vat_amount || 0,
          amount: order.total,
          status: "unpaid",
          description: `Purchase Order: ${order.description || order.order_number}`,
          notes: order.notes,
        });
      
      if (apError) {
        console.error("Error creating AP entry:", apError);
        // Don't throw - PO is already approved, AP entry failure shouldn't reverse it
        toast.error("PO approved but failed to create Accounts Payable entry");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-orders-finance"] });
      queryClient.invalidateQueries({ queryKey: ["accounts-payable"] });
      toast.success("Purchase order approved - added to Accounts Payable");
      setIsViewDialogOpen(false);
    },
    onError: () => {
      toast.error("Failed to approve purchase order");
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ orderId, reason }: { orderId: string; reason: string }) => {
      const { error } = await supabase
        .from("purchase_orders")
        .update({
          status: "rejected",
          rejected_by: user?.id,
          rejected_at: new Date().toISOString(),
          rejection_reason: reason,
        })
        .eq("id", orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-orders-finance"] });
      toast.success("Purchase order rejected");
      setIsRejectDialogOpen(false);
      setIsViewDialogOpen(false);
      setRejectionReason("");
    },
    onError: () => {
      toast.error("Failed to reject purchase order");
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case "approved":
        return <Badge variant="secondary" className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Approved</Badge>;
      case "rejected":
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const handleViewOrder = (order: any) => {
    setSelectedOrder(order);
    setIsViewDialogOpen(true);
  };

  const handleReject = () => {
    if (!selectedOrder || !rejectionReason.trim()) {
      toast.error("Please provide a reason for rejection");
      return;
    }
    rejectMutation.mutate({ orderId: selectedOrder.id, reason: rejectionReason });
  };

  const parseItems = (items: any): OrderItem[] => {
    try {
      if (typeof items === "string") {
        return JSON.parse(items);
      }
      return items || [];
    } catch {
      return [];
    }
  };

  const pendingOrders = orders.filter((o) => o.status === "pending");
  const pendingTotal = pendingOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
  const approvedTotal = orders.filter((o) => o.status === "approved").reduce((sum, o) => sum + Number(o.total || 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Purchase Order Approvals</h1>
        <p className="text-muted-foreground">Review and approve purchase order requests from Procurement</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Requests</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{pendingOrders.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${pendingTotal.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Approved This Month</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {orders.filter((o) => {
                if (o.status !== "approved") return false;
                const approvedDate = new Date(o.approved_at);
                const now = new Date();
                return approvedDate.getMonth() === now.getMonth() && approvedDate.getFullYear() === now.getFullYear();
              }).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Approved Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">${approvedTotal.toFixed(2)}</div>
          </CardContent>
        </Card>
      </div>

      {pendingOrders.length > 0 && (
        <Card className="border-yellow-200 bg-yellow-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-800">
              <Clock className="h-5 w-5" />
              Pending Approval ({pendingOrders.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order #</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Requested By</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">{order.order_number}</TableCell>
                    <TableCell>{order.vendor_name}</TableCell>
                    <TableCell>{order.requested_by}</TableCell>
                    <TableCell className="font-semibold">${Number(order.total).toFixed(2)}</TableCell>
                    <TableCell>{new Date(order.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" onClick={() => handleViewOrder(order)}>
                        <Eye className="h-4 w-4 mr-1" />
                        Review
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            All Purchase Orders
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : orders.length === 0 ? (
            <p className="text-muted-foreground">No purchase orders found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order #</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Fulfilled</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">{order.order_number}</TableCell>
                    <TableCell>{order.vendor_name}</TableCell>
                    <TableCell className="max-w-xs truncate">{order.description || "-"}</TableCell>
                    <TableCell>${Number(order.total).toFixed(2)}</TableCell>
                    <TableCell>{getStatusBadge(order.status)}</TableCell>
                    <TableCell>
                      {order.status === "approved" ? (
                        order.is_fulfilled ? (
                          <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                            <CheckCircle className="h-3 w-3 mr-1" />Fulfilled
                          </Badge>
                        ) : (
                          <Badge variant="outline">Pending</Badge>
                        )
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>{new Date(order.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={() => handleViewOrder(order)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* View Order Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Purchase Order Details</DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Order Number</Label>
                  <p className="font-medium">{selectedOrder.order_number}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <div className="mt-1">{getStatusBadge(selectedOrder.status)}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Vendor</Label>
                  <p className="font-medium">{selectedOrder.vendor_name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Requested By</Label>
                  <p className="font-medium">{selectedOrder.requested_by}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Date</Label>
                  <p className="font-medium">{new Date(selectedOrder.created_at).toLocaleString()}</p>
                </div>
              </div>

              {selectedOrder.description && (
                <div>
                  <Label className="text-muted-foreground">Description</Label>
                  <p>{selectedOrder.description}</p>
                </div>
              )}

              <div>
                <Label className="text-muted-foreground">Items</Label>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Unit Price</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parseItems(selectedOrder.items).map((item: OrderItem, index: number) => (
                      <TableRow key={index}>
                        <TableCell>{item.description} {item.units && `(${item.units})`}</TableCell>
                        <TableCell className="text-right">{item.quantity}</TableCell>
                        <TableCell className="text-right">${Number(item.unitPrice).toFixed(2)}</TableCell>
                        <TableCell className="text-right">${Number(item.total).toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-end">
                <div className="w-64 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>${Number(selectedOrder.subtotal).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>VAT (12.5%):</span>
                    <span>${Number(selectedOrder.vat_amount).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold border-t pt-2">
                    <span>Total:</span>
                    <span>${Number(selectedOrder.total).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {selectedOrder.notes && (
                <div>
                  <Label className="text-muted-foreground">Notes</Label>
                  <p className="text-sm bg-muted p-2 rounded">{selectedOrder.notes}</p>
                </div>
              )}

              {selectedOrder.status === "rejected" && selectedOrder.rejection_reason && (
                <div className="bg-destructive/10 p-3 rounded-md">
                  <Label className="text-destructive">Rejection Reason</Label>
                  <p className="text-sm">{selectedOrder.rejection_reason}</p>
                </div>
              )}

              {selectedOrder.status === "pending" && (
                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button
                    variant="destructive"
                    onClick={() => setIsRejectDialogOpen(true)}
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    Reject
                  </Button>
                  <Button
                    onClick={() => approveMutation.mutate(selectedOrder)}
                    disabled={approveMutation.isPending}
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    {approveMutation.isPending ? "Approving..." : "Approve"}
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Purchase Order</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Reason for Rejection *</Label>
              <Textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Please provide a reason for rejecting this purchase order"
                rows={4}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsRejectDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleReject}
                disabled={rejectMutation.isPending || !rejectionReason.trim()}
              >
                {rejectMutation.isPending ? "Rejecting..." : "Confirm Rejection"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
