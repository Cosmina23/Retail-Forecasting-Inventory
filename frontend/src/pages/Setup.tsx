import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Store, Upload, CheckCircle2, ArrowRight, ArrowLeft, FileSpreadsheet, Loader2, Check, ChevronsUpDown, MapPin } from "lucide-react";
import { apiService } from "@/services/api";
import { locationService, LocationSuggestion } from "@/services/location";
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
// Removed Node's console import which breaks in browser

const Setup = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [shopData, setShopData] = useState({ name: "", market: "" ,adress:""});
  const [storeId, setStoreId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedSaleFile, setUploadedSaleFile] = useState<File|null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [openStoreType, setOpenStoreType] = useState(false);
  const [locationSuggestions, setLocationSuggestions] = useState<LocationSuggestion[]>([]);
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout>();

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

  // Debounced location search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (shopData.adress && shopData.adress.length >= 3) {
      setIsSearchingLocation(true);
      searchTimeoutRef.current = setTimeout(async () => {
        const results = await locationService.searchLocations(shopData.adress);
        setLocationSuggestions(results);
        setShowLocationDropdown(results.length > 0);
        setIsSearchingLocation(false);
      }, 500);
    } else {
      setLocationSuggestions([]);
      setShowLocationDropdown(false);
      setIsSearchingLocation(false);
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [shopData.adress]);

  const steps = [
    { number: 1, title: "Store Details", icon: Store },
    { number: 2, title: "Import Inventory", icon: Upload },
    {number: 3, title:"Import Sales", icon: Upload},
    { number: 4, title: "Complete", icon: CheckCircle2 },
  ];

  // Inventory Drag and Drop
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
      setUploadedFile(file);
    } else {
      toast({
        variant: "destructive",
        title: "Invalid file type",
        description: "Please upload an Excel file (.xlsx or .xls)",
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
      // Optionally, you can pass storeId to the backend if your import endpoint supports it
      const store_id = localStorage.getItem('store_id');
      const result = await apiService.importProducts(uploadedFile,store_id);
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
    if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
      setUploadedSaleFile(file);
    } else {
      toast({
        variant: "destructive",
        title: "Invalid file type",
        description: "Please upload an Excel file (.xlsx or .xls)",
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
      // Optionally, you can pass storeId to the backend if your import endpoint supports it
      const store_id = localStorage.getItem('store_id');
      console.log('store_id from localStorage:', store_id);
      console.log('Uploaded file:', uploadedSaleFile);
      const result = await apiService.importSales(uploadedSaleFile,store_id);
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



  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6 animate-fade-up">
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
            <div className="space-y-2 relative">
              <Label htmlFor="address">Address</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="address"
                  placeholder="Start typing an address..."
                  value={shopData.adress}
                  onChange={(e) => setShopData({ ...shopData, adress: e.target.value })}
                  className="h-11 pl-10"
                  autoComplete="off"
                />
                {isSearchingLocation && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </div>
              {showLocationDropdown && locationSuggestions.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md max-h-60 overflow-y-auto">
                  {locationSuggestions.map((suggestion, idx) => (
                    <button
                      key={idx}
                      type="button"
                      className="w-full text-left px-4 py-2 hover:bg-accent text-sm flex items-start gap-2"
                      onClick={() => {
                        const formattedAddress = locationService.formatAddress(suggestion);
                        setShopData({ ...shopData, adress: formattedAddress });
                        setShowLocationDropdown(false);
                        setLocationSuggestions([]);
                      }}
                    >
                      <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                      <span>{suggestion.display_name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Button
              variant="hero"
              className="mt-4"
              disabled={!shopData.name || !shopData.market}
              onClick={async () => {
                try {
                  const store = await apiService.createStore({
                    name: shopData.name,
                    market: shopData.market,
                    address: shopData.adress|| "Default Address", // Ensure address is provided
                  });
                  setStoreId(store.id);
                  localStorage.setItem('store_id',store.id);
                  localStorage.setItem('selected_store',store.id)
                  toast({ title: "Store created!", description: `Store ${store.name} created successfully.` });
                  setCurrentStep(2);
                } catch (error: any) {
                  toast({
                    variant: "destructive",
                    title: "Store creation failed",
                    description: error.message || "Could not create store",
                  });
                }
              }}
            >
              Create Store & Continue <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        );
      case 2:
        return (
          <div className="space-y-4 animate-fade-up">
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
          <div className="space-y-4 animate-fade-up">
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
          <div className="text-center space-y-6 animate-fade-up">
            <div className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10 text-success" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-semibold text-foreground">All Set!</h3>
              <p className="text-muted-foreground">
                Your store has been successfully configured. You can now start managing your inventory.
              </p>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
              <svg className="w-5 h-5 text-primary-foreground" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
            <span className="font-semibold text-foreground">StockSentinel</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate("/login")}>
            Cancel
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container py-12">
        <div className="max-w-xl mx-auto">
          {/* Stepper */}
          <div className="flex items-center justify-center mb-10">
            {steps.map((step, idx) => (
              <div key={step.number} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                      currentStep >= step.number
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {currentStep > step.number ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : (
                      <step.icon className="w-5 h-5" />
                    )}
                  </div>
                  <span className={`text-xs mt-2 ${currentStep >= step.number ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                    {step.title}
                  </span>
                </div>
                {idx < steps.length - 1 && (
                  <div className={`w-20 h-0.5 mx-2 mb-6 transition-colors duration-300 ${
                    currentStep > step.number ? "bg-primary" : "bg-border"
                  }`} />
                )}
              </div>
            ))}
          </div>

          {/* Card */}
          <div className="bg-card rounded-xl border shadow-card p-8">
            <div className="mb-6">
              <p className="text-sm text-muted-foreground">Step {currentStep} of {steps.length}</p>
              <h2 className="text-xl font-semibold text-foreground">{steps[currentStep - 1].title}</h2>
            </div>

            {renderStepContent()}

            {/* Navigation */}
            <div className="flex justify-between mt-8 pt-6 border-t">
              {currentStep > 1 && currentStep < 4 ? (
                <Button variant="ghost" onClick={() => setCurrentStep(currentStep - 1)}>
                  <ArrowLeft className="w-4 h-4 mr-2" /> Back
                </Button>
              ) : (
                <div />
              )}
              {currentStep < 4 ? (
                <Button
                  variant="hero"
                  onClick={() => {
                    if (currentStep === 2) {
                      if (uploadedFile) {
                        handleUploadToBackend();
                      }
                      return;
                    }
                    if (currentStep === 3) {
                      if (uploadedSaleFile) {
                        handleUploadSalesToBackend();
                      }
                      return;
                    }
                    setCurrentStep(currentStep + 1);
                  }}
                  disabled={
                    isUploading ||
                    (currentStep === 2 && !uploadedFile) ||
                    (currentStep === 3 && !uploadedSaleFile)
                  }
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      {(currentStep === 2 || currentStep === 3) ? 'Upload & Continue' : 'Continue'}
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              ) : (
                <Button variant="hero" onClick={() => navigate("/index")}>
                  Go to Dashboard <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Setup;
