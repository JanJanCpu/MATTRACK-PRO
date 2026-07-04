import React, { useState } from 'react';
import { Upload, X, Check, ArrowRight, Download, FileSpreadsheet } from 'lucide-react';
import Papa from 'papaparse';
import { inventoryAPI } from '../../services/apiService';
import type { ProjectSite, Supplier } from '../../types';

interface BulkImportWizardProps {
  sitesList: ProjectSite[];
  suppliersList: Supplier[];
  onComplete: () => void;
  onCancel: () => void;
}

const REQUIRED_FIELDS = ['item_name', 'quantity', 'unit', 'site_id'];
const OPTIONAL_FIELDS = ['brand', 'supplier_id', 'batch_rating'];

export function BulkImportWizard({ sitesList, suppliersList, onComplete, onCancel }: BulkImportWizardProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- FIXED: Download Standard Template Function ---
  const handleDownloadTemplate = (e: React.MouseEvent) => {
    e.preventDefault(); // Stop React Router from intercepting the link
    e.stopPropagation(); // Stop event from bubbling up

    const templateHeaders = [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS].join(',');
    const sampleRow = 'Portland Cement,100,Bags,1,Republic,2,4.5';
    const csvContent = "data:text/csv;charset=utf-8," + templateHeaders + "\n" + sampleRow;
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "MatTrack_Import_Template.csv");
    link.setAttribute("target", "_blank"); // Force the browser to handle the download directly
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.data.length === 0) {
          setError("The uploaded file appears to be empty.");
          return;
        }
        setHeaders(results.meta.fields || []);
        setParsedData(results.data);
        
        // Auto-map obvious headers
        const autoMap: Record<string, string> = {};
        (results.meta.fields || []).forEach(header => {
          const lower = header.toLowerCase().replace(/[^a-z0-9]/g, '');
          [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS].forEach(field => {
            if (field.replace(/_/g, '') === lower) autoMap[field] = header;
          });
        });
        setMapping(autoMap);
        setStep(2);
      },
      error: (error) => {
        setError(`Failed to parse CSV: ${error.message}`);
      }
    });
  };

  const handleMappingChange = (systemField: string, csvHeader: string) => {
    setMapping(prev => ({ ...prev, [systemField]: csvHeader }));
  };

  const validateMapping = () => {
    const missing = REQUIRED_FIELDS.filter(f => !mapping[f]);
    if (missing.length > 0) {
      setError(`Please map all required fields: ${missing.join(', ')}`);
      return false;
    }
    setError(null);
    return true;
  };

  const handleProcessImport = async () => {
    if (!validateMapping()) return;
    setStep(3);
    setUploading(true);

    try {
      const formattedData = parsedData.map(row => {
        const item: any = {
          item_name: row[mapping.item_name],
          brand: mapping.brand && row[mapping.brand] ? row[mapping.brand] : "Generic/No Brand",
          quantity: parseFloat(row[mapping.quantity]) || 0,
          unit: row[mapping.unit],
          status: "Healthy", 
          fsn_status: "FAST", 
          site_id: parseInt(row[mapping.site_id], 10),
        };

        if (mapping.supplier_id && row[mapping.supplier_id]) {
          item.supplier_id = parseInt(row[mapping.supplier_id], 10);
        }
        if (mapping.batch_rating && row[mapping.batch_rating]) {
          item.batch_rating = parseFloat(row[mapping.batch_rating]);
        }

        return item;
      });

      const validData = formattedData.filter(i => i.item_name && i.quantity > 0 && !isNaN(i.site_id));

      if (validData.length === 0) {
        throw new Error("No valid rows found after mapping. Please check your data types.");
      }

      await inventoryAPI.bulkUploadMapped(validData);
      onComplete();
      
    } catch (err: any) {
      setError(err.message || "Failed to process bulk upload.");
      setStep(2); 
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-xl border border-emerald-200 shadow-sm animate-in slide-in-from-top-4 mb-6">
      <div className="flex justify-between items-center mb-6 pb-4 border-b border-neutral-100">
        <div>
          <h2 className="text-lg font-bold text-neutral-900">Bulk Import Wizard</h2>
          <p className="text-sm text-neutral-500">Upload multiple inventory items from a spreadsheet.</p>
        </div>
        <button onClick={onCancel} className="p-2 text-neutral-400 hover:bg-neutral-100 rounded-lg">
          <X className="w-5 h-5" />
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg text-sm font-medium border border-red-200">
          {error}
        </div>
      )}

      {/* STEP 1: UPLOAD */}
      {step === 1 && (
        <div className="space-y-6">
          {/* --- NEW: DOWNLOAD TEMPLATE SECTION --- */}
          <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-200 text-slate-700 rounded-lg">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Need the exact format?</h3>
                <p className="text-xs text-slate-500">Download our standard CSV template to guarantee a perfect import.</p>
              </div>
            </div>
            <button 
              onClick={(e) => handleDownloadTemplate(e)}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-lg text-sm font-bold transition-colors shadow-sm"
            >
              <Download className="w-4 h-4" /> Download Template
            </button>
          </div>

          <div className="border-2 border-dashed border-neutral-300 rounded-xl p-12 text-center hover:border-emerald-500 hover:bg-emerald-50/50 transition-colors relative group">
            <input 
              type="file" 
              accept=".csv"
              onChange={handleFileUpload}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <Upload className="w-10 h-10 text-emerald-500 mx-auto mb-4 group-hover:scale-110 transition-transform" />
            <h3 className="text-base font-bold text-neutral-900 mb-1">Click or drag CSV file to upload</h3>
            <p className="text-sm text-neutral-500">Only .csv files are supported. Max size 5MB.</p>
          </div>
        </div>
      )}

      {/* STEP 2: MAPPING */}
      {step === 2 && (
        <div className="space-y-6">
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
            <h3 className="font-bold text-blue-800 text-sm mb-1">Map Your Columns</h3>
            <p className="text-xs text-blue-600">Match the columns from your uploaded file to MatTrack's required fields. We've auto-mapped the obvious ones.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <h4 className="font-bold text-sm text-neutral-900 border-b pb-2">Required Fields</h4>
              {REQUIRED_FIELDS.map(field => (
                <div key={field} className="flex items-center justify-between gap-4">
                  <label className="text-sm font-medium text-neutral-700 w-1/3">
                    {field.replace('_', ' ').toUpperCase()} <span className="text-red-500">*</span>
                  </label>
                  <select 
                    className="w-2/3 p-2 bg-neutral-50 border border-neutral-200 rounded-lg text-sm focus:border-emerald-500 outline-none"
                    value={mapping[field] || ""}
                    onChange={(e) => handleMappingChange(field, e.target.value)}
                  >
                    <option value="">-- Select Column --</option>
                    {headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              ))}
            </div>

            <div className="space-y-4">
              <h4 className="font-bold text-sm text-neutral-900 border-b pb-2">Optional Add-ons</h4>
              {OPTIONAL_FIELDS.map(field => (
                <div key={field} className="flex items-center justify-between gap-4">
                  <label className="text-sm font-medium text-neutral-700 w-1/3">
                    {field.replace('_', ' ').toUpperCase()}
                  </label>
                  <select 
                    className="w-2/3 p-2 bg-neutral-50 border border-neutral-200 rounded-lg text-sm focus:border-emerald-500 outline-none"
                    value={mapping[field] || ""}
                    onChange={(e) => handleMappingChange(field, e.target.value)}
                  >
                    <option value="">-- Skip / Ignore --</option>
                    {headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-6 border-t border-neutral-100">
            <button onClick={() => setStep(1)} className="px-6 py-2 text-neutral-600 font-bold hover:bg-neutral-100 rounded-lg text-sm">
              Back
            </button>
            <button onClick={handleProcessImport} className="px-6 py-2 bg-emerald-600 text-white font-bold rounded-lg text-sm hover:bg-emerald-700 flex items-center gap-2">
              Process {parsedData.length} Rows <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: PROCESSING */}
      {step === 3 && (
        <div className="py-12 text-center space-y-4">
          {uploading ? (
            <>
              <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mx-auto"></div>
              <h3 className="font-bold text-neutral-900">Validating and Importing Data...</h3>
              <p className="text-sm text-neutral-500">Please do not close this window.</p>
            </>
          ) : (
            <>
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-neutral-900">Import Successful!</h3>
              <p className="text-sm text-neutral-500">Your network inventory has been updated.</p>
            </>
          )}
        </div>
      )}

    </div>
  );
}