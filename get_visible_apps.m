#include <CoreGraphics/CoreGraphics.h>
#include <AppKit/AppKit.h>
#include <stdlib.h>
#include <string.h>

// Helper function to get visible applications as an NSString
NSString* getVisibleAppsNSString() {
    CFArrayRef windowList = CGWindowListCopyWindowInfo(
        kCGWindowListOptionOnScreenOnly | kCGWindowListExcludeDesktopElements,
        kCGNullWindowID
    );
    if (!windowList) {
        return @"";
    }

    NSMutableSet<NSNumber*> *pidSet = [NSMutableSet set];
    NSMutableArray<NSString*> *appList = [NSMutableArray array];

    CFIndex count = CFArrayGetCount(windowList);
    for (CFIndex i = 0; i < count; i++) {
        CFDictionaryRef windowInfo = (CFDictionaryRef)CFArrayGetValueAtIndex(windowList, i);
        CFNumberRef pidRef = (CFNumberRef)CFDictionaryGetValue(windowInfo, kCGWindowOwnerPID);
        if (pidRef) {
            int pid;
            CFNumberGetValue(pidRef, kCFNumberIntType, &pid);
            NSNumber *pidNumber = @(pid);
            if (![pidSet containsObject:pidNumber]) {
                [pidSet addObject:pidNumber];
                NSRunningApplication *app = [NSRunningApplication runningApplicationWithProcessIdentifier:pid];
                if (app && app.bundleIdentifier) {
                    NSString *name = app.localizedName;
                    if (app.bundleURL) {
                        NSString *infoPlistPath = [app.bundleURL.path stringByAppendingPathComponent:@"Contents/Resources/en.lproj/InfoPlist.strings"];
                        NSDictionary *englishInfo = [NSDictionary dictionaryWithContentsOfFile:infoPlistPath];
                        if (englishInfo) {
                            NSString *displayName = englishInfo[@"CFBundleDisplayName"];
                            if (!displayName) {
                                displayName = englishInfo[@"CFBundleName"];
                            }
                            if (displayName) {
                                name = displayName;
                            }
                        }
                    }
                    if (!name) {
                        name = app.bundleIdentifier; // Fallback to bundle ID
                    }
                    NSString *entry = [NSString stringWithFormat:@"%@|%@", name, app.bundleIdentifier];
                    [appList addObject:entry];
                }
            }
        }
    }
    CFRelease(windowList);

    // Sort for consistency
    [appList sortUsingSelector:@selector(compare:)];
    return [appList componentsJoinedByString:@"\n"];
}

// Helper function to get the frontmost application's bundle identifier
NSString* getFrontmostAppNSString() {
    CFArrayRef windowList = CGWindowListCopyWindowInfo(
        kCGWindowListOptionOnScreenOnly | kCGWindowListExcludeDesktopElements,
        kCGNullWindowID
    );
    if (!windowList) {
        return @"";
    }

    NSString *frontmostAppBundleId = @"";
    CFIndex count = CFArrayGetCount(windowList);
    for (CFIndex i = 0; i < count; i++) {
        CFDictionaryRef windowInfo = (CFDictionaryRef)CFArrayGetValueAtIndex(windowList, i);
        CFNumberRef layerRef = (CFNumberRef)CFDictionaryGetValue(windowInfo, kCGWindowLayer);
        if (layerRef) {
            int layer;
            CFNumberGetValue(layerRef, kCFNumberIntType, &layer);
            if (layer == 0) { // Layer 0 is the frontmost window
                CFNumberRef pidRef = (CFNumberRef)CFDictionaryGetValue(windowInfo, kCGWindowOwnerPID);
                if (pidRef) {
                    int pid;
                    CFNumberGetValue(pidRef, kCFNumberIntType, &pid);
                    NSRunningApplication *app = [NSRunningApplication runningApplicationWithProcessIdentifier:pid];
                    if (app && app.bundleIdentifier) {
                        frontmostAppBundleId = app.bundleIdentifier;
                        break;
                    }
                }
            }
        }
    }
    CFRelease(windowList);
    return frontmostAppBundleId;
}

// Exported C function to get visible applications
char* get_visible_apps() {
    NSString *nsString = getVisibleAppsNSString();
    const char *utf8String = [nsString UTF8String];
    if (!utf8String) {
        char *empty = (char*)malloc(1);
        empty[0] = '\0';
        return empty;
    }

    // Allocate memory for the C string and copy it
    size_t length = strlen(utf8String) + 1; // Include null terminator
    char *result = (char*)malloc(length);
    if (!result) {
        return NULL; // Memory allocation failed
    }
    strcpy(result, utf8String);
    return result;
}

// Exported C function to get the frontmost application's bundle identifier
const char* get_frontmost_app() {
    NSString *frontmostApp = getFrontmostAppNSString();
    const char *utf8String = [frontmostApp UTF8String];
    if (!utf8String) {
        char *empty = (char*)malloc(1);
        empty[0] = '\0';
        return empty;
    }

    // Allocate memory for the C string and copy it
    size_t length = strlen(utf8String) + 1; // Include null terminator
    char *result = (char*)malloc(length);
    if (!result) {
        return NULL; // Memory allocation failed
    }
    strcpy(result, utf8String);
    return result;
}

// Exported C function to free the allocated memory
void free_visible_apps(char* ptr) {
    if (ptr) {
        free(ptr);
    }
}
