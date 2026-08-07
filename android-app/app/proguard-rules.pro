# Add project specific ProGuard rules here.
-keep class com.nexus.fleet.domain.model.** { *; }
-keepclassmembers class com.nexus.fleet.domain.model.** { *; }
-dontwarn javax.annotation.**
-keepattributes Signature
-keepattributes *Annotation*
