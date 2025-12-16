import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Store, Upload, CheckCircle2, ArrowRight, ArrowLeft, FileSpreadsheet } from "lucide-react";

const Setup = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [shopData, setShopData] = useState({ name: "", city: "" });
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);

  const steps = [
    { number: 1, title: "Store Details", icon: Store },
    { number: 2, title: "Import Data", icon: Upload },
    { number: 3, title: "Complete", icon: CheckCircle2 },
  ];

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      setUploadedFile(file.name);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFile(file.name);
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
              <Label htmlFor="city">City / Location</Label>
              <Input
                id="city"
                placeholder="e.g., Berlin"
                value={shopData.city}
                onChange={(e) => setShopData({ ...shopData, city: e.target.value })}
                className="h-11"
              />
            </div>
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
                  <p className="font-medium text-foreground">{uploadedFile}</p>
                  <p className="text-sm text-muted-foreground">File uploaded successfully</p>
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
              <p className="text-sm text-muted-foreground">Step {currentStep} of 3</p>
              <h2 className="text-xl font-semibold text-foreground">{steps[currentStep - 1].title}</h2>
            </div>

            {renderStepContent()}

            {/* Navigation */}
            <div className="flex justify-between mt-8 pt-6 border-t">
              {currentStep > 1 && currentStep < 3 ? (
                <Button variant="ghost" onClick={() => setCurrentStep(currentStep - 1)}>
                  <ArrowLeft className="w-4 h-4 mr-2" /> Back
                </Button>
              ) : (
                <div />
              )}
              {currentStep < 3 ? (
                <Button variant="hero" onClick={() => setCurrentStep(currentStep + 1)}>
                  Continue <ArrowRight className="w-4 h-4 ml-2" />
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
