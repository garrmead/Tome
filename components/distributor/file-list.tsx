"use client"

import { useState } from "react"
import { FileText } from "lucide-react"

import { FILE_TYPE_LABELS, type FileType, type ProductFile } from "@/lib/catalog/types"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { FileViewer } from "./file-viewer"

function formatSize(bytes: number | null): string {
  if (bytes == null) return "—"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function FileList({
  files,
  emptyLabel = "No files available.",
}: {
  files: ProductFile[]
  emptyLabel?: string
}) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  function openFile(id: string) {
    setActiveId(id)
    setOpen(true)
  }

  if (files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-10 text-center text-muted-foreground">
        <FileText className="h-8 w-8" />
        <p className="text-sm">{emptyLabel}</p>
      </div>
    )
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Filename</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Size</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {files.map((file) => (
            <TableRow
              key={file.id}
              className="cursor-pointer"
              onClick={() => openFile(file.id)}
            >
              <TableCell className="font-medium">
                <span className="inline-flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  {file.filename}
                </span>
              </TableCell>
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
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <FileViewer fileId={activeId} open={open} onOpenChange={setOpen} />
    </>
  )
}
