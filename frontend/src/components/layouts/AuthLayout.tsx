import { ReactNode } from "react";

interface AuthLayoutProps {
  children: ReactNode;
  testimonial?: {
    quote: string;
    author: string;
    role: string;
  };
}

const AuthLayout = ({ children, testimonial }: AuthLayoutProps) => {
  const defaultTestimonial = {
    quote: "StockSentinel revolutionized our inventory management. We reduced our storage costs by 30%.",
    author: "Thomas Miller",
    role: "CEO, TechRetail Inc."
  };

  const quote = testimonial || defaultTestimonial;

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Gradient with Testimonial */}
      <div className="hidden lg:flex lg:w-1/2 gradient-hero relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%23ffffff%22%20fill-opacity%3D%220.05%22%3E%3Cpath%20d%3D%22M36%2034v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6%2034v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6%204V0H4v4H0v2h4v4h2V6h4V4H6z%22%2F%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E')] opacity-30" />
        
        <div className="relative z-10 flex flex-col justify-between p-12 text-primary-foreground">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary-foreground/20 flex items-center justify-center">
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
            <span className="text-xl font-semibold">StockSentinel</span>
          </div>
          
          <div className="space-y-6 max-w-md animate-fade-up">
            <blockquote className="text-2xl font-medium leading-relaxed">
              "{quote.quote}"
            </blockquote>
            <div>
              <p className="font-semibold">{quote.author}</p>
              <p className="text-primary-foreground/80">{quote.role}</p>
            </div>
          </div>
          
          <div className="flex gap-2">
            <div className="w-2 h-2 rounded-full bg-primary-foreground" />
            <div className="w-2 h-2 rounded-full bg-primary-foreground/40" />
            <div className="w-2 h-2 rounded-full bg-primary-foreground/40" />
          </div>
        </div>
      </div>
      
      {/* Right Side - Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md animate-fade-in">
          {children}
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;
