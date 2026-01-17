# Summer Loops (Warmly) - Development Guide

## Project Structure

```
summer-loops/
├── frontend/          # React + Vite frontend
├── backend/           # Node.js + Hono backend
├── ios_distribution.p12
└── MyWarmly_App_profile.mobileprovision
```

## Quick Commands

### Frontend

```bash
cd frontend

# Development
npm run dev              # Start dev server (http://localhost:5173)

# Production Build
npm run build            # Build for production
npm run preview          # Preview production build
```

### Backend

```bash
cd backend

# Development
npm run dev              # Start with hot reload

# Production (PM2)
pm2 restart warmly-backend    # Restart backend
pm2 logs warmly-backend       # View logs
pm2 status                    # Check status
```

### Deploy to Production

```bash
# Frontend: Build and deploy
cd frontend
npm run build
# Files are in dist/ - deploy to your web server

# Backend: Restart PM2
pm2 restart warmly-backend
```

---

## iOS App Build (VoltBuilder)

### Prerequisites
- iOS Distribution Certificate: `ios_distribution.p12`
- Provisioning Profile: `MyWarmly_App_profile.mobileprovision`
- Apple Developer account

### Build Process

```bash
cd frontend

# 1. Generate app icons (if icon changed)
./scripts/generate-icons.sh

# 2. Build VoltBuilder package
./scripts/build-voltbuilder.sh
```

This creates: `warmly-voltbuilder-YYYYMMDD-HHMMSS.zip`

### Upload to VoltBuilder

1. Go to https://volt.build
2. Create new project or select existing
3. Upload the zip package
4. Enter certificate password when prompted
5. Select iOS platform
6. Build and download `.ipa` file

### App Configuration

| Setting | Value |
|---------|-------|
| App ID | `com.mywarmly.app` |
| App Name | `Warmly` |
| Version | `1.0.0` |
| Min iOS | `13.0` |
| API URL | `https://mywarmly.app/api` |

### Build Number (Bundle Version)

The build script (`./scripts/build-voltbuilder.sh`) auto-increments the build number in **three locations**:

| File | Setting |
|------|---------|
| `frontend/voltbuilder.json` | `build` and `ios.buildNumber` |
| `frontend/config.xml` | `ios-CFBundleVersion` attribute |
| `frontend/ios/App/App.xcodeproj/project.pbxproj` | `CURRENT_PROJECT_VERSION` |

**Important:** All three must be in sync for App Store Connect upload to succeed.

### Icon Sizes Generated
40, 58, 60, 76, 80, 87, 120, 152, 167, 180, 512, 1024 pixels

### Troubleshooting

**Build fails with certificate error:**
- Verify certificate password is correct
- Check provisioning profile matches bundle ID (`com.warmly.app`)
- Ensure certificate is not expired

**App crashes on launch:**
- Check API URL is accessible from device
- Verify CORS settings on backend allow native app origin

**Styling broken:**
- Ensure `npm run build` completed successfully
- Check that Tailwind CSS is bundled (no CDN dependency)

**App Store Connect: "Bundle version must be higher":**
- Ensure all three build number locations are in sync (see "Build Number" section)
- The Xcode project's `CURRENT_PROJECT_VERSION` in `project.pbxproj` is the actual value used
- Run `./scripts/build-voltbuilder.sh` which auto-increments all locations

---

## Configuration Files

### VoltBuilder Config (`frontend/voltbuilder.json`)
- App metadata and build settings
- Certificate paths
- iOS preferences

### Capacitor Config (`frontend/capacitor.config.json`)
- Native app settings
- Plugin configuration
- Splash screen and status bar

### Cordova Config (`frontend/config.xml`)
- Platform-specific preferences
- Icon definitions
- Plugin declarations

---

## Environment

### Production URLs
- Frontend: https://mywarmly.app
- API: https://mywarmly.app/api

### Local Development
- Frontend: http://localhost:5173
- Backend: http://localhost:7000
- API proxy: `/api` → `http://localhost:7000`

---

## Common Tasks

### Update App Version

**Marketing Version** (e.g., 1.0.0 → 1.1.0):
1. `frontend/voltbuilder.json` - `version`
2. `frontend/config.xml` - `version` attribute
3. `frontend/ios/App/App.xcodeproj/project.pbxproj` - `MARKETING_VERSION`
4. `frontend/package.json` - `version` (optional)

**Build Number** (auto-incremented by build script):
- The build script handles this automatically
- To manually set: edit all three locations listed in "Build Number" section above

### Update App Icon

1. Place new 1024x1024 PNG at `frontend/public/icons/icon-1024.png`
2. Run `./scripts/generate-icons.sh`
3. Rebuild VoltBuilder package

### Add New Capacitor Plugin

1. Install: `npm install @capacitor/plugin-name`
2. Update `capacitor.config.json` if needed
3. Add to `config.xml` plugins section
4. Rebuild package
