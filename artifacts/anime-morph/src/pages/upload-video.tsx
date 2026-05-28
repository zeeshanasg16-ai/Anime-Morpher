import { useState, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { useCreateJob, useRequestUploadUrl, getListJobsQueryKey, getGetJobStatsQueryKey, getGetRecentJobsQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Upload, Video, X, CheckCircle2, Loader2, AlertCircle } from "lucide-react";

const STYLES = [
  { value: "anime", label: "Anime", desc: "Classic Japanese animation style" },
  { value: "ghibli", label: "Ghibli", desc: "Soft, painterly Studio Ghibli aesthetic" },
  { value: "cyberpunk", label: "Cyberpunk", desc: "Neon-lit dystopian future" },
  { value: "cartoon", label: "Cartoon", desc: "Bold outlines, vivid colors" },
  { value: "watercolor", label: "Watercolor", desc: "Delicate painterly washes" },
];

const MAX_SIZE = 600 * 1024 * 1024; // 600MB
const ACCEPT = "video/mp4,video/quicktime,video/x-msvideo,.mp4,.mov,.avi";

type UploadState = "idle" | "uploading" | "submitting" | "done" | "error";

export default function UploadVideo() {
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [file, setFile] = useState<File | null>(null);
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
    if (!f.type.startsWith("video/")) {
      toast({ title: "Invalid file", description: "Please select a video file (MP4, MOV, AVI)", variant: "destructive" });
      return;
    }
    if (f.size > MAX_SIZE) {
      toast({ title: "File too large", description: "Maximum video size is 600MB", variant: "destructive" });
      return;
    }
    setFile(f);
    setUploadState("idle");
    setErrorMsg("");
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

      if (
        !urlData ||
        typeof urlData !== "object" ||
        typeof (urlData as any).uploadURL !== "string" ||
        !/^https?:\/\//i.test((urlData as any).uploadURL)
      ) {
        throw new Error(
          "Upload endpoint did not return a valid URL. The API server is unreachable or misconfigured (VITE_API_BASE_URL may be wrong).",
        );
      }

      // Upload directly to presigned URL
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
          type: "video_morph",
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
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <Video className="w-4 h-4 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-foreground" data-testid="heading-upload-video">Video Morph</h1>
        </div>
        <p className="text-muted-foreground">Upload a video and transform every frame into stunning anime art</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Drop zone */}
        <div
          className={`relative rounded-2xl border-2 border-dashed transition-all duration-200 cursor-pointer ${
            dragOver
              ? "border-primary bg-primary/5 shadow-[0_0_30px_rgba(147,51,234,0.15)]"
              : file
              ? "border-green-500/40 bg-green-500/5"
              : "border-border hover:border-primary/40 hover:bg-primary/3"
          }`}
          onDrop={onDrop}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onClick={() => !file && fileInputRef.current?.click()}
          data-testid="dropzone-video"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            data-testid="input-file-video"
          />

          {file ? (
            <div className="p-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-6 h-6 text-green-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground truncate" data-testid="text-filename">{file.name}</p>
                <p className="text-sm text-muted-foreground">{formatSize(file.size)}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-destructive flex-shrink-0"
                onClick={(e) => { e.stopPropagation(); setFile(null); setUploadState("idle"); }}
                data-testid="button-remove-file"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <div className="p-12 text-center">
              <Upload className={`w-10 h-10 mx-auto mb-4 transition-colors ${dragOver ? "text-primary" : "text-muted-foreground"}`} />
              <p className="font-medium text-foreground mb-1">Drop your video here</p>
              <p className="text-sm text-muted-foreground">or click to browse — MP4, MOV, AVI up to 600MB</p>
            </div>
          )}
        </div>

        {/* Upload progress */}
        {uploadState === "uploading" && (
          <div className="rounded-xl border border-border bg-card/40 p-4" data-testid="section-upload-progress">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-foreground">Uploading...</p>
              <span className="text-sm text-primary font-mono" data-testid="text-upload-progress">{uploadProgress}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%`, background: "linear-gradient(90deg, hsl(265 89% 65%), hsl(190 90% 60%))" }}
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
            placeholder="e.g. My vacation video"
            className="bg-card/50 border-border focus:border-primary/50"
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
                    ? "border-primary/60 bg-primary/10 shadow-[0_0_15px_rgba(147,51,234,0.1)]"
                    : "border-border bg-card/30 hover:border-primary/30 hover:bg-primary/5"
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
          className="w-full h-12 bg-primary hover:bg-primary/90 shadow-[0_0_20px_rgba(147,51,234,0.3)] hover:shadow-[0_0_30px_rgba(147,51,234,0.5)] transition-all text-base font-semibold"
          data-testid="button-submit-video"
        >
          {uploadState === "uploading" ? (
            <><Loader2 className="mr-2 w-4 h-4 animate-spin" /> Uploading {uploadProgress}%</>
          ) : uploadState === "submitting" ? (
            <><Loader2 className="mr-2 w-4 h-4 animate-spin" /> Starting job...</>
          ) : uploadState === "done" ? (
            <><CheckCircle2 className="mr-2 w-4 h-4" /> Job created — redirecting</>
          ) : (
            <><Video className="mr-2 w-4 h-4" /> Start transformation</>
          )}
        </Button>
      </form>
    </div>
  );
}
