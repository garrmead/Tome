"use client"

import { useState, useTransition, useRef } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Plus, X, Upload, ImageIcon } from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

import { createClient } from "@/lib/supabase/client"
import {
  upsertManufacturerProfile,
  updateLogoUrl,
  updateOrgChartUrl,
} from "@/lib/profile/actions"
import { ORG_ASSETS_BUCKET } from "@/lib/profile/types"
import type { Contact, ManufacturerProfile } from "@/lib/profile/types"
import type { Org } from "@/lib/auth/get-user"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

interface Props {
  profile: ManufacturerProfile | null
  org: Org
}

function ext(filename: string): string {
  const m = filename.match(/(\.[^.]+)$/)
  return m ? m[1].toLowerCase() : ""
}

export function ProfileEditor({ profile, org }: Props) {
  const router = useRouter()
  const [saving, startSave] = useTransition()
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null)

  // ── Section state ───────────────────────────────────────────────────────
  const [tagline, setTagline] = useState(profile?.tagline ?? "")
  const [about, setAbout] = useState(profile?.about ?? "")
  const [aboutTab, setAboutTab] = useState<"edit" | "preview">("edit")
  const [contactEmail, setContactEmail] = useState(profile?.contact_email ?? "")
  const [contactPhone, setContactPhone] = useState(profile?.contact_phone ?? "")
  const [contacts, setContacts] = useState<Contact[]>(
    profile?.contacts?.length
      ? profile.contacts
      : []
  )
  const [enablePriceBooks, setEnablePriceBooks] = useState(
    profile?.enable_price_books ?? false
  )

  // ── Logo ─────────────────────────────────────────────────────────────────
  const [logoUrl, setLogoUrl] = useState(profile?.logo_url ?? "")
  const [logoUploading, setLogoUploading] = useState(false)
  const [logoError, setLogoError] = useState("")
  const logoInputRef = useRef<HTMLInputElement>(null)

  async function handleLogoChange(file: File) {
    setLogoError("")
    setLogoUploading(true)
    const supabase = createClient()
    const path = `${org.id}/logo${ext(file.name)}`
    const { error: stErr } = await supabase.storage
      .from(ORG_ASSETS_BUCKET)
      .upload(path, file, { upsert: true })
    if (stErr) {
      setLogoError(stErr.message)
      setLogoUploading(false)
      return
    }
    const { data: urlData } = supabase.storage
      .from(ORG_ASSETS_BUCKET)
      .getPublicUrl(path)
    const url = urlData.publicUrl
    const result = await updateLogoUrl(url)
    if ("error" in result) {
      setLogoError(result.error)
    } else {
      setLogoUrl(url)
    }
    setLogoUploading(false)
  }

  // ── Org chart ─────────────────────────────────────────────────────────────
  const [orgChartUrl, setOrgChartUrl] = useState(profile?.org_chart_url ?? "")
  const [orgChartUploading, setOrgChartUploading] = useState(false)
  const [orgChartError, setOrgChartError] = useState("")
  const orgChartInputRef = useRef<HTMLInputElement>(null)

  async function handleOrgChartChange(file: File) {
    setOrgChartError("")
    setOrgChartUploading(true)
    const supabase = createClient()
    const path = `${org.id}/org-chart${ext(file.name)}`
    const { error: stErr } = await supabase.storage
      .from(ORG_ASSETS_BUCKET)
      .upload(path, file, { upsert: true })
    if (stErr) {
      setOrgChartError(stErr.message)
      setOrgChartUploading(false)
      return
    }
    const { data: urlData } = supabase.storage
      .from(ORG_ASSETS_BUCKET)
      .getPublicUrl(path)
    const url = urlData.publicUrl
    const result = await updateOrgChartUrl(url)
    if ("error" in result) {
      setOrgChartError(result.error)
    } else {
      setOrgChartUrl(url)
    }
    setOrgChartUploading(false)
  }

  // ── Contacts helpers ──────────────────────────────────────────────────────
  function addContact() {
    setContacts((c) => [
      ...c,
      { id: crypto.randomUUID(), name: "", title: "", email: "", phone: "", region: "" },
    ])
  }

  function removeContact(id: string) {
    setContacts((c) => c.filter((ct) => ct.id !== id))
  }

  function updateContact(id: string, field: keyof Contact, value: string) {
    setContacts((c) =>
      c.map((ct) => (ct.id === id ? { ...ct, [field]: value } : ct))
    )
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  function handleSave() {
    setSaveMsg(null)
    startSave(async () => {
      const result = await upsertManufacturerProfile({
        tagline,
        about,
        contact_email: contactEmail,
        contact_phone: contactPhone,
        contacts,
        enable_price_books: enablePriceBooks,
      })
      if ("error" in result) {
        setSaveMsg({ ok: false, text: result.error })
      } else {
        setSaveMsg({ ok: true, text: "Saved!" })
        router.refresh()
        setTimeout(() => setSaveMsg(null), 3000)
      }
    })
  }

  return (
    <div className="space-y-6 pb-24">
      {/* ── Logo ─────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Logo</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-6">
          <div
            className="relative h-24 w-24 shrink-0 cursor-pointer rounded-lg border-2 border-dashed border-muted-foreground/30 overflow-hidden flex items-center justify-center hover:border-primary/50 transition-colors"
            onClick={() => logoInputRef.current?.click()}
          >
            {logoUrl ? (
              <img
                src={logoUrl}
                alt="Logo"
                className="h-full w-full object-cover"
              />
            ) : (
              <ImageIcon className="h-8 w-8 text-muted-foreground/40" />
            )}
            {logoUploading && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/70">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => logoInputRef.current?.click()}
              disabled={logoUploading}
            >
              <Upload className="h-4 w-4" />
              {logoUrl ? "Change logo" : "Upload logo"}
            </Button>
            <p className="text-xs text-muted-foreground">
              PNG, JPG, SVG — displayed on your public profile.
            </p>
            {logoError && (
              <p className="text-xs text-destructive">{logoError}</p>
            )}
          </div>
          <input
            ref={logoInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) handleLogoChange(f)
              e.target.value = ""
            }}
          />
        </CardContent>
      </Card>

      {/* ── About ─────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>About</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="tagline">Tagline</Label>
            <Input
              id="tagline"
              placeholder="Precision controls for every climate."
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              maxLength={160}
            />
          </div>
          <Separator />
          <div className="space-y-2">
            <div className="flex gap-1 border-b pb-0">
              <button
                type="button"
                onClick={() => setAboutTab("edit")}
                className={cn(
                  "px-3 py-1.5 text-sm font-medium -mb-px border-b-2 transition-colors",
                  aboutTab === "edit"
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => setAboutTab("preview")}
                className={cn(
                  "px-3 py-1.5 text-sm font-medium -mb-px border-b-2 transition-colors",
                  aboutTab === "preview"
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                Preview
              </button>
            </div>
            {aboutTab === "edit" ? (
              <Textarea
                placeholder="Tell distributors about your company, history, and products…"
                value={about}
                onChange={(e) => setAbout(e.target.value)}
                className="min-h-[200px] font-mono text-sm"
              />
            ) : (
              <div className="min-h-[200px] rounded-md border bg-muted/20 p-4 text-sm leading-relaxed space-y-3">
                {about ? (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      h1: ({ children }) => <h1 className="text-xl font-bold mt-4 mb-2">{children}</h1>,
                      h2: ({ children }) => <h2 className="text-lg font-semibold mt-3 mb-1">{children}</h2>,
                      h3: ({ children }) => <h3 className="text-base font-semibold mt-2 mb-1">{children}</h3>,
                      p: ({ children }) => <p className="mb-2">{children}</p>,
                      ul: ({ children }) => <ul className="list-disc pl-5 mb-2 space-y-0.5">{children}</ul>,
                      ol: ({ children }) => <ol className="list-decimal pl-5 mb-2 space-y-0.5">{children}</ol>,
                      li: ({ children }) => <li>{children}</li>,
                      strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                      em: ({ children }) => <em className="italic">{children}</em>,
                      code: ({ children }) => <code className="bg-muted rounded px-1 font-mono text-xs">{children}</code>,
                      a: ({ href, children }) => <a href={href} className="text-primary underline underline-offset-2">{children}</a>,
                    }}
                  >
                    {about}
                  </ReactMarkdown>
                ) : (
                  <p className="text-muted-foreground italic">Nothing to preview yet.</p>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Contact People ─────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Contact People</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="contact-email">Primary contact email</Label>
              <Input
                id="contact-email"
                type="email"
                placeholder="sales@example.com"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contact-phone">Primary contact phone</Label>
              <Input
                id="contact-phone"
                type="tel"
                placeholder="+1 555 000 0000"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
              />
            </div>
          </div>

          {contacts.length > 0 && <Separator />}

          <div className="space-y-4">
            {contacts.map((ct, i) => (
              <div key={ct.id} className="relative rounded-lg border p-4">
                <button
                  type="button"
                  onClick={() => removeContact(ct.id)}
                  className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                  aria-label="Remove contact"
                >
                  <X className="h-4 w-4" />
                </button>
                <p className="text-xs font-medium text-muted-foreground mb-3">
                  Contact {i + 1}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {(
                    [
                      { field: "name", label: "Name", placeholder: "Jane Smith" },
                      { field: "title", label: "Title", placeholder: "Regional Sales Manager" },
                      { field: "email", label: "Email", placeholder: "jane@example.com" },
                      { field: "phone", label: "Phone", placeholder: "+1 555 000 0001" },
                      { field: "region", label: "Region", placeholder: "Northeast US" },
                    ] as { field: keyof Contact; label: string; placeholder: string }[]
                  ).map(({ field, label, placeholder }) => (
                    <div key={field} className="space-y-1.5">
                      <Label>{label}</Label>
                      <Input
                        placeholder={placeholder}
                        value={ct[field]}
                        onChange={(e) => updateContact(ct.id, field, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addContact}
          >
            <Plus className="h-4 w-4" />
            Add Contact
          </Button>
        </CardContent>
      </Card>

      {/* ── Org Chart ─────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Org Chart</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {orgChartUrl && (
            <img
              src={orgChartUrl}
              alt="Org chart"
              className="w-full max-h-96 rounded-md border object-contain"
            />
          )}
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => orgChartInputRef.current?.click()}
              disabled={orgChartUploading}
            >
              {orgChartUploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {orgChartUrl ? "Replace org chart" : "Upload org chart"}
            </Button>
            <p className="text-xs text-muted-foreground">PNG or JPG.</p>
          </div>
          {orgChartError && (
            <p className="text-xs text-destructive">{orgChartError}</p>
          )}
          <input
            ref={orgChartInputRef}
            type="file"
            accept="image/png,image/jpeg"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) handleOrgChartChange(f)
              e.target.value = ""
            }}
          />
        </CardContent>
      </Card>

      {/* ── Settings ──────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <label className="flex items-center gap-3 cursor-pointer">
            <Checkbox
              checked={enablePriceBooks}
              onCheckedChange={(v) => setEnablePriceBooks(Boolean(v))}
            />
            <span className="text-sm">
              Enable Price Books tab on public profile
            </span>
          </label>
        </CardContent>
      </Card>

      {/* ── Sticky save bar ───────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 border-t bg-background/95 backdrop-blur px-6 py-3 flex items-center justify-end gap-4">
        {saveMsg && (
          <span
            className={cn(
              "text-sm",
              saveMsg.ok ? "text-green-600 dark:text-green-400" : "text-destructive"
            )}
          >
            {saveMsg.text}
          </span>
        )}
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Save changes
        </Button>
      </div>
    </div>
  )
}
