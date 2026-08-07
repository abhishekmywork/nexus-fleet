"use client";

import * as React from "react";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { type ImportValidationResult } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Badge } from "@/components/ui/badge";

interface ImportDialogProps<T> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  onImported: () => void;
  parseExcelFile: (file: File) => Promise<Record<string, unknown>[]>;
  validateImport: (rows: Record<string, unknown>[]) => Promise<ImportValidationResult<T>>;
  confirmImport: (rows: T[]) => Promise<unknown>;
}

export function ImportDialog<T>({
  open,
  onOpenChange,
  title,
  onImported,
  parseExcelFile,
  validateImport,
  confirmImport,
}: ImportDialogProps<T>) {
  const [parsing, setParsing] = React.useState(false);
  const [validating, setValidating] = React.useState(false);
  const [importing, setImporting] = React.useState(false);
  const [result, setResult] = React.useState<ImportValidationResult<T> | null>(null);
  const [step, setStep] = React.useState<"pick" | "review" | "done">("pick");
  const fileRef = React.useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setParsing(true);
    try {
      const rows = await parseExcelFile(selected);
      if (rows.length === 0) {
        toast.error("No data rows found in the file. Please add data before importing.");
        setParsing(false);
        return;
      }
      setValidating(true);
      const validation = await validateImport(rows);
      setResult(validation);
      setStep("review");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to parse file");
    } finally {
      setParsing(false);
      setValidating(false);
    }
  };

  const handleConfirm = async () => {
    if (!result) return;
    setImporting(true);
    try {
      await confirmImport(result.valid);
      toast.success(`${result.valid.length} row(s) imported successfully`);
      setStep("done");
      onImported();
      setTimeout(() => {
        onOpenChange(false);
        reset();
      }, 1000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  };

  const reset = () => {
    setResult(null);
    setStep("pick");
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleOpenChange = (o: boolean) => {
    if (!o) reset();
    onOpenChange(o);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import {title}</DialogTitle>
          <DialogDescription>
            Upload an Excel file (.xlsx) to import data. Download a sample template first.
          </DialogDescription>
        </DialogHeader>

        {step === "pick" && (
          <div className="space-y-4">
            <div
              className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 text-center transition-colors hover:border-muted-foreground/50"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const droppedFile = e.dataTransfer.files[0];
                if (droppedFile) {
                  const syntheticEvent = {
                    target: { files: [droppedFile] },
                  } as unknown as React.ChangeEvent<HTMLInputElement>;
                  handleFileChange(syntheticEvent);
                }
              }}
            >
              <Upload className="size-8 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">
                  {parsing ? "Parsing file..." : "Drag & drop or click to browse"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Supports .xlsx files only
                </p>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleFileChange}
                disabled={parsing || validating}
              />
              <Button
                variant="outline"
                size="sm"
                disabled={parsing || validating}
                onClick={() => fileRef.current?.click()}
              >
                {parsing ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  "Choose File"
                )}
              </Button>
            </div>
          </div>
        )}

        {step === "review" && result && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Badge variant={result.errors.length > 0 ? "warning" : "success"}>
                {result.valid.length} valid
              </Badge>
              {result.errors.length > 0 && (
                <Badge variant="destructive">
                  {result.errors.length} error(s)
                </Badge>
              )}
            </div>

            {result.errors.length > 0 && (
              <div className="max-h-40 overflow-y-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Row</TableHead>
                      <TableHead>Error</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.errors.map((err, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-muted-foreground">
                          {err.row}
                        </TableCell>
                        <TableCell className="text-destructive">
                          {err.message}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {result.errors.length === 0 && (
              <p className="text-sm text-muted-foreground">
                All {result.valid.length} rows are valid and ready to import.
              </p>
            )}
          </div>
        )}

        {step === "done" && (
          <div className="flex flex-col items-center gap-2 py-4">
            <p className="text-sm font-medium text-green-600">
              Import completed successfully!
            </p>
          </div>
        )}

        <DialogFooter>
          {step === "review" && (
          <>
            <Button variant="outline" onClick={() => { reset(); }}>
              Choose Different File
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={importing || !result || result.valid.length === 0}
            >
              {importing ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                "Import"
              )}
              {result ? result.valid.length : 0} Row(s)
            </Button>
          </>
        )}
          {step === "pick" && (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
