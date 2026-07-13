"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { FileSpreadsheet, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { importProducts, type CsvProductRow } from "@/lib/catalog/bulk-actions"
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
import { Label } from "@/components/ui/label"
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
import { Textarea } from "@/components/ui/textarea"

/**
 * Minimal RFC-4180-ish CSV parser: handles quoted fields, embedded commas,
 * escaped quotes ("") and newlines inside quotes. Skips blank lines.
 */
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ""
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += c
      }
    } else if (c === '"') {
      inQuotes = true
    } else if (c === ",") {
      row.push(field)
      field = ""
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++
      row.push(field)
      rows.push(row)
      row = []
      field = ""
    } else {
      field += c
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ""))
}

const TOME_FIELDS = [
  { key: "model_number", label: "Model Number", required: true },
  { key: "name", label: "Name", required: true },
  { key: "description", label: "Description", required: false },
  { key: "category", label: "Category", required: false },
  { key: "line_name", label: "Product Line", required: false },
] as const

type TomeFieldKey = (typeof TOME_FIELDS)[number]["key"]

const NONE = "__none__"

const FIELD_HINTS: Record<TomeFieldKey, string[]> = {
  model_number: ["model", "sku", "part", "mpn"],
  name: ["name", "title", "product"],
  description: ["desc"],
  category: ["categor", "type"],
  line_name: ["line", "series", "family"],
}

/** Preselect a source column per Tome field by fuzzy header match. */
function guessMapping(headers: string[]): Record<TomeFieldKey, string> {
  const mapping = {} as Record<TomeFieldKey, string>
  const used = new Set<string>()
  for (const field of TOME_FIELDS) {
    const hints = FIELD_HINTS[field.key]
    const match = headers.find(
      (h) =>
        !used.has(h) &&
        hints.some((hint) => h.trim().toLowerCase().includes(hint))
    )
    mapping[field.key] = match ?? NONE
    if (match) used.add(match)
  }
  return mapping
}

type Step = "input" | "map"

