import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, FileSpreadsheet, Loader2, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import * as XLSX from "xlsx";

interface ImportRenewalListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface ParsedContract {
  client: string;
  contract_start_date: string | null;
  contract_end_date: string | null;
  value_of_contract_vat: number;
  type_of_billing: string | null;
  billed: boolean;
  type_of_service: string | null;
  zone: string | null;
  contact_number: string | null;
  email: string | null;
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

  const parseExcelDate = (value: any): string | null => {
    if (!value) return null;
    
    // If it's a number (Excel serial date)
    if (typeof value === 'number') {
      const date = XLSX.SSF.parse_date_code(value);
      if (date) {
        return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
      }
    }
    
    // If it's a string, try to parse it
    const dateStr = String(value);
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0];
    }
    
    return null;
  };

  const parseExcelFile = async (file: File): Promise<ParsedContract[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

          if (jsonData.length < 2) {
            reject(new Error("Excel file has no data rows"));
            return;
          }

          // Get headers from first row
          const headers = jsonData[0].map(h => 
            String(h || '').toLowerCase().trim()
          );

          console.log("Headers found:", headers);

          // Map column indices
          const columnMap: Record<string, number> = {};
          headers.forEach((header, index) => {
            if (header.includes('client')) columnMap.client = index;
            if (header.includes('start') && header.includes('date')) columnMap.startDate = index;
            if (header.includes('end') && header.includes('date')) columnMap.endDate = index;
            if (header.includes('value') || (header.includes('contract') && header.includes('vat'))) columnMap.value = index;
            if (header.includes('billing') && !header.includes('billed')) columnMap.billing = index;
            if (header === 'billed' || header.includes('billed')) columnMap.billed = index;
            if (header.includes('service')) columnMap.service = index;
            if (header.includes('zone')) columnMap.zone = index;
            if (header.includes('contact') || header.includes('phone') || (header.includes('person') && header.includes('number'))) columnMap.contact = index;
            if (header.includes('email')) columnMap.email = index;
          });

          console.log("Column mapping:", columnMap);

          // Parse data rows
          const contracts: ParsedContract[] = [];
          for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i];
            if (!row || row.length === 0) continue;

            const client = row[columnMap.client];
            if (!client) continue; // Skip rows without client name

            contracts.push({
              client: String(client).trim(),
              contract_start_date: parseExcelDate(row[columnMap.startDate]),
              contract_end_date: parseExcelDate(row[columnMap.endDate]),
              value_of_contract_vat: parseFloat(row[columnMap.value]) || 0,
              type_of_billing: row[columnMap.billing] ? String(row[columnMap.billing]).trim() : null,
              billed: row[columnMap.billed] === true || String(row[columnMap.billed]).toLowerCase() === 'yes',
              type_of_service: row[columnMap.service] ? String(row[columnMap.service]).trim() : null,
              zone: row[columnMap.zone] ? String(row[columnMap.zone]).trim() : null,
              contact_number: row[columnMap.contact] ? String(row[columnMap.contact]).trim() : null,
              email: row[columnMap.email] ? String(row[columnMap.email]).trim() : null,
            });
          }

          console.log(`Parsed ${contracts.length} contracts`);
          resolve(contracts);
        } catch (error) {
          reject(error);
        }
      };
      
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsArrayBuffer(file);
    });
  };

  const handleImport = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setImportResult(null);

    try {
      // Parse Excel file on client side
      const contracts = await parseExcelFile(selectedFile);
      
      if (contracts.length === 0) {
        throw new Error("No valid contracts found in file");
      }

      // Send parsed data to edge function
      const { data, error } = await supabase.functions.invoke("import-renewal-list", {
        body: { contracts },
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
              <CheckCircle className="h-12 w-12 mx-auto text-primary mb-3" />
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
                    <FileSpreadsheet className="h-10 w-10 text-primary" />
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
