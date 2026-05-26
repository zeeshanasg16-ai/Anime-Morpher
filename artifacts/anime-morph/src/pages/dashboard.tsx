import { Link } from "wouter";
import { useGetJobStats, useGetRecentJobs, useDeleteJob, getGetJobStatsQueryKey, getGetRecentJobsQueryKey, getListJobsQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";
import { Video, ImageIcon, Plus, CheckCircle2, Clock, Loader2, XCircle, Trash2, ArrowRight, BarChart3 } from "lucide-react";

function statusConfig(status: string) {
  switch (status) {
    case "completed": return { label: "Completed", color: "bg-green-500/10 text-green-400 border-green-500/20", icon: CheckCircle2 };
    case "processing": return { label: "Processing", color: "bg-blue-500/10 text-blue-400 border-blue-500/20", icon: Loader2 };
    case "queued": return { label: "Queued", color: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20", icon: Clock };
    case "failed": return { label: "Failed", color: "bg-red-500/10 text-red-400 border-red-500/20", icon: XCircle };
    default: return { label: status, color: "bg-muted text-muted-foreground border-border", icon: Clock };
  }
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function Dashboard() {
  const qc = useQueryClient();
  const { data: stats, isLoading: statsLoading } = useGetJobStats();
  const { data: recent, isLoading: recentLoading } = useGetRecentJobs();
  const deleteJob = useDeleteJob();

  function handleDelete(id: number) {
    deleteJob.mutate({ id }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetRecentJobsQueryKey() });
        qc.invalidateQueries({ queryKey: getGetJobStatsQueryKey() });
        qc.invalidateQueries({ queryKey: getListJobsQueryKey() });
      },
    });
  }

  const statTiles = [
    { label: "Total Jobs", value: stats?.total ?? 0, color: "text-foreground" },
    { label: "Completed", value: stats?.completed ?? 0, color: "text-green-400" },
    { label: "Processing", value: stats?.processing ?? 0, color: "text-blue-400" },
    { label: "Queued", value: stats?.queued ?? 0, color: "text-yellow-400" },
    { label: "Failed", value: stats?.failed ?? 0, color: "text-red-400" },
    { label: "Video Jobs", value: stats?.videoMorphCount ?? 0, color: "text-primary" },
    { label: "Photo Jobs", value: stats?.photoAnimateCount ?? 0, color: "text-accent" },
  ];

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-1" data-testid="heading-dashboard">Your Studio</h1>
          <p className="text-muted-foreground">Manage your render jobs and track progress</p>
        </div>
        <div className="flex gap-3">
          <Link href="/upload/video">
            <Button className="bg-primary hover:bg-primary/90 shadow-[0_0_15px_rgba(147,51,234,0.25)] transition-all hover:shadow-[0_0_25px_rgba(147,51,234,0.4)]" data-testid="button-new-video">
              <Video className="mr-2 w-4 h-4" /> Video Morph
            </Button>
          </Link>
          <Link href="/upload/photo">
            <Button variant="outline" className="border-border hover:border-primary/30 hover:bg-primary/5" data-testid="button-new-photo">
              <ImageIcon className="mr-2 w-4 h-4" /> Photo Animate
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-10">
        {statTiles.map((tile) => (
          <div key={tile.label} className="rounded-xl border border-border bg-card/50 p-4 hover:bg-card transition-colors" data-testid={`stat-${tile.label.toLowerCase().replace(/\s+/g, "-")}`}>
            {statsLoading ? (
              <Skeleton className="h-8 w-12 mb-1" />
            ) : (
              <p className={`text-3xl font-bold ${tile.color} mb-1`}>{tile.value}</p>
            )}
            <p className="text-xs text-muted-foreground font-medium">{tile.label}</p>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="grid md:grid-cols-2 gap-4 mb-10">
        <Link href="/upload/video">
          <div className="group rounded-2xl border border-border bg-card/30 hover:bg-card/60 hover:border-primary/30 p-6 transition-all duration-300 cursor-pointer hover:shadow-[0_0_20px_rgba(147,51,234,0.08)]" data-testid="card-upload-video">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <Video className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-0.5">Video Morph</h3>
                  <p className="text-sm text-muted-foreground">Transform videos up to 10 minutes</p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
          </div>
        </Link>
        <Link href="/upload/photo">
          <div className="group rounded-2xl border border-border bg-card/30 hover:bg-card/60 hover:border-accent/30 p-6 transition-all duration-300 cursor-pointer hover:shadow-[0_0_20px_rgba(34,211,238,0.08)]" data-testid="card-upload-photo">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center group-hover:bg-accent/20 transition-colors">
                  <ImageIcon className="w-6 h-6 text-accent" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-0.5">Photo Animate</h3>
                  <p className="text-sm text-muted-foreground">Bring a photo to animated life</p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-accent transition-colors" />
            </div>
          </div>
        </Link>
      </div>

      {/* Recent jobs */}
      <div>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-semibold text-foreground" data-testid="heading-recent-jobs">Recent jobs</h2>
          </div>
          <Link href="/history">
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground" data-testid="link-view-all">
              View all <ArrowRight className="ml-1 w-3 h-3" />
            </Button>
          </Link>
        </div>

        {recentLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
        ) : !recent || recent.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/50 p-12 text-center" data-testid="empty-recent-jobs">
            <Plus className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">No jobs yet. Start your first transformation above.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {recent.map((job) => {
              const cfg = statusConfig(job.status);
              const Icon = cfg.icon;
              return (
                <div
                  key={job.id}
                  className="group flex items-center gap-4 rounded-xl border border-border bg-card/30 hover:bg-card/60 hover:border-border/80 px-5 py-4 transition-all duration-200"
                  data-testid={`job-card-${job.id}`}
                >
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${job.type === "video_morph" ? "bg-primary/10" : "bg-accent/10"}`}>
                    {job.type === "video_morph" ? (
                      <Video className="w-4 h-4 text-primary" />
                    ) : (
                      <ImageIcon className="w-4 h-4 text-accent" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-foreground text-sm truncate" data-testid={`job-title-${job.id}`}>
                        {job.title ?? (job.type === "video_morph" ? "Video Morph" : "Photo Animation")}
                      </p>
                      {job.style && (
                        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full capitalize">{job.style}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">{formatDate(job.createdAt)}</span>
                      {job.status === "processing" && (
                        <div className="flex items-center gap-1.5">
                          <div className="w-20 h-1 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-400 rounded-full transition-all duration-500"
                              style={{ width: `${job.progress}%` }}
                            />
                          </div>
                          <span className="text-xs text-blue-400">{job.progress}%</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <Badge className={`${cfg.color} border text-xs gap-1.5 flex items-center flex-shrink-0`} data-testid={`job-status-${job.id}`}>
                    <Icon className={`w-3 h-3 ${job.status === "processing" ? "animate-spin" : ""}`} />
                    {cfg.label}
                  </Badge>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Link href={`/jobs/${job.id}`}>
                      <Button variant="ghost" size="sm" className="h-8 px-2 text-muted-foreground hover:text-foreground" data-testid={`button-view-job-${job.id}`}>
                        View
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(job.id)}
                      disabled={deleteJob.isPending}
                      data-testid={`button-delete-job-${job.id}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
