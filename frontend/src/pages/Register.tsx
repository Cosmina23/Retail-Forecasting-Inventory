import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import AuthLayout from "@/components/layouts/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { apiService } from "@/services/api";
import { useToast } from "@/hooks/use-toast";

const Register = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    companyName: "",
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await apiService.register(formData.email, formData.password, formData.fullName);
      toast({
        title: "Success!",
        description: "Account created successfully",
      });
      navigate("/setup");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Registration failed",
        description: error.message || "Could not create account",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
  };

  return (
    <AuthLayout
      testimonial={{
        quote: "Setup was done in less than 10 minutes. Highly recommended for every retailer.",
        author: "Sarah Weber",
        role: "Owner, Fashion Boutique Berlin"
      }}
    >
      <div className="space-y-6">
        <div className="space-y-2 text-center lg:text-left">
          {/* LOGO NOU - Apare doar pe ecrane mici, centrat */}
          <div className="lg:hidden flex items-center justify-center mb-8">
            <img
              src="/photos/stok_no_bg.png"
              alt="App Logo"
              className="h-14 w-auto object-contain"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>

          <h1 className="text-2xl font-bold text-foreground">Create an account</h1>
          <p className="text-muted-foreground">
            Start your 14-day free trial
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input
              id="fullName"
              type="text"
              placeholder="John Smith"
              value={formData.fullName}
              onChange={handleChange("fullName")}
              className="h-11"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Work Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="name@company.com"
              value={formData.email}
              onChange={handleChange("email")}
              className="h-11"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Min. 8 characters"
              value={formData.password}
              onChange={handleChange("password")}
              className="h-11"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="companyName">Company Name</Label>
            <Input
              id="companyName"
              type="text"
              placeholder="Company Inc."
              value={formData.companyName}
              onChange={handleChange("companyName")}
              className="h-11"
            />
          </div>

          <div className="flex items-start space-x-2">
            <Checkbox id="terms" className="mt-1" required />
            <label htmlFor="terms" className="text-sm text-muted-foreground cursor-pointer">
              I accept the{" "}
              <Link to="/terms" className="text-primary hover:underline">Terms of Service</Link>
              {" "}and{" "}
              <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link>
            </label>
          </div>

          <Button type="submit" variant="hero" size="xl" className="w-full" disabled={isLoading}>
            {isLoading ? "Creating Account..." : "Sign Up Free"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link to="/login" className="text-primary font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
};

export default Register;