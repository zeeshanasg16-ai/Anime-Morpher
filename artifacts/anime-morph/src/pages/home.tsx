import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Video, ImageIcon, Zap, Shield, Download, ArrowRight, Play } from "lucide-react";

const styles = [
  { name: "Anime", color: "from-purple-500 to-pink-500", desc: "Classic Japanese animation style" },
  { name: "Ghibli", color: "from-green-400 to-teal-500", desc: "Soft, painterly Studio Ghibli aesthetic" },
  { name: "Cyberpunk", color: "from-cyan-400 to-blue-600", desc: "Neon-lit dystopian future" },
  { name: "Cartoon", color: "from-yellow-400 to-orange-500", desc: "Bold outlines, vivid colors" },
  { name: "Watercolor", color: "from-pink-400 to-rose-500", desc: "Delicate, painterly watercolor washes" },
];

const steps = [
  { n: "01", title: "Upload your media", desc: "Drop in a video up to 10 minutes or a photo. We support MP4, MOV, JPG, PNG, and WEBP." },
  { n: "02", title: "Choose your style", desc: "Pick from Anime, Ghibli, Cyberpunk, Cartoon, or Watercolor. Each style uses a distinct AI model." },
  { n: "03", title: "AI transforms it", desc: "Our pipeline extracts frames, runs face and pose detection, applies the AI transformation, and rebuilds the video." },
  { n: "04", title: "Download the result", desc: "Your finished video or animated image is ready. Download the MP4 and share it anywhere." },
];

const features = [
  { icon: Video, title: "Video Morphing", desc: "Transform up to 10-minute videos frame-by-frame. Original audio is preserved in the output." },
  { icon: ImageIcon, title: "Photo Animation", desc: "Turn a single photo into an animated, stylized video clip with expressive motion." },
  { icon: Zap, title: "Fast Queue", desc: "Jobs are processed asynchronously with a live progress tracker so you always know where you stand." },
  { icon: Shield, title: "Secure Storage", desc: "All uploads and outputs are stored securely. Your files stay private." },
  { icon: Download, title: "One-click Export", desc: "Download your final MP4 instantly. No watermarks, no compression." },
  { icon: Sparkles, title: "5 AI Styles", desc: "Anime, Ghibli, Cyberpunk, Cartoon, Watercolor — more styles added regularly." },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* Nav */}
      <header className="fixed top-0 inset-x-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-primary/20 flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
            </div>
            <span className="font-bold text-base tracking-tight">AnimeMorph <span className="text-primary">AI</span></span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/sign-in">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground" data-testid="link-sign-in">
                Sign in
              </Button>
            </Link>
            <Link href="/sign-up">
              <Button size="sm" className="bg-primary hover:bg-primary/90 shadow-[0_0_20px_rgba(147,51,234,0.3)] transition-all hover:shadow-[0_0_30px_rgba(147,51,234,0.5)]" data-testid="link-sign-up">
                Start free
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative pt-32 pb-24 px-6 overflow-hidden">
        {/* Glow bg */}
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-primary/12 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute top-40 left-1/4 w-[400px] h-[300px] bg-accent/8 rounded-full blur-[100px] pointer-events-none" />

        <div className="max-w-5xl mx-auto text-center relative">
          <Badge className="mb-6 bg-primary/10 text-primary border-primary/20 px-4 py-1.5 text-xs font-medium tracking-wide uppercase" data-testid="badge-hero">
            AI Video Transformation Studio
          </Badge>

          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight leading-[1.05] mb-6" data-testid="heading-hero">
            Turn your reality into
            <br />
            <span className="bg-gradient-to-r from-primary via-purple-400 to-accent bg-clip-text text-transparent">
              anime art
            </span>
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed" data-testid="text-hero-description">
            Upload a video or photo and watch AI transform every frame into stunning anime, Ghibli, cyberpunk, or cartoon art. Original audio preserved. Download in minutes.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/sign-up">
              <Button size="lg" className="bg-primary hover:bg-primary/90 text-white shadow-[0_0_30px_rgba(147,51,234,0.4)] transition-all hover:shadow-[0_0_50px_rgba(147,51,234,0.6)] px-8 h-12 text-base font-semibold" data-testid="button-hero-cta">
                Start transforming <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </Link>
            <Link href="/sign-in">
              <Button size="lg" variant="outline" className="border-border hover:border-primary/40 hover:bg-primary/5 px-8 h-12 text-base" data-testid="button-hero-signin">
                <Play className="mr-2 w-4 h-4 text-primary" />
                Sign in
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Styles grid */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4" data-testid="heading-styles">Five distinct AI styles</h2>
            <p className="text-muted-foreground text-lg">Each powered by its own fine-tuned diffusion model</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {styles.map((s) => (
              <div
                key={s.name}
                className="group relative overflow-hidden rounded-2xl border border-border hover:border-primary/30 bg-card/50 p-5 transition-all duration-300 hover:bg-card hover:shadow-[0_0_30px_rgba(147,51,234,0.08)] cursor-default"
                data-testid={`card-style-${s.name.toLowerCase()}`}
              >
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${s.color} mb-4 flex items-center justify-center shadow-lg`}>
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <h3 className="font-semibold text-foreground mb-1">{s.name}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-6 border-t border-border/50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4" data-testid="heading-how-it-works">How it works</h2>
            <p className="text-muted-foreground text-lg">Four steps from upload to download</p>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            {steps.map((step) => (
              <div key={step.n} className="flex gap-5" data-testid={`step-${step.n}`}>
                <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <span className="text-primary font-mono text-sm font-bold">{step.n}</span>
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-2">{step.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6 border-t border-border/50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4" data-testid="heading-features">Everything you need</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {features.map((f) => (
              <div
                key={f.title}
                className="p-6 rounded-2xl border border-border bg-card/30 hover:bg-card/60 hover:border-primary/20 transition-all duration-300"
                data-testid={`card-feature-${f.title.toLowerCase().replace(/\s+/g, "-")}`}
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <f.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 border-t border-border/50 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent pointer-events-none" />
        <div className="max-w-3xl mx-auto text-center relative">
          <h2 className="text-4xl md:text-5xl font-extrabold mb-6" data-testid="heading-cta">
            Ready to morph?
          </h2>
          <p className="text-muted-foreground text-lg mb-10">
            Create your free studio account and transform your first video in minutes.
          </p>
          <Link href="/sign-up">
            <Button size="lg" className="bg-primary hover:bg-primary/90 shadow-[0_0_40px_rgba(147,51,234,0.4)] hover:shadow-[0_0_60px_rgba(147,51,234,0.6)] transition-all px-10 h-14 text-lg font-semibold" data-testid="button-cta-signup">
              Get started — it's free <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-border/50">
        <div className="max-w-6xl mx-auto flex items-center justify-between text-sm text-muted-foreground">
          <span>AnimeMorph AI</span>
          <span>Powered by Replit</span>
        </div>
      </footer>
    </div>
  );
}
