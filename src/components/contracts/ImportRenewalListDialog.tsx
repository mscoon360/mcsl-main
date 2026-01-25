import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, FileSpreadsheet, Loader2, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

interface ImportRenewalListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function ImportRenewalListDialog({ open, onOpenChange, onSuccess }: ImportRenewalListDialogProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<{ success: boolean; imported: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setImportResult(null);
    }
  };

  const handleImport = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setImportResult(null);

    try {
      // Read file as base64
      const reader = new FileReader();
      const fileData = await new Promise<string>((resolve, reject) => {
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(selectedFile);
      });

      // Call edge function
      const { data, error } = await supabase.functions.invoke("import-renewal-list", {
        body: { fileData },
      });

      if (error) throw error;

      if (data?.success) {
        setImportResult({ success: true, imported: data.imported });
        toast({
          title: "Import Successful",
          description: `Imported ${data.imported} contracts from the spreadsheet.`,
        });
        onSuccess?.();
      } else {
        throw new Error(data?.error || "Import failed");
      }
    } catch (error) {
      console.error("Import error:", error);
      toast({
        title: "Import Failed",
        description: error instanceof Error ? error.message : "Failed to import spreadsheet",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    setImportResult(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Import Renewal List</DialogTitle>
          <DialogDescription>
            Upload an Excel file (.xlsx) with your renewal contracts data.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {importResult?.success ? (
            <div className="text-center py-6">
              <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-3" />
              <h3 className="font-semibold text-lg">Import Complete!</h3>
              <p className="text-muted-foreground">
                Successfully imported {importResult.imported} contracts.
              </p>
            </div>
          ) : (
            <>
              <div 
                className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                {selectedFile ? (
                  <div className="flex flex-col items-center gap-2">
                    <FileSpreadsheet className="h-10 w-10 text-green-600" />
                    <p className="font-medium">{selectedFile.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(selectedFile.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="h-10 w-10 text-muted-foreground" />
                    <p className="font-medium">Click to select file</p>
                    <p className="text-sm text-muted-foreground">
                      Supports .xlsx files
                    </p>
                  </div>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileSelect}
                className="hidden"
              />

              <div className="text-sm text-muted-foreground">
                <p className="font-medium mb-1">Expected columns:</p>
                <ul className="list-disc list-inside space-y-0.5 text-xs">
                  <li>Client</li>
                  <li>Contract Start Date</li>
                  <li>Contract End Date</li>
                  <li>Value of Contract VAT</li>
                  <li>Type of Billing</li>
                  <li>Type of Service</li>
                  <li>Zone</li>
                  <li>Contact Number</li>
                  <li>Email</li>
                </ul>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          {importResult?.success ? (
            <Button onClick={handleClose}>Done</Button>
          ) : (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button 
                onClick={handleImport} 
                disabled={!selectedFile || isUploading}
              >
                {isUploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Import
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
