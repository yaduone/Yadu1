# Flutter
-keep class io.flutter.** { *; }
-keep class io.flutter.plugins.** { *; }

# Play Core (deferred components — classes may be absent at build time)
-dontwarn com.google.android.play.core.**
-keep class com.google.android.play.core.** { *; }

# Firebase
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }

# Keep crash reporting readable
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
