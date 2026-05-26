import { useRoute, Link } from "wouter";
import { useGetJob, useDeleteJob, useRetryJob, getGetJobQueryKey, getGetRecentJobsQueryKey, getListJobsQueryKey, getGetJobStatsQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Download, RefreshCw, Trash2, CheckCircle2, Clock, Loader2, XCircle, Video, ImageIcon, AlertCircle } from "lucide-react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function statusConfig(status: string) {
  switch (status) {
    case "completed": return { label: "Completed", color: "bg-green-500/10 text-green-400 border-green-500/20", icon: CheckCircle2 };
    case "processing": return { label: "Processing", color: "bg-blue-500/10 text-blue-400 border-blue-500/20", icon: Loader2 };
    case "queued": return { label: "Queued", color: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20", icon: Clock };
    case "failed": return { label: "Failed", color: "bg-red-500/10 text-red-400 border-red-500/20", icon: XCircle };
    default: return { label: status, color: "bg-muted text-muted-foreground border-border", icon: Clock };
  }
}

export default function JobDetail() {
  const [, params] = useRoute("/jobs/:id");
  const jobId = params ? parseInt(params.id, 10) : 0;
  const qc = useQueryClient();
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: job, isLoading, refetch } = useGetJob(jobId, {
    query: { enabled: !!jobId, queryKey: getGetJobQueryKey(jobId) },
  });

  const deleteJob = useDeleteJob();
  const retryJob = useRetryJob();

  useEffect(() => {
    if (job && (job.status === "queued" || job.status === "processing")) {
      pollingRef.current = setInterval(() => {
        refetch();
      }, 3000);
    } else {
      if (pollingRef.current) clearInterval(pollingRef.current);
    }
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [job?.status, refetch]);

  function handleDelete() {
    if (!job) return;
    deleteJob.mutate({ id: job.id }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetRecentJobsQueryKey() });
        qc.invalidateQueries({ queryKey: getGetJobStatsQueryKey() });
        qc.invalidateQueries({ queryKey: getListJobsQueryKey() });
        window.history.back();
      },
    });
  }

  function handleRetry() {
    if (!job) return;
    retryJob.mutate({ id: job.id }, {
      onSuccess: (updated) => {
        qc.invalidateQueries({ queryKey: getGetJobQueryKey(job.id) });
        qc.invalidateQueries({ queryKey: getGetRecentJobsQueryKey() });
        qc.invalidateQueries({ queryKey: getGetJobStatsQueryKey() });
      },
    });
  }

  if (isLoading) {
    return (
      <div className="p-8">
        <Skeleton className="h-8 w-32 mb-8" />
        <Skeleton className="h-64 w-full rounded-2xl mb-6" />
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[50vh]">
        <AlertCircle className="w-12 h-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground mb-4">Job not found</p>
        <Link href="/history">
          <Button variant="outline">Back to history</Button>
        </Link>
      </div>
    );
  }

  const cfg = statusConfig(job.status);
  const StatusIcon = cfg.icon;

  return (
    <div className="p-8 max-w-4xl">
      {/* Back */}
      <Link href="/history">
        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground mb-6 -ml-2" data-testid="button-back">
          <ArrowLeft className="mr-1.5 w-4 h-4" /> Back to history
        </Button>
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${job.type === "video_morph" ? "bg-primary/10" : "bg-accent/10"}`}>
              {job.type === "video_morph" ? (
                <Video className="w-4 h-4 text-primary" />
              ) : (
                <ImageIcon className="w-4 h-4 text-accent" />
              )}
            </div>
            <h1 className="text-2xl font-bold text-foreground" data-testid="heading-job-title">
              {job.title ?? (job.type === "video_morph" ? "Video Morph" : "Photo Animation")}
            </h1>
            <Badge className={`${cfg.color} border flex items-center gap-1.5`} data-testid="badge-job-status">
              <StatusIcon className={`w-3 h-3 ${job.status === "processing" ? "animate-spin" : ""}`} />
              {cfg.label}
            </Badge>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            {job.style && <span className="capitalize bg-muted px-2 py-0.5 rounded-full">{job.style}</span>}
            <span>Created {new Date(job.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {job.status === "completed" && job.outputObjectPath && (
            <a href={`${basePath}/api/storage/objects${job.outputObjectPath}`} download>
              <Button className="bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/20" data-testid="button-download">
                <Download className="mr-2 w-4 h-4" /> Download
              </Button>
            </a>
          )}
          {job.status === "failed" && (
            <Button
              variant="outline"
              onClick={handleRetry}
              disabled={retryJob.isPending}
              className="border-border hover:border-primary/30"
              data-testid="button-retry"
            >
              <RefreshCw className={`mr-2 w-4 h-4 ${retryJob.isPending ? "animate-spin" : ""}`} />
              Retry
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-destructive"
            onClick={handleDelete}
            disabled={deleteJob.isPending}
            data-testid="button-delete"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Progress section */}
      {(job.status === "queued" || job.status === "processing") && (
        <div className="rounded-2xl border border-border bg-card/40 p-6 mb-6" data-testid="section-progress">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="font-medium text-foreground mb-0.5">
                {job.status === "queued" ? "Waiting in queue..." : "Transforming your media..."}
              </p>
              <p className="text-sm text-muted-foreground">
                {job.status === "queued"
                  ? "Your job is in the queue and will start processing soon"
                  : "AI is analyzing frames and applying your chosen style"}
              </p>
            </div>
            <div className="text-3xl font-bold text-primary" data-testid="text-progress">
              {job.progress}%
            </div>
          </div>

          <div className="h-3 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500 relative overflow-hidden"
              style={{
                width: `${job.progress}%`,
                background: "linear-gradient(90deg, hsl(265 89% 65%), hsl(190 90% 60%))",
              }}
            >
              <div className="absolute inset-0 bg-white/20 animate-pulse" />
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>Polling for updates every 3 seconds</span>
          </div>
        </div>
      )}

      {/* Output */}
      {job.status === "completed" && (
        <div className="rounded-2xl border border-green-500/20 bg-green-500/5 p-6 mb-6" data-testid="section-output">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle2 className="w-5 h-5 text-green-400" />
            <h2 className="font-semibold text-green-400">Transformation complete</h2>
          </div>
          {job.outputObjectPath ? (
            <div className="rounded-xl overflow-hidden bg-black/50 flex items-center justify-center min-h-[200px]">
              {job.type === "video_morph" ? (
                <video
                  controls
                  className="max-h-96 w-full"
                  src={`${basePath}/api/storage/objects${job.outputObjectPath}`}
                  data-testid="video-output"
                />
              ) : (
                <img
                  src={`${basePath}/api/storage/objects${job.outputObjectPath}`}
                  alt="Transformed output"
                  className="max-h-96 object-contain"
                  data-testid="img-output"
                />
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Output file ready. Click download to save.</p>
          )}
        </div>
      )}

      {/* Error */}
      {job.status === "failed" && job.errorMessage && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6 mb-6" data-testid="section-error">
          <div className="flex items-center gap-2 mb-2">
            <XCircle className="w-5 h-5 text-red-400" />
            <h2 className="font-semibold text-red-400">Job failed</h2>
          </div>
          <p className="text-sm text-muted-foreground" data-testid="text-error-message">{job.errorMessage}</p>
        </div>
      )}

      {/* Job metadata */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="section-metadata">
        <div className="rounded-xl border border-border bg-card/30 p-4">
          <p className="text-xs text-muted-foreground mb-1">Job ID</p>
          <p className="font-mono font-medium text-foreground">#{job.id}</p>
        </div>
        <div className="rounded-xl border border-border bg-card/30 p-4">
          <p className="text-xs text-muted-foreground mb-1">Type</p>
          <p className="font-medium text-foreground capitalize">{job.type === "video_morph" ? "Video Morph" : "Photo Animate"}</p>
        </div>
        <div className="rounded-xl border border-border bg-card/30 p-4">
          <p className="text-xs text-muted-foreground mb-1">Style</p>
          <p className="font-medium text-foreground capitalize">{job.style ?? "—"}</p>
        </div>
        <div className="rounded-xl border border-border bg-card/30 p-4">
          <p className="text-xs text-muted-foreground mb-1">Progress</p>
          <p className="font-medium text-foreground">{job.progress}%</p>
        </div>
      </div>
    </div>
  );
}
