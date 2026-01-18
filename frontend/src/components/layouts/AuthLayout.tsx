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
    quote: "Stok revolutionized our inventory management. We reduced our storage costs by 30%.",
    author: "Thomas Miller",
    role: "CEO, TechRetail Inc."
  };

  const quote = testimonial || defaultTestimonial;

  return (
    <div className="min-h-screen flex bg-white font-sans lg:flex-row-reverse">
      {/* Right Side - Modern Blue Mesh Gradient (Acum conține Formularul) */}
      <div className="hidden lg:flex lg:w-[45%] relative overflow-hidden bg-[#0052FF] items-center justify-center p-12">
        {/* Abstract background shapes */}
        <div className="absolute top-[-10%] right-[-10%] w-[70%] h-[70%] bg-[#00A3FF] rounded-full blur-[120px] opacity-50" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[60%] h-[60%] bg-[#0500FF] rounded-full blur-[120px] opacity-30" />

        {/* Form Container with Glass Effect on the Blue side */}
        <div className="relative z-20 w-full max-w-md bg-white/95 backdrop-blur-xl p-10 rounded-[2.5rem] shadow-2xl border border-white/20 animate-fade-in">
          {children}
        </div>
      </div>

      {/* Left Side - Clean White (Acum conține Logo-ul și Testimonialul) */}
      <div className="flex-1 flex flex-col justify-between p-12 bg-slate-50/50">
        {/* Logo Section - Blue Logo on White background for maximum visibility */}
        <div className="flex items-center justify-center lg:justify-start">
          <img
            src="/photos/stok_no_bg.png"
            alt="App Logo"
            className="h-20 w-auto object-contain transition-transform hover:scale-105"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        </div>

        {/* Testimonial Section */}
        <div className="max-w-xl mx-auto lg:mx-0 space-y-8 animate-fade-up">
          <div className="space-y-4">
            <div className="h-1.5 w-20 bg-primary rounded-full" />
            <blockquote className="text-3xl font-bold leading-tight text-slate-900 italic">
              "{quote.quote}"
            </blockquote>
          </div>

          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xl">
              {quote.author.charAt(0)}
            </div>
            <div>
              <p className="font-bold text-slate-900 text-lg">{quote.author}</p>
              <p className="text-slate-500 font-medium uppercase tracking-widest text-xs">{quote.role}</p>
            </div>
          </div>

          {/* Pagination dots for the white side */}
          <div className="flex gap-2 pt-4">
            <div className="w-8 h-2 rounded-full bg-primary" />
            <div className="w-2 h-2 rounded-full bg-slate-200" />
            <div className="w-2 h-2 rounded-full bg-slate-200" />
          </div>
        </div>

        {/* Mobile Form View (Visible only on small screens) */}
        <div className="lg:hidden w-full max-w-md mx-auto mt-8">
            {children}
        </div>

        {/* Footer info (optional) */}
        <div className="hidden lg:block text-slate-400 text-sm">
          © 2026 Stok. All rights reserved.
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;