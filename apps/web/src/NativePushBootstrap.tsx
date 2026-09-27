import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { useAuth } from "./context/AuthContext";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

export default function NativePushBootstrap() {
  const { token } = useAuth();

  useEffect(() => {
    if (!token || !Capacitor.isNativePlatform()) return;

    let registrationListener: { remove: () => Promise<void> } | undefined;
    let actionListener: { remove: () => Promise<void> } | undefined;
    let cancelled = false;

    const register = async () => {
      let permission = await PushNotifications.checkPermissions();
      if (permission.receive === "prompt") {
        permission = await PushNotifications.requestPermissions();
      }
      if (permission.receive !== "granted" || cancelled) return;

      registrationListener = await PushNotifications.addListener("registration", async ({ value }) => {
        try {
          await fetch(API_URL + "/notifications/fcm-token", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: "Bearer " + token,
            },
            body: JSON.stringify({ token: value, platform: "android" }),
          });
        } catch {}
      });

      actionListener = await PushNotifications.addListener("pushNotificationActionPerformed", ({ notification }) => {
        const url = (notification.data as any)?.url;
        if (typeof url === "string" && url.startsWith("/")) {
          window.history.pushState({}, "", url);
          window.dispatchEvent(new PopStateEvent("popstate"));
        }
      });

      await PushNotifications.register();
    };

    void register();

    return () => {
      cancelled = true;
      void registrationListener?.remove();
      void actionListener?.remove();
    };
  }, [token]);

  return null;
}
