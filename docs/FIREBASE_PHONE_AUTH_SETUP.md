# Firebase Phone Authentication Setup Guide

## Overview
This guide walks you through setting up Firebase Phone Authentication for your YaduONE Flutter app.

## Your App Details
- **Package Name**: `com.dairydelivery.dairy_delivery`
- **Firebase Project**: `yadu1-821e8`
- **SHA-1 Fingerprint (Debug)**: `3A:F7:82:A9:9F:ED:86:05:A4:34:1E:95:27:D1:15:45:65:58:A1:F6`

---

## Step 1: Firebase Console Setup

### 1.1 Enable Phone Authentication
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **yadu1-821e8**
3. Navigate to **Authentication** → **Sign-in method**
4. Find **Phone** in the list of providers
5. Click on **Phone**
6. Toggle **Enable** to ON
7. Click **Save**

### 1.2 Add SHA-1 Fingerprint (CRITICAL)
Without this, phone auth will fail on Android devices!

1. In Firebase Console, click the **gear icon** (⚙️) → **Project settings**
2. Scroll down to **Your apps** section
3. Select your Android app: `com.dairydelivery.dairy_delivery`
4. Scroll to **SHA certificate fingerprints** section
5. Click **Add fingerprint**
6. Paste your debug SHA-1:
   ```
   3A:F7:82:A9:9F:ED:86:05:A4:34:1E:95:27:D1:15:45:65:58:A1:F6
   ```
7. Click **Save**

### 1.3 Download Updated google-services.json
1. After adding the SHA-1, Firebase will update your configuration
2. Click **Download google-services.json**
3. Replace the existing file at: `mobile_app/android/app/google-services.json`

---

## Step 2: Enable Required Google Cloud APIs

Phone authentication requires SafetyNet/Play Integrity API for security.

### 2.1 Enable Android Device Verification API
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select project: **yadu1-821e8**
3. Go to **APIs & Services** → **Library**
4. Search for **"Android Device Verification API"**
5. Click on it and click **Enable**

### 2.2 Enable Play Integrity API (Recommended)
1. In the same **Library** section
2. Search for **"Play Integrity API"**
3. Click on it and click **Enable**

---

## Step 3: Test Phone Authentication

### 3.1 Run Your App
```bash
cd mobile_app
flutter run
```

### 3.2 Test Flow
1. Enter a valid phone number (e.g., your mobile number)
2. Click **Send OTP**
3. You should receive an SMS with a 6-digit code
4. Enter the OTP on the verification screen
5. You should be logged in successfully

### 3.3 Common Issues & Solutions

#### Issue: "An internal error has occurred"
**Solution**: Make sure you've added the SHA-1 fingerprint and downloaded the updated `google-services.json`

#### Issue: "This app is not authorized to use Firebase Authentication"
**Solution**: 
- Verify the package name matches: `com.dairydelivery.dairy_delivery`
- Ensure `google-services.json` is in the correct location
- Clean and rebuild: `flutter clean && flutter pub get && flutter run`

#### Issue: SMS not received
**Solution**:
- Check if Phone Authentication is enabled in Firebase Console
- Verify your phone number is valid
- Check if you have SMS quota limits (Firebase free tier has limits)
- Try adding test phone numbers (see below)

---

## Step 4: Add Test Phone Numbers (Optional but Recommended)

For development, you can add test phone numbers that don't require real SMS.

1. Go to Firebase Console → **Authentication** → **Sign-in method**
2. Scroll to **Phone** section
3. Expand **Phone numbers for testing**
4. Add test numbers with their verification codes:
   - Phone: `+91 9999999999` → Code: `123456`
   - Phone: `+91 8888888888` → Code: `654321`
5. Click **Save**

Now you can test without waiting for real SMS!

---

## Step 5: Production Setup (Before Release)

### 5.1 Create Release Keystore
```bash
keytool -genkey -v -keystore ~/upload-keystore.jks -keyalg RSA -keysize 2048 -validity 10000 -alias upload
```

### 5.2 Get Release SHA-1
```bash
keytool -list -v -keystore ~/upload-keystore.jks -alias upload
```

### 5.3 Add Release SHA-1 to Firebase
1. Copy the SHA-1 from the release keystore
2. Go to Firebase Console → Project Settings → Your Android app
3. Add the release SHA-1 fingerprint
4. Download updated `google-services.json`

### 5.4 Configure Signing in Android
Create `mobile_app/android/key.properties`:
```properties
storePassword=<your-store-password>
keyPassword=<your-key-password>
keyAlias=upload
storeFile=<path-to-your-keystore>
```

Update `mobile_app/android/app/build.gradle.kts` to use the release keystore.

---

## Step 6: Monitor Usage

### 6.1 Check Authentication Logs
1. Firebase Console → **Authentication** → **Users**
2. You'll see all authenticated users here

### 6.2 Monitor SMS Quota
1. Firebase Console → **Authentication** → **Usage**
2. Free tier: 10,000 verifications/month
3. After that: Pay-as-you-go pricing

---

## Current Implementation Status

✅ **Already Implemented**:
- Firebase Auth SDK integrated (`firebase_auth: ^5.3.4`)
- Phone number input UI (`login_screen.dart`)
- OTP verification UI (`otp_screen.dart`)
- Auth provider with `sendOtp()` and `verifyOtp()` methods
- Backend sync after Firebase authentication
- Profile completion flow

🔧 **What You Need to Do**:
1. Enable Phone Authentication in Firebase Console
2. Add SHA-1 fingerprint
3. Download updated `google-services.json`
4. Enable required Google Cloud APIs
5. Test the flow

---

## Architecture Overview

```
User enters phone → sendOtp() → Firebase sends SMS
                                      ↓
User enters OTP → verifyOtp() → Firebase validates
                                      ↓
                              signInWithCredential()
                                      ↓
                              _syncUser() → Backend API
                                      ↓
                              Profile complete? → Home : Complete Profile
```

---

## Security Best Practices

1. **Never commit `google-services.json` to public repos** (already in `.gitignore`)
2. **Use reCAPTCHA for web** (automatically handled by Firebase)
3. **Implement rate limiting** on your backend
4. **Validate phone numbers** before sending OTP
5. **Set up Firebase App Check** for production (advanced)

---

## Troubleshooting Commands

### Check if Firebase is initialized
```bash
flutter run --verbose | grep -i firebase
```

### Clean build
```bash
cd mobile_app
flutter clean
flutter pub get
cd android
./gradlew clean
cd ..
flutter run
```

### Check SHA-1 again
```bash
keytool -list -v -keystore "$USERPROFILE\.android\debug.keystore" -alias androiddebugkey -storepass android -keypass android
```

---

## Support Resources

- [Firebase Phone Auth Docs](https://firebase.google.com/docs/auth/flutter/phone-auth)
- [FlutterFire Documentation](https://firebase.flutter.dev/docs/auth/phone)
- [Firebase Console](https://console.firebase.google.com/)
- [Google Cloud Console](https://console.cloud.google.com/)

---

## Next Steps After Setup

1. ✅ Test with real phone numbers
2. ✅ Add test phone numbers for development
3. ✅ Test the complete flow: Login → OTP → Profile → Home
4. ✅ Monitor authentication in Firebase Console
5. 🔜 Set up release keystore for production
6. 🔜 Implement Firebase App Check (optional, for advanced security)

---

**Last Updated**: April 30, 2026
**Your SHA-1**: `3A:F7:82:A9:9F:ED:86:05:A4:34:1E:95:27:D1:15:45:65:58:A1:F6`
