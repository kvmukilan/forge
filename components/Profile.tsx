'use client'

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Settings, Info, User, ArrowRightLeft, LogOut, Crown } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import UserForm from './UserForm'
import Link from "next/link"
import { useAtom } from "jotai"
import { aboutOpenAtom, settingsAtom, userSelectAtom, currentUserAtom } from "@/lib/atoms"
import { useState } from "react"
import { signOut } from "@/app/actions/user"
import { toast } from "@/hooks/use-toast"
import { useTranslations } from 'next-intl'

export function Profile() {
  const t = useTranslations('Profile');
  const [settings] = useAtom(settingsAtom)
  const [userSelect, setUserSelect] = useAtom(userSelectAtom)
  const [isEditing, setIsEditing] = useState(false)
  const [aboutOpen, setAboutOpen] = useAtom(aboutOpenAtom)
  const [user] = useAtom(currentUserAtom)
  const [open, setOpen] = useState(false)

  const handleSignOut = async () => {
    try {
      await signOut()
      toast({
        title: t('signOutSuccessTitle'),
        description: t('signOutSuccessDescription'),
      })
      setTimeout(() => window.location.reload(), 300);
    } catch (error) {
      toast({
        title: t('signOutErrorTitle'),
        description: t('signOutErrorDescription'),
        variant: "destructive",
      })
    }
  }

  return (
    <>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="flex min-h-11 min-w-11 items-center gap-2 rounded-xl p-1.5" aria-label="Open account menu">
            <Avatar className="h-8 w-8">
              <AvatarImage src={user?.avatarPath && `/api/avatars/${user.avatarPath.split('/').pop()}` || ""} />
              <AvatarFallback>
                <User className="h-4 w-4" />
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[200px] p-2">
          <div className="px-2 py-1.5 mb-2 border-b">
            <div className="flex items-center gap-2">
              <Avatar className="h-8 w-8">
                <AvatarImage src={user?.avatarPath && `/api/avatars/${user.avatarPath.split('/').pop()}` || ""} />
                <AvatarFallback>
                  <User className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col mr-4">
                <span className="text-sm font-semibold flex items-center gap-1 break-all">
                  {user?.username || t('guestUsername')}
                  {user?.isAdmin && <Crown className="h-3 w-3 text-primary" />}
                </span>
                {user && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpen(false);
                      setIsEditing(true);
                    }}
                    className="min-h-11 text-left text-xs text-muted-foreground transition-colors hover:text-primary"
                  >
                    {t('editProfileButton')}
                  </button>
                )}
              </div>
              {user && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpen(false);
                    handleSignOut();
                  }}
                  className="grid min-h-11 min-w-11 place-items-center rounded-xl border border-primary/50 text-primary transition-colors hover:border-primary hover:bg-primary/10"
                  aria-label="Sign out"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          <DropdownMenuItem className="min-h-11 cursor-pointer px-2 py-1.5" onClick={() => {
            setOpen(false);  // Close the dropdown
            setUserSelect(true);  // Open the user select modal
          }}>
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="h-4 w-4" />
                <span>{t('switchUserButton')}</span>
              </div>
            </div>
          </DropdownMenuItem>
          <DropdownMenuItem className="min-h-11 cursor-pointer px-2 py-1.5" asChild>
            {/* need the Link element to be the direct child of the DropdownMenuItem, since we are using asChild here */}
            <Link
              href="/settings"
              aria-label={t('settingsLink')}
              className="flex items-center justify-between w-full"
              onClick={() => setOpen(false)} // Ensure dropdown closes on click
            >
              <div className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                <span>{t('settingsLink')}</span>
              </div>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem className="min-h-11 cursor-pointer px-2 py-1.5" onClick={() => {
            setOpen(false);  // Close the dropdown
            setAboutOpen(true);  // Open the about modal
          }}>
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4" />
                <span>{t('aboutButton')}</span>
              </div>
            </div>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Add the UserForm dialog */}
      {isEditing && user && (
        <Dialog open={isEditing} onOpenChange={() => setIsEditing(false)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{t('editProfileModalTitle')}</DialogTitle>
            </DialogHeader>
            <UserForm
              userId={user.id}
              onCancel={() => setIsEditing(false)}
              onSuccess={() => {
                setIsEditing(false);
                window.location.reload();
              }}
            />
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
