"use client"

import { useEffect, useState } from "react"
import { Document, Page, pdfjs } from "react-pdf"
import {
  Download,
  FileText,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"

import "react-pdf/dist/Page/AnnotationLayer.css"
import "react-pdf/dist/Page/TextLayer.css"

import { getFileSignedUrl, type SignedFile } from "@/lib/distributor/actions"
import { FILE_TYPE_LABELS, type FileType } from "@/lib/catalog/types"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"

// Serve the worker as a static asset from /public (no external CDN) so
// previews work under any network policy. The file is copied from
// pdfjs-dist by the `copy-pdf-worker` postinstall script and must match the
// installed pdfjs version.
pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs"

function formatSize(bytes: number | null): string {
  if (bytes == null) return "—"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

interface Props {
  fileId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function FileViewer({ fileId, open, onOpenChange }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [file, setFile] = useState<SignedFile | null>(null)

  // PDF paging state
  const [numPages, setNumPages] = useState(0)
  const [pageNumber, setPageNumber] = useState(1)

  useEffect(() => {
    if (!open || !fileId) return
    let cancelled = false

    setLoading(true)
    setError(null)
    setFile(null)
    setNumPages(0)
    setPageNumber(1)

    getFileSignedUrl(fileId).then((result) => {
      if (cancelled) return
      if ("error" in result) {
        setError(result.error)
      } else {
        setFile(result.data)
      }
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [open, fileId])

  const pdf = file ? /\.pdf$/i.test(file.filename) : false

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="truncate pr-8">
            {file?.filename ?? "File"}
          </DialogTitle>
        </DialogHeader>

        {/* Metadata row */}
        {file && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Badge variant="secondary">
                {file.file_type
                  ? FILE_TYPE_LABELS[file.file_type as FileType] ??
                    file.file_type
                  : "—"}
              </Badge>
            </span>
            <span>{formatSize(file.file_size)}</span>
            <span>
              Updated{" "}
              {new Date(file.updated_at).toLocaleDateString(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </span>
          </div>
        )}

        {/* Body */}
        <div className="min-h-[55vh] max-h-[65vh] overflow-auto rounded-md border bg-muted/30 flex items-start justify-center p-4">
          {loading && (
            <div className="flex flex-col items-center gap-2 py-20 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              <p className="text-sm">Loading preview…</p>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center gap-2 py-20 text-center text-muted-foreground">
              <FileText className="h-8 w-8" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          {!loading && !error && file && pdf && (
            <Document
              file={file.url}
              onLoadSuccess={({ numPages }) => setNumPages(numPages)}
              onLoadError={(e) => setError(e.message)}
              loading={
                <div className="flex flex-col items-center gap-2 py-20 text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <p className="text-sm">Rendering PDF…</p>
                </div>
              }
              error={
                <div className="flex flex-col items-center gap-2 py-20 text-center text-muted-foreground">
                  <FileText className="h-8 w-8" />
                  <p className="text-sm">Could not render this PDF.</p>
                </div>
              }
            >
              <Page
                pageNumber={pageNumber}
                width={760}
                renderTextLayer
                renderAnnotationLayer
              />
            </Document>
          )}

          {!loading && !error && file && !pdf && (
            <div className="flex flex-col items-center gap-3 py-20 text-center text-muted-foreground">
              <FileText className="h-10 w-10" />
              <p className="text-sm">
                In-browser preview isn’t available for this file type.
              </p>
              <p className="text-xs">Use the download button to open it.</p>
            </div>
          )}
        </div>

        {/* Footer: paging + download */}
        <div className="flex items-center justify-between">
          {pdf && numPages > 1 ? (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
                disabled={pageNumber <= 1}
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground tabular-nums">
                {pageNumber} / {numPages}
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() =>
                  setPageNumber((p) => Math.min(numPages, p + 1))
                }
                disabled={pageNumber >= numPages}
                aria-label="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <span />
          )}

          {file && (
            <Button asChild>
              <a href={file.url} download={file.filename}>
                <Download className="h-4 w-4" />
                Download
              </a>
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