export function CsvImportDialog() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>("input")
  const [pasted, setPasted] = useState("")
  const [headers, setHeaders] = useState<string[]>([])
  const [dataRows, setDataRows] = useState<string[][]>([])
  const [mapping, setMapping] = useState<Record<TomeFieldKey, string>>(
    {} as Record<TomeFieldKey, string>
  )
  const [importing, setImporting] = useState(false)

  function reset() {
    setStep("input")
    setPasted("")
    setHeaders([])
    setDataRows([])
    setMapping({} as Record<TomeFieldKey, string>)
  }

  function handleOpenChange(next: boolean) {
    if (importing) return
    setOpen(next)
    if (!next) reset()
  }

  function loadCsv(text: string) {
    const parsed = parseCsv(text)
    if (parsed.length < 2) {
      toast.error("CSV needs a header row and at least one data row.")
      return
    }
    const headerRow = parsed[0].map((h) => h.trim())
    setHeaders(headerRow)
    setDataRows(parsed.slice(1))
    setMapping(guessMapping(headerRow))
    setStep("map")
  }

  function handleFile(file: File | undefined) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => loadCsv(String(reader.result ?? ""))
    reader.onerror = () => toast.error("Could not read the file.")
    reader.readAsText(file)
  }

  /** Indices of CSV columns not mapped to any Tome field — these go to specs. */
  function unmappedIndices(): number[] {
    const mapped = new Set(Object.values(mapping).filter((v) => v !== NONE))
    return headers
      .map((h, i) => ({ h, i }))
      .filter(({ h }) => !mapped.has(h))
      .map(({ i }) => i)
  }

  function buildRows(): CsvProductRow[] {
    const colIndex = (field: TomeFieldKey): number => {
      const header = mapping[field]
      return header === NONE ? -1 : headers.indexOf(header)
    }
    const idx: Record<TomeFieldKey, number> = {
      model_number: colIndex("model_number"),
      name: colIndex("name"),
      description: colIndex("description"),
      category: colIndex("category"),
      line_name: colIndex("line_name"),
    }
    const specIdx = unmappedIndices()

    return dataRows.map((row) => {
      const get = (i: number) => (i >= 0 ? (row[i] ?? "").trim() : "")
      const specs: Record<string, string> = {}
      for (const i of specIdx) {
        const value = (row[i] ?? "").trim()
        if (value) specs[headers[i]] = value
      }
      return {
        model_number: get(idx.model_number),
        name: get(idx.name),
        description: get(idx.description) || undefined,
        category: get(idx.category) || undefined,
        line_name: get(idx.line_name) || undefined,
        specs,
      }
    })
  }

  const requiredMapped =
    mapping.model_number !== NONE &&
    mapping.model_number != null &&
    mapping.name !== NONE &&
    mapping.name != null

  async function handleImport() {
    setImporting(true)
    const result = await importProducts(buildRows())
    setImporting(false)

    if ("error" in result) {
      toast.error(result.error)
      return
    }
    const { inserted, skipped, failed, createdLines } = result.data
    const parts = [`${inserted} product${inserted === 1 ? "" : "s"} imported`]
    if (skipped > 0) parts.push(`${skipped} skipped (missing model number or name)`)
    if (failed > 0) parts.push(`${failed} failed`)
    if (createdLines.length > 0) {
      parts.push(
        `created line${createdLines.length === 1 ? "" : "s"}: ${createdLines.join(", ")}`
      )
    }
    const message = parts.join(" · ")
    if (failed > 0) toast.error(message)
    else toast.success(message)

    setOpen(false)
    reset()
    router.refresh()
  }

  const previewRows = dataRows.slice(0, 5)

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          Import CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import Products from CSV</DialogTitle>
          <DialogDescription>
            {step === "input"
              ? "Upload a .csv file or paste CSV text. The first row must be column headers."
              : "Map your CSV columns to product fields. Unmapped columns are stored as specs."}
          </DialogDescription>
        </DialogHeader>

        {step === "input" ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="csv-file">CSV file</Label>
              <input
                id="csv-file"
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-secondary-foreground hover:file:bg-secondary/80"
                onChange={(e) => {
                  handleFile(e.target.files?.[0])
                  e.target.value = ""
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="csv-paste">Or paste CSV</Label>
              <Textarea
                id="csv-paste"
                rows={8}
                placeholder={"model,name,line\nT2A3-B,T2 Trash Pump,Super T Series"}
                value={pasted}
                onChange={(e) => setPasted(e.target.value)}
                className="font-mono text-xs"
              />
            </div>
            <DialogFooter>
              <Button
                onClick={() => loadCsv(pasted)}
                disabled={!pasted.trim()}
              >
                Continue
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {TOME_FIELDS.map((field) => (
                <div key={field.key} className="space-y-1.5">
                  <Label>
                    {field.label}
                    {field.required && (
                      <span className="text-destructive"> *</span>
                    )}
                  </Label>
                  <Select
                    value={mapping[field.key] ?? NONE}
                    onValueChange={(v) =>
                      setMapping((m) => ({ ...m, [field.key]: v }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>— Not mapped —</SelectItem>
                      {headers.map((h, i) => (
                        <SelectItem key={`${h}-${i}`} value={h}>
                          {h || `(column ${i + 1})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            {unmappedIndices().length > 0 && (
              <p className="text-xs text-muted-foreground">
                Unmapped columns saved as specs:{" "}
                {unmappedIndices()
                  .map((i) => headers[i] || `(column ${i + 1})`)
                  .join(", ")}
              </p>
            )}

            <div className="space-y-1.5">
              <p className="text-sm font-medium">
                Preview ({dataRows.length} row{dataRows.length === 1 ? "" : "s"} total)
              </p>
              <div className="max-h-60 overflow-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {headers.map((h, i) => (
                        <TableHead key={`${h}-${i}`} className="whitespace-nowrap">
                          {h || `(column ${i + 1})`}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewRows.map((row, ri) => (
                      <TableRow key={ri}>
                        {headers.map((_, ci) => (
                          <TableCell key={ci} className="max-w-48 truncate">
                            {row[ci] ?? ""}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={reset}
                disabled={importing}
              >
                Back
              </Button>
              <Button onClick={handleImport} disabled={importing || !requiredMapped}>
                {importing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importing…
                  </>
                ) : (
                  `Import ${dataRows.length} row${dataRows.length === 1 ? "" : "s"}`
                )}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
