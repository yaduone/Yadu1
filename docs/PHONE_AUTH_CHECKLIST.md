# Firebase Phone Authentication - Quick Checklist

## 🎯 Your Mission: Enable Phone Auth in 10 Minutes

### ✅ Checklist

#### Firebase Console (5 minutes)
- [ ] Go to [Firebase Console](https://console.firebase.google.com/) → Select `yadu1-821e8`
- [ ] **Authentication** → **Sign-in method** → Enable **Phone**
- [ ] **Project Settings** → Your Android app → Add SHA-1 fingerprint:
  ```
  3A:F7:82:A9:9F:ED:86:05:A4:34:1E:95:27:D1:15:45:65:58:A1:F6
  ```
- [ ] Download updated `google-services.json` → Replace `mobile_app/android/app/google-services.json`

#### Google Cloud Console (3 minutes)
- [ ] Go to [Google Cloud Console](https://console.cloud.google.com/) → Select `yadu1-821e8`
- [ ] **APIs & Services** → **Library** → Enable **Android Device Verification API**
- [ ] Search and enable **Play Integrity API** (if available)

#### Test Your App (2 minutes)
- [ ] Run: `cd mobile_app && flutter run`
- [ ] Enter your phone number
- [ ] Click "Send OTP"
- [ ] Enter the OTP you receive via SMS
- [ ] Verify you're logged in successfully

#### Optional: Add Test Numbers (1 minute)
- [ ] Firebase Console → **Authentication** → **Sign-in method** → **Phone**
- [ ] Add test phone: `+91 9999999999` with code `123456`
- [ ] Now you can test without real SMS!

---

## 🚨 If Something Goes Wrong

### "An internal error has occurred"
→ You forgot to add the SHA-1 fingerprint or didn't download the updated `google-services.json`

### "This app is not authorized"
→ Run: `cd mobile_app && flutter clean && flutter pub get && flutter run`

### SMS not received
→ Check if Phone Authentication is enabled in Firebase Console

---

## 📱 Your SHA-1 Fingerprint (Save This!)

**Debug SHA-1**: `3A:F7:82:A9:9F:ED:86:05:A4:34:1E:95:27:D1:15:45:65:58:A1:F6`

To get it again:
```bash
keytool -list -v -keystore "$USERPROFILE\.android\debug.keystore" -alias androiddebugkey -storepass android -keypass android
```

---

## 🎉 Success Criteria

You'll know it's working when:
1. ✅ You click "Send OTP" and receive an SMS
2. ✅ You enter the OTP and get logged in
3. ✅ You see your profile/home screen

---

**Quick Links**:
- [Firebase Console](https://console.firebase.google.com/project/yadu1-821e8)
- [Google Cloud Console](https://console.cloud.google.com/)
- [Full Setup Guide](./FIREBASE_PHONE_AUTH_SETUP.md)
