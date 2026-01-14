import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Store, Upload, CheckCircle2, ArrowRight, ArrowLeft, FileSpreadsheet, Loader2, Check, ChevronsUpDown } from "lucide-react";
import { apiService } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface NewStoreDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStoreCreated: () => void;
}

export function NewStoreDialog({ open, onOpenChange, onStoreCreated }: NewStoreDialogProps) {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [shopData, setShopData] = useState({ name: "", market: "", address: "" });
  const [storeId, setStoreId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedSaleFile, setUploadedSaleFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [openStoreType, setOpenStoreType] = useState(false);

  const storeTypes = [
    "Electronics",
    "Retail",
    "Grocery",
    "Clothing",
    "Furniture",
    "Books",
    "Pharmacy",
    "Sports",
    "Toys",
    "Hardware",
    "Automotive",
    "Beauty",
    "Pet Supplies",
    "Office Supplies",
    "Home & Garden",
  ];

  const steps = [
    { number: 1, title: "Store Details", icon: Store },
    { number: 2, title: "Import Inventory", icon: Upload },
    { number: 3, title: "Import Sales", icon: Upload },
    { number: 4, title: "Complete", icon: CheckCircle2 },
  ];

  // Inventory Drag and Drop
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.csv'))) {
      setUploadedFile(file);
    } else {
      toast({
        variant: "destructive",
        title: "Invalid file type",
        description: "Please upload an Excel or CSV file (.xlsx, .xls, or .csv)",
      });
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFile(file);
    }
  };

  const handleUploadToBackend = async () => {
    if (!uploadedFile || !storeId) {
      toast({
        variant: "destructive",
        title: "Missing Store",
        description: "Please create a store before importing products.",
      });
      return;
    }

    setIsUploading(true);
    try {
      const result = await apiService.importProducts(uploadedFile, storeId);
      const imported = result.inserted_or_updated ?? result.inserted_count ?? 0;
      const errorCount = Array.isArray(result.errors) ? result.errors.length : 0;
      toast({
        title: "Success!",
        description: `Imported ${imported} products successfully${errorCount ? `, ${errorCount} rows had issues` : ""}`,
      });
      setCurrentStep(3);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: error.message || "Could not upload file",
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Sales Drag and Upload
  const handleSalesDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.csv'))) {
      setUploadedSaleFile(file);
    } else {
      toast({
        variant: "destructive",
        title: "Invalid file type",
        description: "Please upload an Excel or CSV file (.xlsx, .xls, or .csv)",
      });
    }
  };

  const handleFileSalesSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedSaleFile(file);
    }
  };

  const handleUploadSalesToBackend = async () => {
    if (!uploadedSaleFile || !storeId) {
      toast({
        variant: "destructive",
        title: "Missing Store",
        description: "Please create a store before importing sales.",
      });
      return;
    }

    setIsUploading(true);
    try {
      const result = await apiService.importSales(uploadedSaleFile, storeId);
      const imported = result.inserted_or_updated ?? result.inserted_count ?? 0;
      const errorCount = Array.isArray(result.errors) ? result.errors.length : 0;
      toast({
        title: "Success!",
        description: `Imported ${imported} sales successfully${errorCount ? `, ${errorCount} rows had issues` : ""}`,
      });
      setCurrentStep(4);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: error.message || "Could not upload file",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    if (!isUploading) {
      // Reset all state
      setCurrentStep(1);
      setShopData({ name: "", market: "", address: "" });
      setStoreId(null);
      setUploadedFile(null);
      setUploadedSaleFile(null);
      onOpenChange(false);
      
      // If we completed the flow, notify parent
      if (currentStep === 4) {
        onStoreCreated();
      }
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="shopName">Store Name</Label>
              <Input
                id="shopName"
                placeholder="e.g., Berlin Alexanderplatz"
                value={shopData.name}
                onChange={(e) => setShopData({ ...shopData, name: e.target.value })}
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="market">Store Type</Label>
              <Popover open={openStoreType} onOpenChange={setOpenStoreType}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={openStoreType}
                    className="h-11 w-full justify-between"
                  >
                    {shopData.market || "Select store type..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                  <Command>
                    <CommandInput placeholder="Search store type..." />
                    <CommandList onWheel={(e) => e.stopPropagation()}>
                      <CommandEmpty>No store type found.</CommandEmpty>
                      <CommandGroup>
                        {storeTypes.map((type) => (
                          <CommandItem
                            key={type}
                            value={type}
                            onSelect={(currentValue) => {
                              setShopData({ ...shopData, market: currentValue === shopData.market.toLowerCase() ? "" : type });
                              setOpenStoreType(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                shopData.market === type ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {type}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                placeholder="e.g., Alexanderplatz 1, Berlin"
                value={shopData.address}
                onChange={(e) => setShopData({ ...shopData, address: e.target.value })}
                className="h-11"
              />
            </div>
          </div>
        );
      case 2:
        return (
          <div className="space-y-4">
            <div
              className={`border-2 border-dashed rounded-xl p-10 text-center transition-all duration-200 ${
                isDragging
                  ? "border-primary bg-accent"
                  : uploadedFile
                  ? "border-success bg-success/5"
                  : "border-border hover:border-primary/50 hover:bg-accent/50"
              }`}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
            >
              {uploadedFile ? (
                <div className="space-y-3">
                  <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center mx-auto">
                    <FileSpreadsheet className="w-6 h-6 text-success" />
                  </div>
                  <p className="font-medium text-foreground">{uploadedFile.name}</p>
                  <p className="text-sm text-muted-foreground">File ready to upload</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setUploadedFile(null)}
                  >
                    Remove
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center mx-auto">
                    <Upload className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Drag and drop Excel file here</p>
                    <p className="text-sm text-muted-foreground">or click to browse</p>
                  </div>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="file-upload"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => document.getElementById("file-upload")?.click()}
                  >
                    Select File
                  </Button>
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Supported formats: .xlsx, .xls, .csv
            </p>
          </div>
        );
      case 3:
        return (
          <div className="space-y-4">
            <div
              className={`border-2 border-dashed rounded-xl p-10 text-center transition-all duration-200 ${
                isDragging
                  ? "border-primary bg-accent"
                  : uploadedSaleFile
                  ? "border-success bg-success/5"
                  : "border-border hover:border-primary/50 hover:bg-accent/50"
              }`}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleSalesDrop}
            >
              {uploadedSaleFile ? (
                <div className="space-y-3">
                  <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center mx-auto">
                    <FileSpreadsheet className="w-6 h-6 text-success" />
                  </div>
                  <p className="font-medium text-foreground">{uploadedSaleFile.name}</p>
                  <p className="text-sm text-muted-foreground">File ready to upload</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setUploadedSaleFile(null)}
                  >
                    Remove
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center mx-auto">
                    <Upload className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Drag and drop Excel file here</p>
                    <p className="text-sm text-muted-foreground">or click to browse</p>
                  </div>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileSalesSelect}
                    className="hidden"
                    id="sales-file-upload"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => document.getElementById("sales-file-upload")?.click()}
                  >
                    Select File
                  </Button>
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Supported formats: .xlsx, .xls, .csv
            </p>
          </div>
        );
      case 4:
        return (
          <div className="text-center space-y-6">
            <div className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10 text-success" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-semibold text-foreground">All Set!</h3>
              <p className="text-muted-foreground">
                Your store has been successfully configured with inventory and sales data.
              </p>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>
            {currentStep === 4 ? "Store Created!" : "Create New Store"}
          </DialogTitle>
          <DialogDescription>
            {currentStep === 1 && "Add a new store and import its data"}
            {currentStep === 2 && "Upload inventory data for your new store"}
            {currentStep === 3 && "Upload sales history for your new store"}
            {currentStep === 4 && "Your new store is ready to use"}
          </DialogDescription>
        </DialogHeader>

        {/* Stepper */}
        <div className="flex items-center justify-center my-4">
          {steps.map((step, idx) => (
            <div key={step.number} className="flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
                    currentStep >= step.number
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {currentStep > step.number ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    <step.icon className="w-4 h-4" />
                  )}
                </div>
                <span className={`text-[10px] mt-1 ${currentStep >= step.number ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                  {step.title}
                </span>
              </div>
              {idx < steps.length - 1 && (
                <div className={`w-12 h-0.5 mx-1 mb-4 transition-colors duration-300 ${
                  currentStep > step.number ? "bg-primary" : "bg-border"
                }`} />
              )}
            </div>
          ))}
        </div>

        <div className="py-4">
          {renderStepContent()}
        </div>

        {/* Navigation */}
        <div className="flex justify-between pt-4 border-t">
          {currentStep > 1 && currentStep < 4 ? (
            <Button variant="ghost" onClick={() => setCurrentStep(currentStep - 1)} disabled={isUploading}>
              <ArrowLeft className="w-4 h-4 mr-2" /> Back
            </Button>
          ) : (
            <div />
          )}
          {currentStep < 4 ? (
            <Button
              variant="default"
              onClick={async () => {
                if (currentStep === 1) {
                  // Create store
                  if (!shopData.name || !shopData.market) {
                    toast({
                      variant: "destructive",
                      title: "Missing information",
                      description: "Please fill in all required fields",
                    });
                    return;
                  }
                  try {
                    const store = await apiService.createStore({
                      name: shopData.name,
                      market: shopData.market,
                      address: shopData.address || "Default Address",
                    });
                    setStoreId(store.id);
                    toast({ title: "Store created!", description: `Store ${store.name} created successfully.` });
                    setCurrentStep(2);
                  } catch (error: any) {
                    toast({
                      variant: "destructive",
                      title: "Store creation failed",
                      description: error.message || "Could not create store",
                    });
                  }
                } else if (currentStep === 2) {
                  if (uploadedFile) {
                    await handleUploadToBackend();
                  } else {
                    // Skip inventory import
                    setCurrentStep(3);
                  }
                } else if (currentStep === 3) {
                  if (uploadedSaleFile) {
                    await handleUploadSalesToBackend();
                  } else {
                    // Skip sales import
                    setCurrentStep(4);
                  }
                }
              }}
              disabled={
                isUploading ||
                (currentStep === 1 && (!shopData.name || !shopData.market))
              }
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  {currentStep === 1 && "Create Store"}
                  {currentStep === 2 && (uploadedFile ? "Upload & Continue" : "Skip")}
                  {currentStep === 3 && (uploadedSaleFile ? "Upload & Continue" : "Skip")}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          ) : (
            <Button variant="default" onClick={handleClose}>
              Done
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}