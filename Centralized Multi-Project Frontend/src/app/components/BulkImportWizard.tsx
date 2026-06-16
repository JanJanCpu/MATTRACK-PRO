import React, { useState } from "react";
import Papa from "papaparse";
import { Upload, ArrowRight, CheckCircle2, AlertCircle, X } from "lucide-react";
import { inventoryAPI } from "../../services/apiService";
import type { ProjectSite } from "../../types";

const REQUIRED_FIELDS = [
  { key: "item_name", label: "Item / Product Name" },
  { key: "quantity", label: "Quantity / Stock Level" },
  { key: "unit", label: "Unit (e.g., bags, pcs)" },
  { key: "brand", label: "Brand / Manufacturer" },
];

interface BulkImportWizardProps {
  sitesList: ProjectSite[];
  onComplete: () => void;
  onCancel: () => void;
}

export function BulkImportWizard({ sitesList, onComplete, onCancel }: BulkImportWizardProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<any[]>([]);
  const [targetSiteId, setTargetSiteId] = useState<number | "">(""); 
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [isUploading, setIsUploading] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!targetSiteId) {
      alert("Please select a target project site first.");
      e.target.value = "";
      return;
    }

    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: 'greedy',
      dynamicTyping: false, // Keep as string to handle quotes correctly
      complete: (results) => {
        if (results.meta.fields) {
          setCsvHeaders(results.meta.fields);
          setRawRows(results.data);
          setStep(2);
        }
      },
    });
  };

  const handleMapChange = (matTrackKey: string, csvHeader: string) => {
    setMappings((prev) => ({ ...prev, [matTrackKey]: csvHeader }));
  };

  const handleImport = async () => {
    if (!mappings.item_name || !mappings.quantity) {
      alert("You must map at least the Item Name and Quantity.");
      return;
    }

    setIsUploading(true);

    try {
      const formattedPayload = rawRows
        .map((row) => {
          // Helper to clean CSV strings: remove quotes, whitespace, and trim
          const clean = (val: any) => String(val || "").replace(/^["']|["']$/g, "").trim();
          
          const rawQty = clean(row[mappings.quantity]);
          const parsedQty = parseFloat(rawQty);
          const safeQty = isNaN(parsedQty) ? 0 : parsedQty;

          return {
            item_name: clean(row[mappings.item_name]).substring(0, 50),
            quantity: safeQty,
            unit: clean(row[mappings.unit] || "pcs").substring(0, 20),
            brand: clean(row[mappings.brand] || "Generic").substring(0, 50),
            status: "Healthy",
            fsn_status: "FAST",
            site_id: Number(targetSiteId),
          };
        })
        .filter(item => item.item_name !== "" && item.item_name !== "Unknown Item");

      await inventoryAPI.bulkUploadMapped(formattedPayload);
      alert("Bulk import successful!");
      onComplete(); 
    } catch (error) {
      alert("Import failed. Please check your data format.");
      console.error(error);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="bg-white p-6 border border-neutral-200 rounded-xl shadow-sm mb-6 relative">
      <div className="flex items-center justify-between mb-6 border-b pb-4">
        <h2 className="font-bold text-lg text-neutral-900">Bulk Inventory Import</h2>
        <button onClick={onCancel} className="p-1 hover:bg-neutral-100 rounded-md text-neutral-400"><X className="w-5 h-5" /></button>
      </div>

      {step === 1 && (
        <div className="max-w-xl mx-auto space-y-6">
          <select value={targetSiteId} onChange={(e) => setTargetSiteId(Number(e.target.value))} className="w-full p-3 border rounded-lg">
            <option value="" disabled>Select a site...</option>
            {sitesList.map((site) => <option key={site.id} value={site.id}>{site.site_name}</option>)}
          </select>
          <div className="text-center p-10 border-2 border-dashed rounded-lg">
            <input type="file" accept=".csv" id="csv-upload" className="hidden" onChange={handleFileUpload} />
            <label htmlFor="csv-upload" className="px-6 py-2 bg-slate-900 text-white rounded-lg cursor-pointer">Select CSV File</label>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="animate-in fade-in duration-300">
          <div className="space-y-4 max-w-2xl mx-auto">
            {REQUIRED_FIELDS.map((field) => (
              <div key={field.key} className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg">
                <span className="font-bold text-sm text-neutral-700 w-1/3">{field.label}</span>
                <select className="w-1/2 p-2 border rounded" onChange={(e) => handleMapChange(field.key, e.target.value)}>
                  <option value="">Select column...</option>
                  {csvHeaders.map((header) => <option key={header} value={header}>{header}</option>)}
                </select>
              </div>
            ))}
          </div>
          <div className="mt-8 flex justify-end gap-3 border-t pt-4">
            <button onClick={() => setStep(1)} className="px-4 py-2 text-neutral-500">Back</button>
            <button onClick={handleImport} disabled={isUploading} className="px-6 py-2 bg-emerald-600 text-white rounded-lg font-bold">
              {isUploading ? "Importing..." : "Confirm & Import"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}