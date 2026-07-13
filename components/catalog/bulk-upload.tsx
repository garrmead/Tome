"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2, Loader2, Upload, X, XCircle } from "lucide-react"
import { toast } from "sonner"

import { createClient } from "@/lib/supabase/client"
import { registerLineFile } from "@/lib/catalog/bulk-actions"
import {
  FILE_TYPES,
  FILE_TYPE_LABELS,
  PRODUCT_FILES_BUCKET,
  type FileType,
  type ProductLine,
} from "@/lib/catalog/types"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type ItemStatus = "pending" | "uploading" | "done" | "failed"

interface UploadItem {
  id: string
  file: File
  fileType: FileType
  lineId: string
  status: ItemStatus
  error?: string
}

/** Infer a file type from filename keywords (case-insensitive). */
function inferFileType(filename: string): FileType {
  const n = filename.toLowerCase()
  if (n.includes("datasheet") || n.includes("data_sheet")) return "datasheet"
  if (n.includes("iom")) return "iom"
  if (n.includes("manual") || n.includes("install")) return "manual"
  if (n.includes("price")) return "pricebook"
  if (n.includes("brochure") || n.includes("quick") || n.includes("guide")) return "brochure"
  if (n.endsWith(".dwg") || n.includes("drawing") || n.includes("dim")) return "cad"
  return "other"
}

/**
 * Infer the target product line: pick the first line whose name's first word
 * appears in the filename; fall back to the first line.
 */
function inferLineId(filename: string, lines: ProductLine[]): string {
  const n = filename.toLowerCase()
  for (const line of lines) {
    const firstWord = line.name.trim().split(/\s+/)[0]?.toLowerCase()
    if (firstWord && n.includes(firstWord)) return line.id
  }
  return lines[0]?.id ?? ""
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function BulkUploadDialog({
  orgId,
  lines,
}: {
  orgId: string
  lines: ProductLine[]
}) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [items, setItems] = useState<UploadItem[]>([])
  const [uploading, setUploading] = useState(false)

  function addFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    const next: UploadItem[] = Array.from(fileList).map((file) => ({
      id: crypto.randomUUID(),
      file,
      fileType: inferFileType(file.name),
      lineId: inferLineId(file.name, lines),
      status: "pending",
    }))
    setItems((prev) => [...prev, ...next])
  }

  function updateItem(id: string, patch: Partial<UploadItem>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)))
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((it) => it.id !== id))
  }

  function handleOpenChange(next: boolean) {
    if (uploading) return
    setOpen(next)
    if (!next) setItems([])
  }

  async function uploadAll() {
    const supabase = createClient()
    setUploading(true)

    const pending = items.filter((it) => it.status === "pending" || it.status === "failed")
    let done = 0
    let failed = 0

    for (const item of pending) {
      updateItem(item.id, { status: "uploading", error: undefined })

      const path = `${orgId}/lines/${item.lineId}/${item.file.name}`
      const { error: storageError } = await supabase.storage
        .from(PRODUCT_FILES_BUCKET)
        .upload(path, item.file, { upsert: true })

      if (storageError) {
        updateItem(item.id, { status: "failed", error: storageError.message })
        failed++
        continue
      }

      const result = await registerLineFile({
        product_line_id: item.lineId,
        filename: item.file.name,
        storage_path: path,
        file_type: item.fileType,
        file_size: item.file.size,
      })

      if ("error" in result) {
        updateItem(item.id, { status: "failed", error: result.error })
        failed++
        continue
      }

      updateItem(item.id, { status: "done" })
      done++
    }

    setUploading(false)
    router.refresh()

    if (failed === 0) {
      toast.success(`${done} file${done === 1 ? "" : "s"} uploaded.`)
      setOpen(false)
      setItems([])
    } else {
      toast.error(
        `${done} uploaded, ${failed} failed. Failed rows can be retried.`
      )
    }
  }

  const pendingCount = items.filter(
    (it) => it.status === "pending" || it.status === "failed"
  ).length

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="mr-2 h-4 w-4" />
          Bulk Upload Files
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Bulk Upload Files</DialogTitle>
          <DialogDescription>
            Upload datasheets, manuals, and drawings across your product lines.
            File type and product line are inferred from the filename — review
            and adjust before uploading.
          </DialogDescription>
        </DialogHeader>

        {lines.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Create a product line first — bulk uploads attach files to a
            product line.
          </p>
        ) : (
          <div className="space-y-4">
            <div
              role="button"
              tabIndex={0}
              onClick={() => inputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  inputRef.current?.click()
                }
              }}
              onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragging(false)
                addFiles(e.dataTransfer.files)
              }}
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-8 text-center transition-colors",
                dragging ? "border-primary bg-accent" : "hover:bg-accent/50"
              )}
            >
              <Upload className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium">
                Drag files here or click to browse
              </p>
              <p className="text-xs text-muted-foreground">
                PDF and DWG files. You can add multiple at once.
              </p>
              <input
                ref={inputRef}
                type="file"
                multiple
                accept=".pdf,.dwg"
                className="hidden"
                onChange={(e) => { addFiles(e.target.files); e.target.value = "" }}
              />
            </div>

            {items.length > 0 && (
              <div className="max-h-80 overflow-y-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Filename</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Product Line</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead className="w-12" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="max-w-52">
                          <p className="truncate text-sm font-medium">
                            {item.file.name}
                          </p>
                          {item.status === "failed" && item.error && (
                            <p className="truncate text-xs text-destructive">
                              {item.error}
                            </p>
                          )}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={item.fileType}
                            onValueChange={(v) =>
                              updateItem(item.id, { fileType: v as FileType })
                            }
                            disabled={uploading || item.status === "done"}
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {FILE_TYPES.map((ft) => (
                                <SelectItem key={ft} value={ft}>
                                  {FILE_TYPE_LABELS[ft]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={item.lineId}
                            onValueChange={(v) => updateItem(item.id, { lineId: v })}
                            disabled={uploading || item.status === "done"}
                          >
                            <SelectTrigger className="w-40">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {lines.map((line) => (
                                <SelectItem key={line.id} value={line.id}>
                                  {line.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {formatSize(item.file.size)}
                        </TableCell>
                        <TableCell>
                          {item.status === "uploading" ? (
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          ) : item.status === "done" ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          ) : item.status === "failed" ? (
                            <XCircle className="h-4 w-4 text-destructive" />
                          ) : (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeItem(item.id)}
                              aria-label={`Remove ${item.file.name}`}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <DialogFooter>
              <Button
                onClick={uploadAll}
                disabled={uploading || pendingCount === 0}
              >
                {uploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading…
                  </>
                ) : (
                  `Upload ${pendingCount} file${pendingCount === 1 ? "" : "s"}`
                )}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
