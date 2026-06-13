import { getUser } from '@/lib/auth/get-user'
import { getManufacturerProfile } from '@/lib/profile/actions'
import { Card, CardContent } from '@/components/ui/card'
import { ProfileEditor } from '@/components/profile/profile-editor'

export default async function ProfilePage() {
  const { org } = await getUser()

  if (org?.type !== 'manufacturer') {
    return (
      <div className="flex justify-center mt-16">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-center">
              Profile management is only available to manufacturer accounts.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const profile = await getManufacturerProfile()

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold mb-6">Manufacturer Profile</h1>
      <ProfileEditor profile={profile} org={org} />
    </div>
  )
}
