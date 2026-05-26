import { useState, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { useCreateJob, useRequestUploadUrl, getListJobsQueryKey, getGetJobStatsQueryKey, getGetRecentJobsQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Upload, ImageIcon, X, CheckCircle2, Loader2, AlertCircle } from "lucide-react";

const STYLES = [
  { value: "anime", label: "Anime", desc: "Classic Japanese animation style" },
  { value: "ghibli", label: "Ghibli", desc: "Soft, painterly Studio Ghibli aesthetic" },
  { value: "cyberpunk", label: "Cyberpunk", desc: "Neon-lit dystopian future" },
  { value: "cartoon", label: "Cartoon", desc: "Bold outlines, vivid colors" },
  { value: "watercolor", label: "Watercolor", desc: "Delicate painterly washes" },
];

const MAX_SIZE = 20 * 1024 * 1024; // 20MB
const ACCEPT = "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp";

type UploadState = "idle" | "uploading" | "submitting" | "done" | "error";

export default function UploadPhoto() {
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [title, setTitle] = useState("");
  const [style, setStyle] = useState("anime");
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const requestUrl = useRequestUploadUrl();
  const createJob = useCreateJob();

  function handleFile(f: File) {
    if (!f.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please select an image file (JPG, PNG, WEBP)", variant: "destructive" });
      return;
    }
    if (f.size > MAX_SIZE) {
      toast({ title: "File too large", description: "Maximum image size is 20MB", variant: "destructive" });
      return;
    }
    setFile(f);
    setUploadState("idle");
    setErrorMsg("");
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(f);
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) handleFile(dropped);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;

    setUploadState("uploading");
    setUploadProgress(0);
    setErrorMsg("");

    try {
      const urlData = await requestUrl.mutateAsync({
        data: { name: file.name, size: file.size, contentType: file.type },
      });

      const xhr = new XMLHttpRequest();
      await new Promise<void>((resolve, reject) => {
        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100));
        });
        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`Upload failed: ${xhr.status}`));
        });
        xhr.addEventListener("error", () => reject(new Error("Network error during upload")));
        xhr.open("PUT", urlData.uploadURL);
        xhr.setRequestHeader("Content-Type", file.type);
        xhr.send(file);
      });

      setUploadState("submitting");

      const job = await createJob.mutateAsync({
        data: {
          type: "photo_animate",
          inputObjectPath: urlData.objectPath,
          title: title.trim() || undefined,
          style: style as any,
        },
      });

      qc.invalidateQueries({ queryKey: getListJobsQueryKey() });
      qc.invalidateQueries({ queryKey: getGetJobStatsQueryKey() });
      qc.invalidateQueries({ queryKey: getGetRecentJobsQueryKey() });

      setUploadState("done");
      setTimeout(() => setLocation(`/jobs/${job.id}`), 1000);
    } catch (err: any) {
      setUploadState("error");
      setErrorMsg(err.message ?? "Something went wrong. Please try again.");
    }
  }

  const formatSize = (bytes: number) =>
    bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center">
            <ImageIcon className="w-4 h-4 text-accent" />
          </div>
          <h1 className="text-3xl font-bold text-foreground" data-testid="heading-upload-photo">Photo Animate</h1>
        </div>
        <p className="text-muted-foreground">Upload a photo and bring it to life as an animated anime character</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Drop zone */}
        <div
          className={`relative rounded-2xl border-2 border-dashed transition-all duration-200 cursor-pointer overflow-hidden ${
            dragOver
              ? "border-accent bg-accent/5 shadow-[0_0_30px_rgba(34,211,238,0.15)]"
              : file
              ? "border-green-500/40"
              : "border-border hover:border-accent/40 hover:bg-accent/3"
          }`}
          onDrop={onDrop}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onClick={() => !file && fileInputRef.current?.click()}
          data-testid="dropzone-photo"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            data-testid="input-file-photo"
          />

          {file && preview ? (
            <div className="relative">
              <img src={preview} alt="Preview" className="w-full max-h-72 object-cover" data-testid="img-preview" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-4 flex items-end justify-between">
                <div>
                  <p className="font-medium text-white text-sm truncate" data-testid="text-filename">{file.name}</p>
                  <p className="text-xs text-white/70">{formatSize(file.size)}</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-white/70 hover:text-white hover:bg-white/10"
                  onClick={(e) => { e.stopPropagation(); setFile(null); setPreview(null); setUploadState("idle"); }}
                  data-testid="button-remove-file"
                >
                  <X className="w-4 h-4 mr-1" /> Remove
                </Button>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center">
              <Upload className={`w-10 h-10 mx-auto mb-4 transition-colors ${dragOver ? "text-accent" : "text-muted-foreground"}`} />
              <p className="font-medium text-foreground mb-1">Drop your photo here</p>
              <p className="text-sm text-muted-foreground">or click to browse — JPG, PNG, WEBP up to 20MB</p>
            </div>
          )}
        </div>

        {/* Upload progress */}
        {uploadState === "uploading" && (
          <div className="rounded-xl border border-border bg-card/40 p-4" data-testid="section-upload-progress">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-foreground">Uploading...</p>
              <span className="text-sm text-accent font-mono" data-testid="text-upload-progress">{uploadProgress}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%`, background: "linear-gradient(90deg, hsl(190 90% 60%), hsl(265 89% 65%))" }}
              />
            </div>
          </div>
        )}

        {/* Error */}
        {uploadState === "error" && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 flex items-center gap-3" data-testid="section-error">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <p className="text-sm text-red-400" data-testid="text-error">{errorMsg}</p>
          </div>
        )}

        {/* Title */}
        <div className="space-y-2">
          <Label htmlFor="title" className="text-sm font-medium text-foreground">Title (optional)</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. My anime portrait"
            className="bg-card/50 border-border focus:border-accent/50"
            data-testid="input-title"
          />
        </div>

        {/* Style selector */}
        <div className="space-y-3">
          <Label className="text-sm font-medium text-foreground">Transformation style</Label>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {STYLES.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => setStyle(s.value)}
                className={`text-left p-3.5 rounded-xl border transition-all duration-200 ${
                  style === s.value
                    ? "border-accent/60 bg-accent/10 shadow-[0_0_15px_rgba(34,211,238,0.1)]"
                    : "border-border bg-card/30 hover:border-accent/30 hover:bg-accent/5"
                }`}
                data-testid={`style-option-${s.value}`}
              >
                <p className="font-medium text-foreground text-sm mb-0.5">{s.label}</p>
                <p className="text-xs text-muted-foreground">{s.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Submit */}
        <Button
          type="submit"
          disabled={!file || uploadState === "uploading" || uploadState === "submitting" || uploadState === "done"}
          className="w-full h-12 text-base font-semibold transition-all"
          style={{ background: "linear-gradient(135deg, hsl(265 89% 65%), hsl(190 90% 60%))", boxShadow: "0 0 20px rgba(34,211,238,0.2)" }}
          data-testid="button-submit-photo"
        >
          {uploadState === "uploading" ? (
            <><Loader2 className="mr-2 w-4 h-4 animate-spin" /> Uploading {uploadProgress}%</>
          ) : uploadState === "submitting" ? (
            <><Loader2 className="mr-2 w-4 h-4 animate-spin" /> Starting job...</>
          ) : uploadState === "done" ? (
            <><CheckCircle2 className="mr-2 w-4 h-4" /> Job created — redirecting</>
          ) : (
            <><ImageIcon className="mr-2 w-4 h-4" /> Start animation</>
          )}
        </Button>
      </form>
    </div>
  );
}
