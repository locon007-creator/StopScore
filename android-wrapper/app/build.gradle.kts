plugins {
    id("com.android.application")
}

android {
    namespace = "net.stopscore.driver"
    compileSdk = 35

    defaultConfig {
        applicationId = "net.stopscore.driver"
        minSdk = 24
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("debug")
        }
    }
}
