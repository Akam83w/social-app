# SDM Android native push setup

The Android project is now prepared for Firebase Cloud Messaging (FCM) and incoming-call notifications.

## Required Firebase configuration

1. Create/select the Firebase project for SDM.
2. Add an Android app with package ID `com.instaIraq.app`.
3. Download `google-services.json`.
4. Put it at `apps/web/android/app/google-services.json` (do not commit a real service-account key).
5. In the API deployment environment, add `FIREBASE_SERVICE_ACCOUNT_JSON` containing the Firebase Admin service-account JSON as a single environment variable.

The API stores native FCM tokens in `fcm_tokens` and sends high-priority data messages for normal notifications and incoming calls.

## Build

From `apps/web`:

```
npm install
npx cap sync android
cd android
./gradlew assembleDebug
```

The app requests notification, microphone and camera permissions. Incoming call push data opens the existing `/call?incoming=1&callId=...` route.

## Important

FCM delivery will not work until both Firebase files/configuration above are supplied. Google Play publication is not required for FCM testing on an installed Android APK.
