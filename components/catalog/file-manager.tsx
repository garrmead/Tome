"use client"

import { useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { FileText, Loader2, Trash2, Upload, X } from "lucide-react"

import { createClient } from "@/lib/supabase/client"
import { deleteFile, registerUploadedFile } from "@/lib/catalog/actions"
import {
  FILE_TYPES,
  FILE_TYPE_LABELS,
  PRODUCT_FILES_BUCKET,
  type FileType,
  type Product,
  type ProductFile,
} from "@/lib/catalog/types"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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

type QueueStatus = "queued" | "uploading" | "done" | "error"

interface QueueItem {
  id: string
  file: File
  fileType: FileType
  status: QueueStatus
  error?: string
}

function formatSize(bytes: number | null): string {
  if (bytes == null) return "—"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function FileManager({
  product,
  orgId,
  files,
}: {
  product: Product
  orgId: string
  files: ProductFile[]
}) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [uploading, setUploading] = useState(false)
  const [, startTransition] = useTransition()

  function addFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    const items: QueueItem[] = Array.from(fileList).map((file) => ({
      id: crypto.randomUUID(),
      file,
      fileType: "datasheet",
      status: "queued",
    }))
    setQueue((q) => [...q, ...items])
  }

  function setItemType(id: string, fileType: FileType) {
    setQueue((q) =>
      q.map((item) => (item.id === id ? { ...item, fileType } : item))
    )
  }

  function removeItem(id: string) {
    setQueue((q) => q.filter((item) => item.id !== id))
  }

  async function processQueue() {
    const supabase = createClient()
    setUploading(true)

    // Snapshot the items that need uploading at the start of the run.
    const pending = queue.filter((item) => item.status === "queued")

    for (const item of pending) {
      setQueue((q) =>
        q.map((it) =>
          it.id === item.id ? { ...it, status: "uploading", error: undefined } : it
        )
      )

      const path = `${orgId}/${product.id}/${item.file.name}`

      const { error: storageError } = await supabase.storage
        .from(PRODUCT_FILES_BUCKET)
        .upload(path, item.file, { upsert: true })

      if (storageError) {
        setQueue((q) =>
          q.map((it) =>
            it.id === item.id
              ? { ...it, status: "error", error: storageError.message }
              : it
          )
        )
        continue
      }

      const result = await registerUploadedFile({
        product_id: product.id,
        product_line_id: product.product_line_id,
        filename: item.file.name,
        storage_path: path,
        file_type: item.fileType,
        file_size: item.file.size,
      })

      if ("error" in result) {
        setQueue((q) =>
          q.map((it) =>
            it.id === item.id
              ? { ...it, status: "error", error: result.error }
              : it
          )
        )
        continue
      }

      setQueue((q) =>
        q.map((it) => (it.id === item.id ? { ...it, status: "done" } : it))
      )
    }

    setUploading(false)
    setQueue((q) => q.filter((item) => item.status !== "done"))
    router.refresh()
  }

  function handleDelete(file: ProductFile) {
    startTransition(async () => {
      await deleteFile(file.id, file.storage_path, product.id)
      router.refresh()
    })
  }

  const queuedCount = queue.filter((item) => item.status === "queued").length

  return (
    <Card>
      <CardHeader>
        <CardTitle>Files</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
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
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
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
            Drag PDFs here or click to browse
          </p>
          <p className="text-xs text-muted-foreground">
            You can upload multiple files at once.
          </p>
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              addFiles(e.target.files)
              e.target.value = ""
            }}
          />
        </div>

        {queue.length > 0 && (
          <div className="space-y-2">
            {queue.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 rounded-md border p-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {item.file.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatSize(item.file.size)}
                    {item.status === "error" && item.error && (
                      <span className="text-destructive"> · {item.error}</span>
                    )}
                  </p>
                </div>
                <Select
                  value={item.fileType}
                  onValueChange={(v) => setItemType(item.id, v as FileType)}
                  disabled={item.status !== "queued"}
                >
                  <SelectTrigger className="w-36">
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
                {item.status === "uploading" ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeItem(item.id)}
                    aria-label="Remove from queue"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}

            {queuedCount > 0 && (
              <Button onClick={processQueue} disabled={uploading}>
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Uploading…
                  </>
                ) : (
                  `Upload ${queuedCount} file${queuedCount === 1 ? "" : "s"}`
                )}
              </Button>
            )}
          </div>
        )}

        {files.length === 0 && queue.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-6 text-center text-muted-foreground">
            <FileText className="h-8 w-8" />
            <p className="text-sm">
              No files attached yet. Drag PDFs here or click to browse.
            </p>
          </div>
        ) : files.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Filename</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Size</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {files.map((file) => (
                <TableRow key={file.id}>
                  <TableCell className="font-medium">{file.filename}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {file.file_type
                        ? FILE_TYPE_LABELS[file.file_type as FileType] ??
                          file.file_type
                        : "—"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatSize(file.file_size)}
                  </TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(file)}
                      aria-label={`Delete ${file.filename}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : null}
      </CardContent>
    </Card>
  )
}
