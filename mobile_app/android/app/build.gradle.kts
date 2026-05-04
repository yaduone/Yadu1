import java.util.Properties

val keyPropertiesFile = rootProject.file("key.properties")
val keyProperties = Properties().apply {
    if (keyPropertiesFile.exists()) load(keyPropertiesFile.inputStream())
}

plugins {
    id("com.android.application")
    // START: FlutterFire Configuration
    id("com.google.gms.google-services")
    // END: FlutterFire Configuration
    id("kotlin-android")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

android {
    namespace = "com.dairydelivery.dairy_delivery"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
        isCoreLibraryDesugaringEnabled = true
    }

    kotlinOptions {
        jvmTarget = JavaVersion.VERSION_11.toString()
    }

    defaultConfig {
        // TODO: Specify your own unique Application ID (https://developer.android.com/studio/build/application-id.html).
        applicationId = "com.dairydelivery.dairy_delivery"
        // You can update the following values to match your application needs.
        // For more information, see: https://flutter.dev/to/review-gradle-config.
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    signingConfigs {
        create("release") {
            storeFile = (keyProperties["storeFile"] as String?)?.let { file(it) }
                ?: System.getenv("KEYSTORE_PATH")?.let { file(it) }
            storePassword = keyProperties["storePassword"] as String?
                ?: System.getenv("KEYSTORE_PASSWORD")
            keyAlias = keyProperties["keyAlias"] as String?
                ?: System.getenv("KEY_ALIAS")
            keyPassword = keyProperties["keyPassword"] as String?
                ?: System.getenv("KEY_PASSWORD")
        }
    }

    buildTypes {
        release {
            val hasReleaseKey = keyPropertiesFile.exists() || System.getenv("KEYSTORE_PATH") != null
            if (!hasReleaseKey) {
                throw GradleException(
                    "Release signing key not configured. " +
                    "Provide android/key.properties or set KEYSTORE_PATH env var."
                )
            }
            signingConfig = signingConfigs.getByName("release")
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
}

flutter {
    source = "../.."
}

dependencies {
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.4")
}
