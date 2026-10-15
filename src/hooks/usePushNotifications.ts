import { useEffect, useState } from "react"
import { registerForPush, setBadge } from "@/lib/push"
import { readPushEnabled } from "@/lib/store"
import { useReadItemsStore } from "@/store/readItems"

/**
 * Registers the device for push notifications (unless the user turned them off)
 * and keeps the icon badge equal to the unread count. The badge waits for the
 * server's read state to be merged in: otherwise it would flash a count that
 * includes what was read on another device.
 */
export function usePushNotifications(
  userId: string | undefined,
  authToken: string | null,
  lang: string,
  unreadCount: number,
): void {
  const ready = useReadItemsStore((s) => s.ready)
  const [enabled, setEnabled] = useState<boolean | null>(null)

  useEffect(() => {
    void readPushEnabled().then(setEnabled)
  }, [])

  useEffect(() => {
    if (enabled && userId && authToken) void registerForPush(userId, authToken, lang)
  }, [enabled, userId, authToken, lang])

  useEffect(() => {
    if (enabled && ready) void setBadge(unreadCount)
  }, [enabled, ready, unreadCount])
}
