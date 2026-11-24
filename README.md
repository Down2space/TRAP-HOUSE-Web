# TRAP HOUSE (Android)

The TRAP HOUSE web game packed into an Android app. It runs fully offline: three.js, the fonts, models, textures and sounds are all inside the APK.

Every push to `main` builds a new APK with GitHub Actions. Get it from **Releases** (newest build on top), download `TRAP-HOUSE.apk` on your phone and install it. Each build is signed with the same key, so it installs over the last one and keeps your saves.

- Game files: `app/src/main/assets/www/`
- App wrapper: `app/src/main/java/com/yaway/traphouse/MainActivity.java`
