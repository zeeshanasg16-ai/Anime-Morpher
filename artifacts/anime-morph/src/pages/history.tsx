import { useState } from "react";
import { Link } from "wouter";
import { useListJobs, useDeleteJob, getListJobsQueryKey, getGetJobStatsQueryKey, getGetRecentJobsQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQueryClient } from "@tanstack/react-query";
import { Video, ImageIcon, CheckCircle2, Clock, Loader2, XCircle, Trash2, Eye, ChevronLeft, ChevronRight, Filter } from "lucide-react";

type StatusFilter = "" | "queued" | "processing" | "completed" | "failed";
type TypeFilter = "" | "video_morph" | "photo_animate";

function statusConfig(status: string) {
  switch (status) {
    case "completed": return { label: "Completed", color: "bg-green-500/10 text-green-400 border-green-500/20", icon: CheckCircle2 };
    case "processing": return { label: "Processing", color: "bg-blue-500/10 text-blue-400 border-blue-500/20", icon: Loader2 };
    case "queued": return { label: "Queued", color: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20", icon: Clock };
    case "failed": return { label: "Failed", color: "bg-red-500/10 text-red-400 border-red-500/20", icon: XCircle };
    default: return { label: status, color: "bg-muted text-muted-foreground border-border", icon: Clock };
  }
}

const PAGE_SIZE = 10;

export default function History() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("");
  const [page, setPage] = useState(0);
  const qc = useQueryClient();

  const params = {
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(typeFilter ? { type: typeFilter } : {}),
  };

  const { data, isLoading } = useListJobs(params, {
    query: { queryKey: getListJobsQueryKey(params) },
  });

  const deleteJob = useDeleteJob();

  function handleDelete(id: number) {
    deleteJob.mutate({ id }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListJobsQueryKey() });
        qc.invalidateQueries({ queryKey: getGetJobStatsQueryKey() });
        qc.invalidateQueries({ queryKey: getGetRecentJobsQueryKey() });
      },
    });
  }

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-1" data-testid="heading-history">Render History</h1>
          <p className="text-muted-foreground">All your transformation jobs</p>
        </div>
        <div className="flex gap-3">
          <Link href="/upload/video">
            <Button className="bg-primary hover:bg-primary/90 shadow-[0_0_15px_rgba(147,51,234,0.25)]" data-testid="button-new-job">
              New job
            </Button>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6" data-testid="section-filters">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <Select value={statusFilter || "all"} onValueChange={(v) => { setStatusFilter(v === "all" ? "" : v as StatusFilter); setPage(0); }}>
          <SelectTrigger className="w-40 bg-card/50 border-border" data-testid="select-status-filter">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="queued">Queued</SelectItem>
            <SelectItem value="processing">Processing</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>

        <Select value={typeFilter || "all"} onValueChange={(v) => { setTypeFilter(v === "all" ? "" : v as TypeFilter); setPage(0); }}>
          <SelectTrigger className="w-44 bg-card/50 border-border" data-testid="select-type-filter">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="video_morph">Video Morph</SelectItem>
            <SelectItem value="photo_animate">Photo Animate</SelectItem>
          </SelectContent>
        </Select>

        {data && (
          <span className="text-sm text-muted-foreground ml-auto">{data.total} job{data.total !== 1 ? "s" : ""}</span>
        )}
      </div>

      {/* Job list */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : !data || data.jobs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/50 p-16 text-center" data-testid="empty-history">
          <Clock className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">
            {statusFilter || typeFilter ? "No jobs match your filters." : "No jobs yet. Start your first transformation."}
          </p>
          {!(statusFilter || typeFilter) && (
            <Link href="/upload/video">
              <Button variant="outline" className="mt-4" data-testid="button-start-first">Start now</Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {data.jobs.map((job) => {
            const cfg = statusConfig(job.status);
            const Icon = cfg.icon;
            return (
              <div
                key={job.id}
                className="group flex items-center gap-4 rounded-xl border border-border bg-card/30 hover:bg-card/60 hover:border-border/80 px-5 py-4 transition-all duration-200"
                data-testid={`job-row-${job.id}`}
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
                      <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full capitalize flex-shrink-0">{job.style}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>#{job.id}</span>
                    <span>{new Date(job.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                    {job.status === "processing" && (
                      <div className="flex items-center gap-1.5">
                        <div className="w-16 h-1 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-blue-400 rounded-full transition-all" style={{ width: `${job.progress}%` }} />
                        </div>
                        <span className="text-blue-400">{job.progress}%</span>
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
                    <Button variant="ghost" size="sm" className="h-8 px-2 text-muted-foreground hover:text-foreground" data-testid={`button-view-${job.id}`}>
                      <Eye className="w-3.5 h-3.5" />
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(job.id)}
                    disabled={deleteJob.isPending}
                    data-testid={`button-delete-${job.id}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-8" data-testid="section-pagination">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            data-testid="button-prev-page"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page + 1} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            data-testid="button-next-page"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
