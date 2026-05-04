# Flutter
-keep class io.flutter.** { *; }
-keep class io.flutter.plugins.** { *; }

# Play Core (deferred components — classes may be absent at build time)
-dontwarn com.google.android.play.core.**
-keep class com.google.android.play.core.** { *; }

# Firebase
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }

# Firebase App Check / Play Integrity
-keep class com.google.android.play.core.integrity.** { *; }
-dontwarn com.google.android.play.core.integrity.**

# OkHttp / http package
-dontwarn okhttp3.**
-dontwarn okio.**
-keep class okhttp3.** { *; }
-keep interface okhttp3.** { *; }

# Cached Network Image / Glide
-keep public class * implements com.bumptech.glide.module.GlideModule
-keep class * extends com.bumptech.glide.module.AppGlideModule { *; }
-keep public enum com.bumptech.glide.load.ImageHeaderParser$** {
  **[] $VALUES;
  public *;
}

# url_launcher
-keep class androidx.browser.** { *; }

# flutter_local_notifications
-keep class com.dexterous.** { *; }

# youtube_player_flutter / WebView
-keep class com.google.android.youtube.** { *; }
-dontwarn com.google.android.youtube.**
-keep class androidx.webkit.** { *; }

# Keep crash reporting readable
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# Keep generic signatures for serialization
-keepattributes Signature
-keepattributes *Annotation*
