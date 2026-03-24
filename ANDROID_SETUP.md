# Booky Android Development

This branch is dedicated to developing the Android version of Booky.

## Overview

Booky Android will be a native Android application that brings the powerful ebook library management and reading features of Booky to Android devices.

## Planned Features

### Core Features (Phase 1)
- [ ] Native Android UI using Kotlin and Jetpack Compose
- [ ] Local ebook library management
- [ ] Support for PDF, EPUB, and other ebook formats
- [ ] Built-in readers for all supported formats
- [ ] Reading progress tracking and synchronization
- [ ] Collection/shelf organization
- [ ] Search and filtering capabilities

### Advanced Features (Phase 2)
- [ ] Cloud sync with web version
- [ ] Annotation and highlighting
- [ ] Night mode and reading themes
- [ ] Custom fonts and reading settings
- [ ] PDF tools integration
- [ ] Export and sharing capabilities

### Mobile-Specific Features (Phase 3)
- [ ] Gesture controls for page turning
- [ ] Volume key navigation
- [ ] Auto-scroll mode
- [ ] TTS (Text-to-Speech) integration
- [ ] Background reading statistics
- [ ] Widget support

## Technology Stack

### Recommended Technologies
- **Language**: Kotlin
- **UI Framework**: Jetpack Compose
- **Architecture**: MVVM with Repository pattern
- **Database**: Room for local storage
- **PDF Rendering**: Android PdfRenderer or PDF.js integration
- **EPUB Rendering**: Readium SDK or FolioReader
- **Network**: Retrofit + OkHttp for API calls
- **Dependency Injection**: Hilt
- **Testing**: JUnit, Espresso, Compose Testing

## Project Structure (Proposed)

```
booky-android/
├── app/
│   ├── src/
│   │   ├── main/
│   │   │   ├── java/com/booky/
│   │   │   │   ├── ui/
│   │   │   │   │   ├── library/      # Library screen
│   │   │   │   │   ├── reader/       # Reader screen
│   │   │   │   │   ├── collections/  # Collections management
│   │   │   │   │   └── settings/     # Settings screen
│   │   │   │   ├── data/
│   │   │   │   │   ├── repository/   # Data repositories
│   │   │   │   │   ├── local/        # Room database
│   │   │   │   │   └── remote/       # API services
│   │   │   │   ├── domain/
│   │   │   │   │   ├── model/        # Domain models
│   │   │   │   │   └── usecase/      # Business logic
│   │   │   │   └── util/             # Utilities
│   │   │   ├── res/                  # Resources
│   │   │   └── AndroidManifest.xml
│   │   └── test/                     # Unit tests
│   └── build.gradle.kts
├── gradle/
├── build.gradle.kts
└── settings.gradle.kts
```

## Getting Started

### Prerequisites
- Android Studio (latest stable version)
- JDK 11 or higher
- Android SDK (API level 26+)
- Gradle 8.x

### Setup Instructions

1. **Clone the repository**
   ```bash
   git clone https://github.com/Programming2055/Booky.git
   cd Booky
   git checkout booky-android
   ```

2. **Open in Android Studio**
   - File → Open → Select the project directory
   - Wait for Gradle sync to complete

3. **Configure SDK**
   - Ensure Android SDK is properly configured
   - Install required SDK platforms and tools

4. **Build the project**
   ```bash
   ./gradlew build
   ```

5. **Run on device/emulator**
   - Connect Android device or start emulator
   - Click "Run" in Android Studio

## Development Guidelines

### Code Style
- Follow [Kotlin coding conventions](https://kotlinlang.org/docs/coding-conventions.html)
- Use ktlint for code formatting
- Write meaningful commit messages

### Architecture Guidelines
- Use MVVM architecture pattern
- Separate concerns: UI, Business Logic, Data
- Follow single responsibility principle
- Use dependency injection

### Testing Requirements
- Write unit tests for ViewModels and Use Cases
- Write UI tests for critical user flows
- Aim for >70% code coverage

## API Integration

The Android app will integrate with a backend API for:
- User authentication
- Cloud sync
- Book metadata retrieval
- Reading progress synchronization

API endpoints will be defined in a separate API documentation.

## Performance Considerations

### Memory Management
- Use efficient bitmap loading for book covers
- Implement pagination for large libraries
- Cache frequently accessed data

### Battery Optimization
- Minimize background processing
- Use WorkManager for scheduled tasks
- Optimize reading mode for low power consumption

### Storage Management
- Support external storage for ebooks
- Implement smart caching strategies
- Provide storage cleanup options

## Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch from `booky-android`
3. Make your changes
4. Submit a pull request

## Roadmap

### Q2 2026
- [ ] Project setup and architecture
- [ ] Basic UI implementation
- [ ] PDF reader integration
- [ ] EPUB reader integration

### Q3 2026
- [ ] Library management features
- [ ] Collections and organization
- [ ] Reading progress tracking
- [ ] Beta release

### Q4 2026
- [ ] Cloud sync implementation
- [ ] Advanced reader features
- [ ] Performance optimization
- [ ] Public release

## Support

For questions or issues specific to Android development:
- Create an issue with the `android` label
- Join discussions in the Android development channel

## License

Same as the main Booky project - MIT License

---

**Note**: This branch is currently in the planning phase. Active development will begin soon. Check back regularly for updates!
